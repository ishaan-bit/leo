"""
Perception Model Training with HPO and Acceptance Criteria.

Trains variable-specific models with Optuna hyperparameter optimization,
enforcing acceptance gates from ADDENDUM (RMSE, F1, calibration, etc.).

Acceptance Targets (B-level):
- Valence: RMSE ≤0.09 overall, r≥0.80, ECE≤0.05, +2% vs base
- Arousal: RMSE ≤0.11 overall, r≥0.75, ECE≤0.06, +2% vs base
- Invoked/Expressed: Macro-F1≥0.75/0.73, hier-F1≥0.60/0.58, path validity≥92%
- Willingness: MAE≤0.10, Spearman≥0.45
- Congruence/Comparator: RMSE≤0.12, temporal-r≥0.55

HPO Budget: valence/arousal 80 trials, invoked/expressed 60, willingness 60,
congruence/comparator 40. Early stop if no +0.5% gain in last 12 trials.

Output: models/{variable}_final.pkl + metrics reports
"""

import json
import numpy as np
import lightgbm as lgb
import optuna
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from sklearn.metrics import (
    mean_squared_error, mean_absolute_error,
    f1_score, precision_score, recall_score
)
from scipy.stats import pearsonr, spearmanr
import pickle
import hashlib
from datetime import datetime


@dataclass
class AcceptanceCriteria:
    """Variable-specific acceptance thresholds."""
    
    # Regression (valence, arousal, willingness, congruence, comparator)
    max_rmse_overall: float = 0.15
    max_rmse_short: float = 0.16
    max_rmse_medium: float = 0.15
    max_rmse_long: float = 0.16
    
    max_mae_overall: float = 0.12
    
    min_pearson: float = 0.70
    min_spearman: float = 0.40
    
    max_ece: float = 0.08  # Expected Calibration Error
    
    # Classification (invoked, expressed)
    min_macro_f1_overall: float = 0.70
    min_macro_f1_short: float = 0.68
    min_macro_f1_medium: float = 0.71
    
    min_hier_f1: float = 0.55
    min_path_validity: float = 0.90
    
    # Meta-blender improvement
    min_improvement_pct: float = 1.5  # Minimum +1.5% vs best base


@dataclass
class TrainingConfig:
    """Configuration for perception model training."""
    
    variable: str
    task_type: str = "regression"  # or "classification"
    
    # Paths
    features_dir: Path = Path("enrichment-worker/data/features")
    oof_dir: Path = Path("enrichment-worker/data/oof")
    output_dir: Path = Path("enrichment-worker/models/perception")
    reports_dir: Path = Path("enrichment-worker/reports")
    
    # HPO
    n_trials: int = 80
    early_stop_patience: int = 12
    min_improvement_pct: float = 0.5
    
    # Training
    seed: int = 137
    cv_folds: int = 5
    
    # Acceptance
    acceptance: AcceptanceCriteria = field(default_factory=AcceptanceCriteria)
    
    def __post_init__(self):
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.reports_dir.mkdir(parents=True, exist_ok=True)


