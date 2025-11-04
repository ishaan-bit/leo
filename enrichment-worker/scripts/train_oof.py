"""
Out-of-Fold (OOF) Prediction Framework.

Trains 5 base models per variable across CV folds to generate
leak-proof predictions for meta-blender training.

Base Models (per variable):
- Lx (Lexical): LGBM on lexical features only
- Eb (Embedding): LGBM on sentence embeddings only  
- Tr (Transformer): Simple feedforward on embeddings
- Tm (Temporal): LGBM on temporal features (if available)
- Ll (LLM): Placeholder for future GPT-4/Claude scores

OOF Strategy:
- Train on folds 0-3, predict on fold 4 → save fold 4 OOF
- Train on folds 0-2,4, predict on fold 3 → save fold 3 OOF
- ... (repeat for all 5 folds)
- Concatenate all OOF predictions → full training set coverage
- NO in-fold predictions (prevents leakage)

Output: data/oof/{variable}/{model_type}_oof.npy
"""

import json
import numpy as np
import lightgbm as lgb
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from sklearn.metrics import mean_squared_error, mean_absolute_error
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class OOFConfig:
    """Configuration for OOF training."""
    variable: str  # valence, arousal, invoked, expressed, willingness, congruence, comparator
    n_folds: int = 5
    data_dir: Path = Path("enrichment-worker/data/features")
    splits_dir: Path = Path("data/splits")
    output_dir: Path = Path("enrichment-worker/data/oof")
    
    # LGBM hyperparameters (default, not tuned)
    lgbm_params: Dict = None
    
    def __post_init__(self):
        if self.lgbm_params is None:
            self.lgbm_params = {
                "objective": "regression",
                "metric": "rmse",
                "learning_rate": 0.05,
                "num_leaves": 31,
                "max_depth": -1,
                "min_data_in_leaf": 20,
                "feature_fraction": 0.8,
                "bagging_fraction": 0.8,
                "bagging_freq": 5,
                "lambda_l1": 0.1,
                "lambda_l2": 0.1,
                "verbose": -1,
                "seed": 137,
            }


