"""
Meta-Blender Training.

Learns optimal α weights for combining base model predictions
(Lx, Eb, Tr, Tm, Ll) using OOF predictions and context features.

Blending Formula:
  final_pred = α_Lx * pred_Lx + α_Eb * pred_Eb + α_Tr * pred_Tr + α_Tm * pred_Tm + α_Ll * pred_Ll
  
Constraints:
  - Softmax (Σ α_i = 1.0, all α_i > 0)
  - Context-aware (weights vary by length_bucket, language, etc.)

Training:
  - LGBM on OOF predictions + context features
  - Optuna HPO (50 trials)
  - Metric: RMSE

Output: models/meta_blender/{variable}_blender.pkl
"""

import json
import numpy as np
import lightgbm as lgb
import optuna
from pathlib import Path
from typing import Dict, List, Tuple
from dataclasses import dataclass
from sklearn.metrics import mean_squared_error, mean_absolute_error
from scipy.special import softmax
import pickle


@dataclass
class BlenderConfig:
    """Configuration for meta-blender training."""
    variable: str
    oof_dir: Path = Path("enrichment-worker/data/oof")
    features_dir: Path = Path("enrichment-worker/data/features")
    output_dir: Path = Path("enrichment-worker/models/meta_blender")
    
    n_trials: int = 50
    seed: int = 137