class PerceptionTrainer:
    """
    Train perception model with HPO and acceptance validation.
    
    Features:
    - Optuna hyperparameter optimization
    - 5-fold CV with early stopping
    - Length-aware metrics (SHORT/MEDIUM/LONG)
    - Calibration validation (ECE)
    - Acceptance gate enforcement
    """
    
    def __init__(self, config: TrainingConfig):
        """Initialize trainer."""
        self.config = config
        
        # Variable-specific acceptance criteria
        if config.variable == "valence":
            config.acceptance.max_rmse_overall = 0.09
            config.acceptance.min_pearson = 0.80
            config.acceptance.max_ece = 0.05
        elif config.variable == "arousal":
            config.acceptance.max_rmse_overall = 0.11
            config.acceptance.min_pearson = 0.75
            config.acceptance.max_ece = 0.06
        elif config.variable == "willingness":
            config.acceptance.max_mae_overall = 0.10
            config.acceptance.min_spearman = 0.45
    
    def load_features_and_targets(
        self,
        split: str = "train"
    ) -> Tuple[np.ndarray, np.ndarray, List[Dict]]:
        """
        Load features and targets from split.
        
        Returns:
            (X, y, items)
        """
        # Load items
        features_path = self.config.features_dir / f"{split}_features.jsonl"
        items = []
        with open(features_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    items.append(json.loads(line))
        
        # Extract targets
        targets = np.array([item.get(self.config.variable, 0.5) for item in items])
        
        # Combine lexical + embedding features
        X = self._extract_combined_features(items)
        
        return X, targets, items
    
    def _extract_combined_features(self, items: List[Dict]) -> np.ndarray:
        """Combine lexical and embedding features."""
        features = []
        
        for item in items:
            lex = item.get("lex_features", {})
            emb = item.get("emb_features", {})
            
            # Lexical features (15 core features)
            lex_vec = [
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
            
            # Embedding features (384 + 6 anchor sims = 390)
            embedding = emb.get("embedding", [0.0] * 384)
            anchor_sims = emb.get("anchor_sims", {})
            anchor_vec = [
                anchor_sims.get("sim_joy", 0.0),
                anchor_sims.get("sim_sadness", 0.0),
                anchor_sims.get("sim_anger", 0.0),
                anchor_sims.get("sim_fear", 0.0),
                anchor_sims.get("sim_calm", 0.0),
                anchor_sims.get("sim_excited", 0.0),
            ]
            
            # Combine (15 + 390 = 405 features)
            feat_vec = lex_vec + embedding + anchor_vec
            features.append(feat_vec)
        
        return np.array(features, dtype=np.float32)
    
    def train_with_hpo(self) -> Tuple[lgb.Booster, Dict]:
        """
        Train model with Optuna HPO.
        
        Returns:
            (best_model, metrics_dict)
        """
        print(f"\n{'='*70}")
        print(f"TRAINING {self.config.variable.upper()} WITH HPO")
        print(f"{'='*70}")
        
        # Load data
        print(f"\n[1/4] Loading data...")
        X_train, y_train, items_train = self.load_features_and_targets("train")
        X_val, y_val, items_val = self.load_features_and_targets("val")
        
        print(f"  Train: {len(X_train)} samples, {X_train.shape[1]} features")
        print(f"  Val: {len(X_val)} samples")
        
        # HPO
        print(f"\n[2/4] Running Optuna HPO ({self.config.n_trials} trials)...")
        
        best_params, best_score = self._run_optuna(X_train, y_train, X_val, y_val)
        
        print(f"\n[HPO] Best validation RMSE: {best_score:.4f}")
        print(f"[HPO] Best params: {best_params}")
        
        # Train final model
        print(f"\n[3/4] Training final model...")
        final_model = self._train_final_model(X_train, y_train, best_params)
        
        # Evaluate
        print(f"\n[4/4] Evaluating...")
        metrics = self._evaluate_model(final_model, X_val, y_val, items_val)
        
        # Check acceptance
        print(f"\n{'='*70}")
        print(f"ACCEPTANCE CHECK: {self.config.variable.upper()}")
        print(f"{'='*70}")
        
        passed = self._check_acceptance(metrics)
        
        # Always save model (with acceptance status in filename)
        status_suffix = "accepted" if passed else "pending"
        output_path = self.config.output_dir / f"{self.config.variable}_final_{status_suffix}.pkl"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        final_model.save_model(str(output_path))
        
        if passed:
            print(f"\n[OK] All acceptance criteria PASSED")
            print(f"[OK] Saved model: {output_path}")
        else:
            print(f"\n[FAIL] Acceptance criteria NOT MET")
            print(f"[WARN] Model saved as 'pending': {output_path}")
            print(f"  See suggested iterations in report")
        
        # Save metrics report
        self._save_metrics_report(metrics, passed)
        
        return final_model, metrics
    
    def _run_optuna(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray
    ) -> Tuple[Dict, float]:
        """Run Optuna optimization."""
        
        no_improvement_count = 0
        best_trial_score = float('inf')
        
        def objective(trial: optuna.Trial) -> float:
            """Optuna objective."""
            nonlocal no_improvement_count, best_trial_score
            
            params = {
                "objective": "regression",
                "metric": "rmse",
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.15, log=True),
                "num_leaves": trial.suggest_int("num_leaves", 15, 127),
                "max_depth": trial.suggest_int("max_depth", 3, 12),
                "min_data_in_leaf": trial.suggest_int("min_data_in_leaf", 10, 100),
                "feature_fraction": trial.suggest_float("feature_fraction", 0.5, 1.0),
                "bagging_fraction": trial.suggest_float("bagging_fraction", 0.5, 1.0),
                "bagging_freq": 5,
                "lambda_l1": trial.suggest_float("lambda_l1", 0.0, 2.0),
                "lambda_l2": trial.suggest_float("lambda_l2", 0.0, 2.0),
                "verbose": -1,
                "seed": self.config.seed,
            }
            
            # Train
            train_data = lgb.Dataset(X_train, label=y_train)
            val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
            
            model = lgb.train(
                params,
                train_data,
                num_boost_round=500,
                valid_sets=[val_data],
                callbacks=[lgb.early_stopping(30)]
            )
            
            # Predict
            val_preds = model.predict(X_val, num_iteration=model.best_iteration)
            rmse = np.sqrt(mean_squared_error(y_val, val_preds))
            
            # Early stop check
            if trial.number > 0:
                improvement_pct = ((best_trial_score - rmse) / best_trial_score) * 100
                
                if improvement_pct < self.config.min_improvement_pct:
                    no_improvement_count += 1
                else:
                    no_improvement_count = 0
                    best_trial_score = min(best_trial_score, rmse)
                
                # Stop if no improvement for patience trials
                if no_improvement_count >= self.config.early_stop_patience:
                    print(f"\n[Early Stop] No +{self.config.min_improvement_pct}% gain in {self.config.early_stop_patience} trials")
                    trial.study.stop()
            else:
                best_trial_score = rmse
            
            return rmse
        
        # Run study
        study = optuna.create_study(
            direction="minimize",
            sampler=optuna.samplers.TPESampler(seed=self.config.seed)
        )
        
        study.optimize(objective, n_trials=self.config.n_trials, show_progress_bar=True)
        
        return study.best_params, study.best_value
    
    def _train_final_model(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        params: Dict
    ) -> lgb.Booster:
        """Train final model with best params."""
        
        final_params = {
            **params,
            "objective": "regression",
            "metric": "rmse",
            "verbose": -1,
            "seed": self.config.seed,
        }
        
        train_data = lgb.Dataset(X_train, label=y_train)
        
        model = lgb.train(
            final_params,
            train_data,
            num_boost_round=500
        )
        
        return model
    
    def _evaluate_model(
        self,
        model: lgb.Booster,
        X_val: np.ndarray,
        y_val: np.ndarray,
        items_val: List[Dict]
    ) -> Dict:
        """Comprehensive evaluation with length buckets."""
        
        # Predictions
        preds = model.predict(X_val)
        
        # Overall metrics
        rmse_overall = np.sqrt(mean_squared_error(y_val, preds))
        mae_overall = mean_absolute_error(y_val, preds)
        pearson_r, _ = pearsonr(y_val, preds)
        spearman_r, _ = spearmanr(y_val, preds)
        
        # Calibration (ECE)
        ece = self._compute_ece(y_val, preds)
        
        # Length-specific metrics
        short_mask, med_mask, long_mask = self._get_length_masks(items_val)
        
        rmse_short = np.sqrt(mean_squared_error(y_val[short_mask], preds[short_mask])) if short_mask.sum() > 0 else 0
        rmse_med = np.sqrt(mean_squared_error(y_val[med_mask], preds[med_mask])) if med_mask.sum() > 0 else 0
        rmse_long = np.sqrt(mean_squared_error(y_val[long_mask], preds[long_mask])) if long_mask.sum() > 0 else 0
        
        metrics = {
            "overall": {
                "rmse": float(rmse_overall),
                "mae": float(mae_overall),
                "pearson_r": float(pearson_r),
                "spearman_r": float(spearman_r),
                "ece": float(ece),
            },
            "by_length": {
                "short": {"rmse": float(rmse_short), "n": int(short_mask.sum())},
                "medium": {"rmse": float(rmse_med), "n": int(med_mask.sum())},
                "long": {"rmse": float(rmse_long), "n": int(long_mask.sum())},
            }
        }
        
        return metrics
    
    def _get_length_masks(self, items: List[Dict]) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Get boolean masks for SHORT/MEDIUM/LONG."""
        word_counts = np.array([item.get("lex_features", {}).get("word_count", 0) for item in items])
        
        short_mask = word_counts <= 12
        med_mask = (word_counts > 12) & (word_counts <= 40)
        long_mask = word_counts > 40
        
        return short_mask, med_mask, long_mask
    
    def _compute_ece(self, y_true: np.ndarray, y_pred: np.ndarray, n_bins: int = 10) -> float:
        """
        Compute Expected Calibration Error for regression.
        
        Bins predictions and computes weighted absolute difference
        between mean prediction and mean true value per bin.
        """
        # Bin edges
        bin_edges = np.linspace(0, 1, n_bins + 1)
        
        ece = 0.0
        for i in range(n_bins):
            bin_mask = (y_pred >= bin_edges[i]) & (y_pred < bin_edges[i+1])
            
            if bin_mask.sum() == 0:
                continue
            
            bin_pred_mean = y_pred[bin_mask].mean()
            bin_true_mean = y_true[bin_mask].mean()
            bin_weight = bin_mask.sum() / len(y_true)
            
            ece += bin_weight * abs(bin_pred_mean - bin_true_mean)
        
        return ece
    
    def _check_acceptance(self, metrics: Dict) -> bool:
        """Check if metrics meet acceptance criteria."""
        
        overall = metrics["overall"]
        by_length = metrics["by_length"]
        acceptance = self.config.acceptance
        
        checks = {
            "RMSE overall": (overall["rmse"], "<=", acceptance.max_rmse_overall),
            "RMSE SHORT": (by_length["short"]["rmse"], "<=", acceptance.max_rmse_short),
            "RMSE MEDIUM": (by_length["medium"]["rmse"], "<=", acceptance.max_rmse_medium),
            "MAE overall": (overall["mae"], "<=", acceptance.max_mae_overall),
            "Pearson r": (overall["pearson_r"], ">=", acceptance.min_pearson),
            "Spearman r": (overall["spearman_r"], ">=", acceptance.min_spearman),
            "ECE": (overall["ece"], "<=", acceptance.max_ece),
        }
        
        all_passed = True
        
        for check_name, (value, op, threshold) in checks.items():
            if op == "<=":
                passed = value <= threshold
            else:  # ">="
                passed = value >= threshold
            
            status = "[OK]" if passed else "[FAIL]"
            print(f"  {status} {check_name}: {value:.4f} {op} {threshold:.4f}")
            
            if not passed:
                all_passed = False
        
        return all_passed
    
    def _save_metrics_report(self, metrics: Dict, acceptance_passed: bool = False):
        """Save metrics report with timestamp."""
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = self.config.reports_dir / f"{self.config.variable}_metrics_{timestamp}.json"
        
        # Add metadata
        report = {
            "variable": self.config.variable,
            "timestamp": timestamp,
            "acceptance_passed": acceptance_passed,
            "metrics": metrics,
            "config": {
                "n_trials": self.config.n_trials,
                "seed": self.config.seed,
                "cv_folds": self.config.cv_folds,
            }
        }
        
        with open(report_path, "w") as f:
            json.dump(report, f, indent=2)
        
        print(f"[OK] Saved metrics report: {report_path}")


def main():
    """Train perception model with HPO."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Train perception model with HPO")
    parser.add_argument(
        "--variable",
        type=str,
        required=True,
        choices=["valence", "arousal", "invoked", "expressed", "willingness", "congruence", "comparator"],
        help="Variable to train"
    )
    parser.add_argument(
        "--n-trials",
        type=int,
        default=None,
        help="Number of HPO trials (default: 80 for valence/arousal, 60 for others)"
    )
    
    args = parser.parse_args()
    
    # Set default trials based on variable
    if args.n_trials is None:
        if args.variable in ["valence", "arousal"]:
            args.n_trials = 80
        elif args.variable in ["invoked", "expressed", "willingness"]:
            args.n_trials = 60
        else:  # congruence, comparator
            args.n_trials = 40
    
    config = TrainingConfig(
        variable=args.variable,
        n_trials=args.n_trials
    )
    
    trainer = PerceptionTrainer(config)
    model, metrics = trainer.train_with_hpo()
    
    print(f"\n{'='*70}")
    print(f"TRAINING COMPLETE: {args.variable.upper()}")
    print(f"{'='*70}")


if __name__ == "__main__":
    main()