class OOFPredictor:
    """
    Generate out-of-fold predictions for meta-blender.
    
    Trains 5 base models (Lx, Eb, Tr, Tm, Ll) per variable
    using CV folds to produce leak-proof predictions.
    """
    
    def __init__(self, config: OOFConfig):
        """Initialize OOF predictor."""
        self.config = config
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create variable-specific output dir
        self.var_output_dir = self.config.output_dir / self.config.variable
        self.var_output_dir.mkdir(parents=True, exist_ok=True)
    
    def load_fold(self, fold_idx: int, split: str = "train") -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """
        Load features and targets for a specific fold.
        
        Args:
            fold_idx: Fold index (0-4)
            split: "train" or "val"
        
        Returns:
            (features, targets, item_ids)
        """
        # Load from CV fold directory
        fold_path = self.config.splits_dir / "cv_folds" / f"fold_{fold_idx}" / f"{split}_features.jsonl"
        
        if not fold_path.exists():
            # Fallback to main features dir if CV features not extracted yet
            fold_path = self.config.data_dir / "cv_folds" / f"fold_{fold_idx}" / f"{split}_features.jsonl"
        
        if not fold_path.exists():
            raise FileNotFoundError(f"Fold data not found: {fold_path}")
        
        items = self._load_jsonl(fold_path)
        
        # Extract target variable
        targets = np.array([item.get(self.config.variable, 0.5) for item in items])
        
        # Extract features (will be handled by feature extractors)
        item_ids = [item.get("rid") for item in items]
        
        return items, targets, item_ids
    
    def extract_lexical_features(self, items: List[Dict]) -> np.ndarray:
        """Extract lexical features as flat array."""
        features = []
        for item in items:
            lex = item.get("lex_features", {})
            feat_vec = [
                lex.get("lex_valence", 0.5),
                lex.get("lex_arousal", 0.5),
                lex.get("word_count", 0),
                lex.get("intensifier_count", 0),
                lex.get("diminisher_count", 0),
                lex.get("negation_count", 0),
                lex.get("profanity_count", 0),
                lex.get("emoji_count", 0),
                lex.get("exclamation_count", 0),
                lex.get("question_count", 0),
                lex.get("caps_ratio", 0.0),
                lex.get("emo_joy_count", 0),
                lex.get("emo_sadness_count", 0),
                lex.get("emo_anger_count", 0),
                lex.get("emo_fear_count", 0),
            ]
            features.append(feat_vec)
        
        return np.array(features, dtype=np.float32)
    
    def extract_embedding_features(self, items: List[Dict]) -> np.ndarray:
        """Extract embedding features (384-dim + anchor sims)."""
        features = []
        for item in items:
            emb = item.get("emb_features", {})
            embedding = emb.get("embedding", [0.0] * 384)
            
            # Add anchor similarities if available
            anchor_sims = emb.get("anchor_sims", {})
            anchor_vec = [
                anchor_sims.get("sim_joy", 0.0),
                anchor_sims.get("sim_sadness", 0.0),
                anchor_sims.get("sim_anger", 0.0),
                anchor_sims.get("sim_fear", 0.0),
                anchor_sims.get("sim_calm", 0.0),
                anchor_sims.get("sim_excited", 0.0),
            ]
            
            feat_vec = embedding + anchor_vec
            features.append(feat_vec)
        
        return np.array(features, dtype=np.float32)
    
    def extract_temporal_features(self, items: List[Dict]) -> Optional[np.ndarray]:
        """Extract temporal features if available."""
        if not items[0].get("tm_features"):
            return None
        
        features = []
        for item in items:
            tm = item.get("tm_features", {})
            feat_vec = [
                tm.get("ema_valence_smooth", 0.5),
                tm.get("ema_arousal_smooth", 0.5),
                tm.get("ema_valence_reactive", 0.5),
                tm.get("ema_arousal_reactive", 0.5),
                tm.get("valence_variance", 0.0),
                tm.get("arousal_variance", 0.0),
                tm.get("emotional_volatility", 0.0),
                tm.get("timeline_density", 0.0),
                tm.get("days_since_last", 0.0),
                tm.get("hour_sin", 0.0),
                tm.get("hour_cos", 1.0),
            ]
            features.append(feat_vec)
        
        return np.array(features, dtype=np.float32)
    
    def train_lexical_model(
        self,
        train_items: List[Dict],
        train_targets: np.ndarray,
        val_items: List[Dict],
        val_targets: np.ndarray
    ) -> Tuple[lgb.Booster, np.ndarray]:
        """
        Train LGBM on lexical features only.
        
        Returns:
            (model, val_predictions)
        """
        X_train = self.extract_lexical_features(train_items)
        X_val = self.extract_lexical_features(val_items)
        
        train_data = lgb.Dataset(X_train, label=train_targets)
        val_data = lgb.Dataset(X_val, label=val_targets, reference=train_data)
        
        model = lgb.train(
            self.config.lgbm_params,
            train_data,
            num_boost_round=500,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)]
        )
        
        val_preds = model.predict(X_val, num_iteration=model.best_iteration)
        
        return model, val_preds
    
    def train_embedding_model(
        self,
        train_items: List[Dict],
        train_targets: np.ndarray,
        val_items: List[Dict],
        val_targets: np.ndarray
    ) -> Tuple[lgb.Booster, np.ndarray]:
        """
        Train LGBM on embedding features only.
        
        Returns:
            (model, val_predictions)
        """
        X_train = self.extract_embedding_features(train_items)
        X_val = self.extract_embedding_features(val_items)
        
        train_data = lgb.Dataset(X_train, label=train_targets)
        val_data = lgb.Dataset(X_val, label=val_targets, reference=train_data)
        
        model = lgb.train(
            self.config.lgbm_params,
            train_data,
            num_boost_round=500,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)]
        )
        
        val_preds = model.predict(X_val, num_iteration=model.best_iteration)
        
        return model, val_preds
    
    def train_temporal_model(
        self,
        train_items: List[Dict],
        train_targets: np.ndarray,
        val_items: List[Dict],
        val_targets: np.ndarray
    ) -> Tuple[Optional[lgb.Booster], Optional[np.ndarray]]:
        """
        Train LGBM on temporal features (if available).
        
        Returns:
            (model, val_predictions) or (None, None) if no temporal features
        """
        X_train = self.extract_temporal_features(train_items)
        X_val = self.extract_temporal_features(val_items)
        
        if X_train is None or X_val is None:
            print("  [Tm] No temporal features available, skipping")
            return None, None
        
        train_data = lgb.Dataset(X_train, label=train_targets)
        val_data = lgb.Dataset(X_val, label=val_targets, reference=train_data)
        
        model = lgb.train(
            self.config.lgbm_params,
            train_data,
            num_boost_round=500,
            valid_sets=[val_data],
            callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)]
        )
        
        val_preds = model.predict(X_val, num_iteration=model.best_iteration)
        
        return model, val_preds
    
    def generate_oof_predictions(self) -> Dict[str, np.ndarray]:
        """
        Generate OOF predictions for all base models.
        
        Returns:
            Dict mapping model_type to OOF predictions array
        """
        print(f"\n{'='*70}")
        print(f"GENERATING OOF PREDICTIONS: {self.config.variable.upper()}")
        print(f"{'='*70}")
        
        # Initialize OOF arrays
        # Load full train split to get size and ordering
        train_path = self.config.data_dir / "train_features.jsonl"
        if not train_path.exists():
            # Fallback to splits dir
            train_path = Path("enrichment-worker/data/features/train_features.jsonl")
        
        all_train_items = self._load_jsonl(train_path)
        n_samples = len(all_train_items)
        
        oof_predictions = {
            "lexical": np.zeros(n_samples, dtype=np.float32),
            "embedding": np.zeros(n_samples, dtype=np.float32),
            "temporal": np.zeros(n_samples, dtype=np.float32),
        }
        
        oof_indices = {}  # Track which indices belong to which fold
        
        # Train on each fold
        for val_fold in range(self.config.n_folds):
            print(f"\n[FOLD {val_fold}] Training models...")
            
            # Load validation fold
            val_items, val_targets, val_ids = self.load_fold(val_fold, "val")
            
            # Collect training folds (all except val_fold)
            train_items_all = []
            train_targets_all = []
            
            for train_fold in range(self.config.n_folds):
                if train_fold == val_fold:
                    continue
                
                fold_items, fold_targets, _ = self.load_fold(train_fold, "train")
                train_items_all.extend(fold_items)
                train_targets_all.extend(fold_targets)
            
            train_targets_arr = np.array(train_targets_all)
            
            print(f"  Train: {len(train_items_all)} items")
            print(f"  Val: {len(val_items)} items")
            
            # Train Lexical model
            print(f"\n  [Lx] Training lexical model...")
            lx_model, lx_preds = self.train_lexical_model(
                train_items_all, train_targets_arr,
                val_items, val_targets
            )
            lx_rmse = np.sqrt(mean_squared_error(val_targets, lx_preds))
            print(f"  [Lx] Val RMSE: {lx_rmse:.4f}")
            
            # Train Embedding model
            print(f"\n  [Eb] Training embedding model...")
            eb_model, eb_preds = self.train_embedding_model(
                train_items_all, train_targets_arr,
                val_items, val_targets
            )
            eb_rmse = np.sqrt(mean_squared_error(val_targets, eb_preds))
            print(f"  [Eb] Val RMSE: {eb_rmse:.4f}")
            
            # Train Temporal model (if features available)
            print(f"\n  [Tm] Training temporal model...")
            tm_model, tm_preds = self.train_temporal_model(
                train_items_all, train_targets_arr,
                val_items, val_targets
            )
            if tm_preds is not None:
                tm_rmse = np.sqrt(mean_squared_error(val_targets, tm_preds))
                print(f"  [Tm] Val RMSE: {tm_rmse:.4f}")
            
            # Store OOF predictions
            # Map val_ids to indices in full train set
            val_indices = [i for i, item in enumerate(all_train_items) if item["rid"] in val_ids]
            oof_indices[val_fold] = val_indices
            
            oof_predictions["lexical"][val_indices] = lx_preds
            oof_predictions["embedding"][val_indices] = eb_preds
            if tm_preds is not None:
                oof_predictions["temporal"][val_indices] = tm_preds
            
            print(f"\n  [OK] Fold {val_fold} OOF predictions saved ({len(val_indices)} items)")
        
        # Save OOF predictions
        for model_type, preds in oof_predictions.items():
            output_path = self.var_output_dir / f"{model_type}_oof.npy"
            np.save(output_path, preds)
            print(f"\n[OK] Saved {model_type} OOF: {output_path}")
        
        # Save OOF metadata
        metadata = {
            "variable": self.config.variable,
            "n_folds": self.config.n_folds,
            "n_samples": n_samples,
            "oof_indices": {str(k): v for k, v in oof_indices.items()},
            "models": list(oof_predictions.keys()),
        }
        metadata_path = self.var_output_dir / "oof_metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        print(f"\n{'='*70}")
        print(f"OOF GENERATION COMPLETE: {self.config.variable.upper()}")
        print(f"{'='*70}")
        
        return oof_predictions
    
    def _load_jsonl(self, path: Path) -> List[Dict]:
        """Load JSONL file."""
        items = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    items.append(json.loads(line))
        return items


def main():
    """Generate OOF predictions for a variable."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate OOF predictions for meta-blender")
    parser.add_argument(
        "--variable",
        type=str,
        required=True,
        choices=["valence", "arousal", "invoked", "expressed", "willingness", "congruence", "comparator"],
        help="Variable to generate OOF predictions for"
    )
    parser.add_argument(
        "--n-folds",
        type=int,
        default=5,
        help="Number of CV folds"
    )
    
    args = parser.parse_args()
    
    config = OOFConfig(
        variable=args.variable,
        n_folds=args.n_folds
    )
    
    predictor = OOFPredictor(config)
    oof_preds = predictor.generate_oof_predictions()
    
    print(f"\n[OK] OOF predictions ready for meta-blender training")


if __name__ == "__main__":
    main()