class MetaBlender:
    """
    Train meta-blender to combine base model predictions.
    
    Uses LGBM to learn context-dependent α weights from OOF predictions.
    """
    
    def __init__(self, config: BlenderConfig):
        """Initialize meta-blender."""
        self.config = config
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
    
    def load_oof_predictions(self) -> Dict[str, np.ndarray]:
        """
        Load OOF predictions for all base models.
        
        Returns:
            Dict mapping model_type to OOF array
        """
        oof_dir = self.config.oof_dir / self.config.variable
        
        oof_preds = {}
        for model_type in ["lexical", "embedding", "temporal"]:
            oof_path = oof_dir / f"{model_type}_oof.npy"
            
            if oof_path.exists():
                oof_preds[model_type] = np.load(oof_path)
                print(f"[Load] {model_type}: {oof_preds[model_type].shape}")
            else:
                print(f"[Skip] {model_type} OOF not found")
        
        return oof_preds
    
    def load_features_and_targets(self) -> Tuple[List[Dict], np.ndarray]:
        """
        Load feature-enriched items and targets from train split.
        
        Returns:
            (items, targets)
        """
        train_path = self.config.features_dir / "train_features.jsonl"
        
        items = []
        with open(train_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    items.append(json.loads(line))
        
        targets = np.array([item.get(self.config.variable, 0.5) for item in items])
        
        return items, targets
    
    def extract_context_features(self, items: List[Dict]) -> np.ndarray:
        """
        Extract context features for blending.
        
        Features:
        - length_bucket (one-hot: SHORT, MEDIUM, LONG)
        - language (one-hot: EN, Hinglish)
        - word_count (normalized)
        - has_profanity, has_negation, emoji_count
        """
        features = []
        for item in items:
            lex = item.get("lex_features", {})
            
            # Length bucket (from word count)
            word_count = lex.get("word_count", 0)
            is_short = 1 if word_count <= 12 else 0
            is_medium = 1 if 12 < word_count <= 40 else 0
            is_long = 1 if word_count > 40 else 0
            
            # Language
            lang = item.get("lang", "EN")
            is_en = 1 if lang == "EN" else 0
            is_hinglish = 1 if lang in ["Hinglish", "HI"] else 0
            
            # Lexical markers
            has_profanity = 1 if lex.get("profanity_count", 0) > 0 else 0
            has_negation = 1 if lex.get("negation_count", 0) > 0 else 0
            emoji_count = min(lex.get("emoji_count", 0), 5)  # Cap at 5
            
            # Word count (normalized)
            word_count_norm = min(word_count / 100.0, 1.0)
            
            feat_vec = [
                is_short, is_medium, is_long,
                is_en, is_hinglish,
                has_profanity, has_negation, emoji_count,
                word_count_norm
            ]
            features.append(feat_vec)
        
        return np.array(features, dtype=np.float32)
    
    def prepare_blender_features(
        self,
        oof_preds: Dict[str, np.ndarray],
        context_features: np.ndarray
    ) -> np.ndarray:
        """
        Combine OOF predictions and context features.
        
        Args:
            oof_preds: Dict of OOF arrays
            context_features: Context feature array
        
        Returns:
            Combined feature matrix (n_samples, n_oof + n_context)
        """
        # Stack OOF predictions
        oof_arrays = [oof_preds[k] for k in sorted(oof_preds.keys())]
        oof_matrix = np.column_stack(oof_arrays)
        
        # Concatenate with context
        blender_features = np.concatenate([oof_matrix, context_features], axis=1)
        
        return blender_features
    
    def train_blender(
        self,
        X: np.ndarray,
        y: np.ndarray
    ) -> lgb.Booster:
        """
        Train LGBM meta-blender with Optuna HPO.
        
        Args:
            X: Blender features (OOF + context)
            y: True targets
        
        Returns:
            Trained LGBM model
        """
        print(f"\n[HPO] Running Optuna optimization ({self.config.n_trials} trials)...")
        
        def objective(trial: optuna.Trial) -> float:
            """Optuna objective function."""
            params = {
                "objective": "regression",
                "metric": "rmse",
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
                "num_leaves": trial.suggest_int("num_leaves", 15, 63),
                "max_depth": trial.suggest_int("max_depth", 3, 8),
                "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 10, 50),
                "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
                "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
                "bagging_freq": 5,
                "lambda_l1": trial.suggest_float("lambda_l1", 0.0, 1.0),
                "lambda_l2": trial.suggest_float("lambda_l2", 0.0, 1.0),
                "verbose": -1,
                "seed": self.config.seed,
            }
            
            # Simple train/val split for HPO
            val_size = int(len(X) * 0.2)
            X_train, X_val = X[:-val_size], X[-val_size:]
            y_train, y_val = y[:-val_size], y[-val_size:]
            
            train_data = lgb.Dataset(X_train, label=y_train)
            val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
            
            model = lgb.train(
                params,
                train_data,
                num_boost_round=500,
                valid_sets=[val_data],
                callbacks=[lgb.early_stopping(30)]
            )
            
            val_preds = model.predict(X_val, num_iteration=model.best_iteration)
            rmse = np.sqrt(mean_squared_error(y_val, val_preds))
            
            return rmse
        
        # Run Optuna
        study = optuna.create_study(
            direction="minimize",
            sampler=optuna.samplers.TPESampler(seed=self.config.seed)
        )
        study.optimize(objective, n_trials=self.config.n_trials, show_progress_bar=True)
        
        print(f"\n[HPO] Best RMSE: {study.best_value:.4f}")
        print(f"[HPO] Best params: {study.best_params}")
        
        # Train final model with best params
        best_params = study.best_params
        best_params.update({
            "objective": "regression",
            "metric": "rmse",
            "verbose": -1,
            "seed": self.config.seed,
        })
        
        train_data = lgb.Dataset(X, label=y)
        
        final_model = lgb.train(
            best_params,
            train_data,
            num_boost_round=500
        )
        
        return final_model
    
    def train(self) -> lgb.Booster:
        """
        Full training pipeline.
        
        Returns:
            Trained meta-blender model
        """
        print(f"\n{'='*70}")
        print(f"TRAINING META-BLENDER: {self.config.variable.upper()}")
        print(f"{'='*70}")
        
        # Load OOF predictions
        print(f"\n[1/5] Loading OOF predictions...")
        oof_preds = self.load_oof_predictions()
        
        # Load features and targets
        print(f"\n[2/5] Loading features and targets...")
        items, targets = self.load_features_and_targets()
        print(f"  Loaded {len(items)} items")
        
        # Extract context features
        print(f"\n[3/5] Extracting context features...")
        context_features = self.extract_context_features(items)
        print(f"  Context features shape: {context_features.shape}")
        
        # Prepare blender features
        print(f"\n[4/5] Preparing blender features...")
        X = self.prepare_blender_features(oof_preds, context_features)
        print(f"  Blender features shape: {X.shape}")
        
        # Train with HPO
        print(f"\n[5/5] Training meta-blender...")
        model = self.train_blender(X, targets)
        
        # Evaluate
        preds = model.predict(X)
        train_rmse = np.sqrt(mean_squared_error(targets, preds))
        train_mae = mean_absolute_error(targets, preds)
        
        print(f"\n[OK] Training complete:")
        print(f"  Train RMSE: {train_rmse:.4f}")
        print(f"  Train MAE: {train_mae:.4f}")
        
        # Save model
        output_path = self.config.output_dir / f"{self.config.variable}_blender.pkl"
        with open(output_path, "wb") as f:
            pickle.dump(model, f)
        
        print(f"\n[OK] Saved meta-blender: {output_path}")
        
        # Save metadata
        metadata = {
            "variable": self.config.variable,
            "n_samples": len(items),
            "n_features": X.shape[1],
            "train_rmse": float(train_rmse),
            "train_mae": float(train_mae),
            "base_models": list(oof_preds.keys()),
        }
        
        metadata_path = self.config.output_dir / f"{self.config.variable}_metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n{'='*70}")
        print(f"META-BLENDER TRAINING COMPLETE: {self.config.variable.upper()}")
        print(f"{'='*70}")
        
        return model


def main():
    """Train meta-blender for a variable."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Train meta-blender for combining base models")
    parser.add_argument(
        "--variable",
        type=str,
        required=True,
        choices=["valence", "arousal", "invoked", "expressed", "willingness", "congruence", "comparator"],
        help="Variable to train meta-blender for"
    )
    parser.add_argument(
        "--n-trials",
        type=int,
        default=50,
        help="Number of Optuna trials"
    )
    
    args = parser.parse_args()
    
    config = BlenderConfig(
        variable=args.variable,
        n_trials=args.n_trials
    )
    
    blender = MetaBlender(config)
    model = blender.train()
    
    print(f"\n[OK] Meta-blender ready for inference")


if __name__ == "__main__":
    main()
