"""
Task 8: Calibration & Comprehensive Evaluation

Post-training calibration (Isotonic/Platt), final metrics computation,
leakage validation, and acceptance report generation.

Features:
- Isotonic and Platt scaling calibration
- Length-aware metrics (SHORT/MEDIUM/LONG)
- Language-specific breakdown (EN/Hinglish)
- Calibration curve plotting
- Confusion matrices (for classification vars)
- Temporal leakage validation
- Final acceptance report

Usage:
    python scripts/evaluate_calibration.py --variable valence --model-path models/valence_final.pkl
    python scripts/evaluate_calibration.py --variable invoked --model-path models/invoked_final.pkl --task classification
"""

import argparse
import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
import warnings
warnings.filterwarnings('ignore')

import lightgbm as lgb
from sklearn.calibration import CalibratedClassifierCV
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    mean_squared_error,
    mean_absolute_error,
    r2_score,
    f1_score,
    precision_recall_fscore_support,
    confusion_matrix,
    log_loss,
    brier_score_loss
)
from scipy.stats import pearsonr, spearmanr

# Plotting
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
sns.set_style('whitegrid')


@dataclass
class CalibrationConfig:
    """Calibration configuration"""
    variable: str
    task: str  # 'regression' or 'classification'
    model_path: Path
    data_dir: Path
    output_dir: Path
    
    # Calibration methods
    use_isotonic: bool = True
    use_platt: bool = True
    
    # Plotting
    create_plots: bool = True
    plot_format: str = 'png'  # 'png', 'pdf', 'svg'
    
    # Leakage validation
    check_temporal_leakage: bool = True
    embargo_days: int = 7


@dataclass
class EvaluationMetrics:
    """Comprehensive evaluation metrics"""
    variable: str
    task: str
    
    # Overall metrics
    rmse: Optional[float] = None
    mae: Optional[float] = None
    r2: Optional[float] = None
    pearson_r: Optional[float] = None
    spearman_r: Optional[float] = None
    
    # Classification metrics
    macro_f1: Optional[float] = None
    micro_f1: Optional[float] = None
    weighted_f1: Optional[float] = None
    accuracy: Optional[float] = None
    
    # Calibration metrics
    ece: Optional[float] = None  # Expected Calibration Error
    mce: Optional[float] = None  # Maximum Calibration Error
    brier_score: Optional[float] = None
    log_loss_val: Optional[float] = None
    
    # Length-specific (SHORT/MEDIUM/LONG)
    rmse_short: Optional[float] = None
    rmse_medium: Optional[float] = None
    rmse_long: Optional[float] = None
    f1_short: Optional[float] = None
    f1_medium: Optional[float] = None
    f1_long: Optional[float] = None
    
    # Language-specific
    rmse_en: Optional[float] = None
    rmse_hinglish: Optional[float] = None
    f1_en: Optional[float] = None
    f1_hinglish: Optional[float] = None
    
    # Leakage validation
    temporal_leakage_detected: bool = False
    user_leakage_detected: bool = False
    
    # Sample counts
    n_total: int = 0
    n_short: int = 0
    n_medium: int = 0
    n_long: int = 0
    n_en: int = 0
    n_hinglish: int = 0


class CalibrationEvaluator:
    """Post-training calibration and comprehensive evaluation"""
    
    def __init__(self, config: CalibrationConfig):
        self.config = config
        self.model = None
        self.calibrated_model_isotonic = None
        self.calibrated_model_platt = None
        
        # Data placeholders
        self.X_val = None
        self.y_val = None
        self.val_metadata = None
        
        # Metrics
        self.metrics = EvaluationMetrics(
            variable=config.variable,
            task=config.task
        )
        
    def run(self) -> EvaluationMetrics:
        """Execute full calibration + evaluation pipeline"""
        print(f"\n{'='*80}")
        print(f"CALIBRATION & EVALUATION: {self.config.variable.upper()}")
        print(f"{'='*80}\n")
        
        # Load model and data
        print("[1/8] Loading model and validation data...")
        self._load_model()
        self._load_validation_data()
        
        # Calibrate
        if self.config.task == 'regression':
            print("[2/8] Calibrating regression model (Isotonic)...")
            self._calibrate_regression()
        else:
            print("[2/8] Calibrating classifier (Isotonic/Platt)...")
            self._calibrate_classifier()
        
        # Compute metrics
        print("[3/8] Computing overall metrics...")
        self._compute_overall_metrics()
        
        print("[4/8] Computing length-specific metrics...")
        self._compute_length_metrics()
        
        print("[5/8] Computing language-specific metrics...")
        self._compute_language_metrics()
        
        print("[6/8] Computing calibration metrics...")
        self._compute_calibration_metrics()
        
        # Leakage validation
        print("[7/8] Validating temporal/user leakage...")
        self._validate_leakage()
        
        # Generate reports and plots
        print("[8/8] Generating reports and plots...")
        self._save_metrics_report()
        if self.config.create_plots:
            self._create_plots()
        
        print(f"\n{'='*80}")
        print("EVALUATION COMPLETE")
        print(f"{'='*80}\n")
        
        self._print_summary()
        
        return self.metrics
    
    def _load_model(self):
        """Load trained model"""
        model_path = self.config.model_path
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        # Load LGBM model (or classifier)
        self.model = lgb.Booster(model_file=str(model_path))
        print(f"  ✓ Loaded model from {model_path}")
    
    def _load_validation_data(self):
        """Load validation features and targets"""
        val_path = self.config.data_dir / "features" / "val_features.jsonl"
        if not val_path.exists():
            raise FileNotFoundError(f"Validation data not found: {val_path}")
        
        # Load features
        from train_perception import PerceptionTrainer
        trainer = PerceptionTrainer(config=None)  # Only using as feature extractor
        
        items = []
        with open(val_path, 'r', encoding='utf-8') as f:
            for line in f:
                items.append(json.loads(line))
        
        # Extract features
        self.X_val = []
        self.y_val = []
        self.val_metadata = []
        
        for item in items:
            # Combined features (lexical + embedding)
            lex = item.get('lexical_features', {})
            emb = item.get('embedding_features', {})
            
            lex_vec = [
                lex.get('lex_valence', 0.0),
                lex.get('lex_arousal', 0.0),
                lex.get('word_count', 0),
                lex.get('emoji_count', 0),
                lex.get('punct_count', 0),
                lex.get('intensifiers', 0),
                lex.get('diminishers', 0),
                lex.get('negations', 0),
                lex.get('profanity_score', 0.0),
                lex.get('joy', 0.0),
                lex.get('sadness', 0.0),
                lex.get('anger', 0.0),
                lex.get('fear', 0.0),
                lex.get('trust', 0.0),
                lex.get('surprise', 0.0),
            ]
            
            emb_vec = emb.get('sentence_embedding', [0.0] * 384)
            anchor_sims = emb.get('anchor_similarities', {})
            anchor_vec = [
                anchor_sims.get('joy', 0.0),
                anchor_sims.get('sadness', 0.0),
                anchor_sims.get('anger', 0.0),
                anchor_sims.get('fear', 0.0),
                anchor_sims.get('calm', 0.0),
                anchor_sims.get('excited', 0.0),
            ]
            
            combined = lex_vec + emb_vec + anchor_vec
            self.X_val.append(combined)
            
            # Target
            labels = item.get('perception_labels', {})
            if self.config.task == 'regression':
                self.y_val.append(labels.get(self.config.variable, 0.5))
            else:
                # Classification: invoked/expressed
                self.y_val.append(labels.get(self.config.variable, 'none'))
            
            # Metadata
            self.val_metadata.append({
                'owner_id': item.get('owner_id', 'unknown'),
                'timestamp': item.get('timestamp', 0),
                'language': item.get('language', 'en'),
                'length_bucket': item.get('length_bucket', 'SHORT'),
                'word_count': lex.get('word_count', 0)
            })
        
        self.X_val = np.array(self.X_val, dtype=np.float32)
        
        if self.config.task == 'regression':
            self.y_val = np.array(self.y_val, dtype=np.float32)
        else:
            # Encode labels
            from sklearn.preprocessing import LabelEncoder
            self.label_encoder = LabelEncoder()
            self.y_val = self.label_encoder.fit_transform(self.y_val)
        
        self.metrics.n_total = len(self.y_val)
        print(f"  ✓ Loaded {self.metrics.n_total} validation samples")
    
    def _calibrate_regression(self):
        """Isotonic calibration for regression"""
        # Get base predictions
        y_pred_base = self.model.predict(self.X_val)
        
        # Isotonic regression (monotonic mapping)
        if self.config.use_isotonic:
            self.calibrated_model_isotonic = IsotonicRegression(out_of_bounds='clip')
            self.calibrated_model_isotonic.fit(y_pred_base, self.y_val)
            
            y_pred_cal = self.calibrated_model_isotonic.predict(y_pred_base)
            
            rmse_base = np.sqrt(mean_squared_error(self.y_val, y_pred_base))
            rmse_cal = np.sqrt(mean_squared_error(self.y_val, y_pred_cal))
            
            print(f"  ✓ Isotonic: RMSE {rmse_base:.4f} → {rmse_cal:.4f} ({(rmse_cal - rmse_base) / rmse_base * 100:+.1f}%)")
        
        # Platt scaling not applicable to regression
    
    def _calibrate_classifier(self):
        """Isotonic/Platt calibration for classification"""
        # For LGBM classifier, need to use CalibratedClassifierCV
        # This is placeholder - actual implementation depends on classifier type
        print("  ⚠ Classifier calibration not yet implemented (requires classifier wrapper)")
    
    def _compute_overall_metrics(self):
        """Compute overall metrics (all samples)"""
        # Get predictions (use calibrated if available)
        if self.config.task == 'regression':
            y_pred_base = self.model.predict(self.X_val)
            
            if self.calibrated_model_isotonic is not None:
                y_pred = self.calibrated_model_isotonic.predict(y_pred_base)
            else:
                y_pred = y_pred_base
            
            # Regression metrics
            self.metrics.rmse = np.sqrt(mean_squared_error(self.y_val, y_pred))
            self.metrics.mae = mean_absolute_error(self.y_val, y_pred)
            self.metrics.r2 = r2_score(self.y_val, y_pred)
            
            if len(np.unique(self.y_val)) > 1:  # Avoid single-value correlation
                self.metrics.pearson_r, _ = pearsonr(self.y_val, y_pred)
                self.metrics.spearman_r, _ = spearmanr(self.y_val, y_pred)
            else:
                self.metrics.pearson_r = 0.0
                self.metrics.spearman_r = 0.0
            
            print(f"  ✓ RMSE: {self.metrics.rmse:.4f}, MAE: {self.metrics.mae:.4f}, R²: {self.metrics.r2:.4f}")
            print(f"    Pearson r: {self.metrics.pearson_r:.3f}, Spearman r: {self.metrics.spearman_r:.3f}")
        
        else:
            # Classification metrics
            y_pred = self.model.predict(self.X_val)
            y_pred_labels = np.argmax(y_pred, axis=1) if y_pred.ndim > 1 else y_pred
            
            self.metrics.accuracy = np.mean(y_pred_labels == self.y_val)
            
            precision, recall, f1, _ = precision_recall_fscore_support(
                self.y_val, y_pred_labels, average=None, zero_division=0
            )
            
            self.metrics.macro_f1 = f1_score(self.y_val, y_pred_labels, average='macro', zero_division=0)
            self.metrics.micro_f1 = f1_score(self.y_val, y_pred_labels, average='micro', zero_division=0)
            self.metrics.weighted_f1 = f1_score(self.y_val, y_pred_labels, average='weighted', zero_division=0)
            
            print(f"  ✓ Accuracy: {self.metrics.accuracy:.3f}")
            print(f"    Macro-F1: {self.metrics.macro_f1:.3f}, Micro-F1: {self.metrics.micro_f1:.3f}")
    
    def _compute_length_metrics(self):
        """Compute metrics by length bucket"""
        buckets = ['SHORT', 'MEDIUM', 'LONG']
        
        for bucket in buckets:
            indices = [i for i, m in enumerate(self.val_metadata) if m['length_bucket'] == bucket]
            if not indices:
                continue
            
            X_subset = self.X_val[indices]
            y_subset = self.y_val[indices]
            
            if self.config.task == 'regression':
                y_pred_base = self.model.predict(X_subset)
                if self.calibrated_model_isotonic is not None:
                    y_pred = self.calibrated_model_isotonic.predict(y_pred_base)
                else:
                    y_pred = y_pred_base
                
                rmse = np.sqrt(mean_squared_error(y_subset, y_pred))
                
                if bucket == 'SHORT':
                    self.metrics.rmse_short = rmse
                    self.metrics.n_short = len(indices)
                elif bucket == 'MEDIUM':
                    self.metrics.rmse_medium = rmse
                    self.metrics.n_medium = len(indices)
                elif bucket == 'LONG':
                    self.metrics.rmse_long = rmse
                    self.metrics.n_long = len(indices)
                
                print(f"  ✓ {bucket:6s}: RMSE {rmse:.4f} (n={len(indices)})")
            
            else:
                # Classification
                y_pred = self.model.predict(X_subset)
                y_pred_labels = np.argmax(y_pred, axis=1) if y_pred.ndim > 1 else y_pred
                
                f1 = f1_score(y_subset, y_pred_labels, average='macro', zero_division=0)
                
                if bucket == 'SHORT':
                    self.metrics.f1_short = f1
                    self.metrics.n_short = len(indices)
                elif bucket == 'MEDIUM':
                    self.metrics.f1_medium = f1
                    self.metrics.n_medium = len(indices)
                elif bucket == 'LONG':
                    self.metrics.f1_long = f1
                    self.metrics.n_long = len(indices)
                
                print(f"  ✓ {bucket:6s}: Macro-F1 {f1:.3f} (n={len(indices)})")
    
    def _compute_language_metrics(self):
        """Compute metrics by language"""
        languages = ['en', 'hinglish']
        
        for lang in languages:
            indices = [i for i, m in enumerate(self.val_metadata) if m['language'] == lang]
            if not indices:
                continue
            
            X_subset = self.X_val[indices]
            y_subset = self.y_val[indices]
            
            if self.config.task == 'regression':
                y_pred_base = self.model.predict(X_subset)
                if self.calibrated_model_isotonic is not None:
                    y_pred = self.calibrated_model_isotonic.predict(y_pred_base)
                else:
                    y_pred = y_pred_base
                
                rmse = np.sqrt(mean_squared_error(y_subset, y_pred))
                
                if lang == 'en':
                    self.metrics.rmse_en = rmse
                    self.metrics.n_en = len(indices)
                else:
                    self.metrics.rmse_hinglish = rmse
                    self.metrics.n_hinglish = len(indices)
                
                print(f"  ✓ {lang:8s}: RMSE {rmse:.4f} (n={len(indices)})")
            
            else:
                y_pred = self.model.predict(X_subset)
                y_pred_labels = np.argmax(y_pred, axis=1) if y_pred.ndim > 1 else y_pred
                
                f1 = f1_score(y_subset, y_pred_labels, average='macro', zero_division=0)
                
                if lang == 'en':
                    self.metrics.f1_en = f1
                    self.metrics.n_en = len(indices)
                else:
                    self.metrics.f1_hinglish = f1
                    self.metrics.n_hinglish = len(indices)
                
                print(f"  ✓ {lang:8s}: Macro-F1 {f1:.3f} (n={len(indices)})")
    
    def _compute_calibration_metrics(self):
        """Compute ECE, MCE, Brier score"""
        if self.config.task == 'regression':
            # ECE for regression (binned predictions vs actual)
            y_pred_base = self.model.predict(self.X_val)
            if self.calibrated_model_isotonic is not None:
                y_pred = self.calibrated_model_isotonic.predict(y_pred_base)
            else:
                y_pred = y_pred_base
            
            ece, mce = self._compute_ece_regression(y_pred, self.y_val, n_bins=10)
            self.metrics.ece = ece
            self.metrics.mce = mce
            
            print(f"  ✓ ECE: {ece:.4f}, MCE: {mce:.4f}")
        
        else:
            # Classification calibration
            y_pred_proba = self.model.predict(self.X_val)
            
            # Brier score (for binary/multiclass)
            if y_pred_proba.ndim == 1:
                # Binary
                self.metrics.brier_score = brier_score_loss(self.y_val, y_pred_proba)
            else:
                # Multiclass: average Brier across classes
                from sklearn.preprocessing import label_binarize
                n_classes = y_pred_proba.shape[1]
                y_bin = label_binarize(self.y_val, classes=range(n_classes))
                self.metrics.brier_score = np.mean((y_pred_proba - y_bin) ** 2)
            
            # Log loss
            self.metrics.log_loss_val = log_loss(self.y_val, y_pred_proba)
            
            print(f"  ✓ Brier: {self.metrics.brier_score:.4f}, Log-loss: {self.metrics.log_loss_val:.4f}")
    
    def _compute_ece_regression(self, y_pred, y_true, n_bins=10):
        """Expected Calibration Error for regression"""
        # Bin predictions
        bin_edges = np.linspace(0, 1, n_bins + 1)
        bin_indices = np.digitize(y_pred, bin_edges) - 1
        bin_indices = np.clip(bin_indices, 0, n_bins - 1)
        
        ece = 0.0
        mce = 0.0
        
        for i in range(n_bins):
            mask = bin_indices == i
            if not np.any(mask):
                continue
            
            bin_pred = y_pred[mask]
            bin_true = y_true[mask]
            
            avg_pred = np.mean(bin_pred)
            avg_true = np.mean(bin_true)
            
            bin_error = abs(avg_pred - avg_true)
            ece += (len(bin_pred) / len(y_pred)) * bin_error
            mce = max(mce, bin_error)
        
        return ece, mce
    
    def _validate_leakage(self):
        """Check for temporal and user leakage"""
        # Temporal leakage: Check if validation timestamps < train timestamps
        train_path = self.config.data_dir / "features" / "train_features.jsonl"
        if not train_path.exists():
            print("  ⚠ Train data not found, skipping leakage validation")
            return
        
        # Load train timestamps
        train_timestamps = []
        with open(train_path, 'r', encoding='utf-8') as f:
            for line in f:
                item = json.loads(line)
                train_timestamps.append(item.get('timestamp', 0))
        
        # Load val timestamps (already have in metadata)
        val_timestamps = [m['timestamp'] for m in self.val_metadata]
        
        # Check temporal overlap
        min_val_ts = min(val_timestamps)
        max_train_ts = max(train_timestamps)
        
        if min_val_ts <= max_train_ts + (self.config.embargo_days * 86400):
            self.metrics.temporal_leakage_detected = True
            print(f"  ⚠ TEMPORAL LEAKAGE DETECTED: Val min ({min_val_ts}) within {self.config.embargo_days}d of train max ({max_train_ts})")
        else:
            print(f"  ✓ No temporal leakage (embargo: {self.config.embargo_days}d)")
        
        # User leakage: Check if val users in train users
        train_users = set()
        with open(train_path, 'r', encoding='utf-8') as f:
            for line in f:
                item = json.loads(line)
                train_users.add(item.get('owner_id', 'unknown'))
        
        val_users = set(m['owner_id'] for m in self.val_metadata)
        
        overlap_users = train_users & val_users
        if overlap_users:
            self.metrics.user_leakage_detected = True
            print(f"  ⚠ USER LEAKAGE DETECTED: {len(overlap_users)} users overlap between train/val")
        else:
            print(f"  ✓ No user leakage")
    
    def _save_metrics_report(self):
        """Save JSON metrics report"""
        output_dir = self.config.output_dir / self.config.variable
        output_dir.mkdir(parents=True, exist_ok=True)
        
        report_path = output_dir / "evaluation_report.json"
        
        report = {
            "variable": self.config.variable,
            "task": self.config.task,
            "timestamp": "2025-11-02T00:00:00Z",  # Placeholder
            "metrics": asdict(self.metrics),
            "config": {
                "model_path": str(self.config.model_path),
                "calibration_isotonic": self.config.use_isotonic,
                "calibration_platt": self.config.use_platt,
                "embargo_days": self.config.embargo_days,
            }
        }
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        print(f"  ✓ Saved report: {report_path}")
    
    def _create_plots(self):
        """Generate calibration curves, confusion matrices, etc."""
        output_dir = self.config.output_dir / self.config.variable
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if self.config.task == 'regression':
            self._plot_calibration_curve(output_dir)
            self._plot_residuals(output_dir)
        else:
            self._plot_confusion_matrix(output_dir)
            self._plot_class_distribution(output_dir)
        
        print(f"  ✓ Plots saved to {output_dir}")
    
    def _plot_calibration_curve(self, output_dir):
        """Plot calibration curve for regression"""
        y_pred_base = self.model.predict(self.X_val)
        if self.calibrated_model_isotonic is not None:
            y_pred_cal = self.calibrated_model_isotonic.predict(y_pred_base)
        else:
            y_pred_cal = y_pred_base
        
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        
        # Before calibration
        axes[0].scatter(y_pred_base, self.y_val, alpha=0.3, s=10)
        axes[0].plot([0, 1], [0, 1], 'r--', label='Perfect calibration')
        axes[0].set_xlabel('Predicted')
        axes[0].set_ylabel('Actual')
        axes[0].set_title('Before Calibration')
        axes[0].legend()
        axes[0].grid(True, alpha=0.3)
        
        # After calibration
        axes[1].scatter(y_pred_cal, self.y_val, alpha=0.3, s=10)
        axes[1].plot([0, 1], [0, 1], 'r--', label='Perfect calibration')
        axes[1].set_xlabel('Predicted (calibrated)')
        axes[1].set_ylabel('Actual')
        axes[1].set_title('After Isotonic Calibration')
        axes[1].legend()
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_dir / f'calibration_curve.{self.config.plot_format}', dpi=150)
        plt.close()
    
    def _plot_residuals(self, output_dir):
        """Plot residuals distribution"""
        y_pred_base = self.model.predict(self.X_val)
        residuals = self.y_val - y_pred_base
        
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        
        # Residuals scatter
        axes[0].scatter(y_pred_base, residuals, alpha=0.3, s=10)
        axes[0].axhline(0, color='r', linestyle='--')
        axes[0].set_xlabel('Predicted')
        axes[0].set_ylabel('Residuals')
        axes[0].set_title('Residual Plot')
        axes[0].grid(True, alpha=0.3)
        
        # Residuals histogram
        axes[1].hist(residuals, bins=30, alpha=0.7, edgecolor='black')
        axes[1].axvline(0, color='r', linestyle='--')
        axes[1].set_xlabel('Residuals')
        axes[1].set_ylabel('Frequency')
        axes[1].set_title('Residual Distribution')
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_dir / f'residuals.{self.config.plot_format}', dpi=150)
        plt.close()
    
    def _plot_confusion_matrix(self, output_dir):
        """Plot confusion matrix for classification"""
        y_pred = self.model.predict(self.X_val)
        y_pred_labels = np.argmax(y_pred, axis=1) if y_pred.ndim > 1 else y_pred
        
        cm = confusion_matrix(self.y_val, y_pred_labels)
        
        plt.figure(figsize=(8, 6))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                    xticklabels=self.label_encoder.classes_,
                    yticklabels=self.label_encoder.classes_)
        plt.xlabel('Predicted')
        plt.ylabel('Actual')
        plt.title(f'Confusion Matrix: {self.config.variable}')
        plt.tight_layout()
        plt.savefig(output_dir / f'confusion_matrix.{self.config.plot_format}', dpi=150)
        plt.close()
    
    def _plot_class_distribution(self, output_dir):
        """Plot class distribution"""
        y_pred = self.model.predict(self.X_val)
        y_pred_labels = np.argmax(y_pred, axis=1) if y_pred.ndim > 1 else y_pred
        
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        
        # Actual distribution
        axes[0].hist(self.y_val, bins=len(self.label_encoder.classes_), alpha=0.7, edgecolor='black')
        axes[0].set_xlabel('Class')
        axes[0].set_ylabel('Frequency')
        axes[0].set_title('Actual Class Distribution')
        axes[0].grid(True, alpha=0.3)
        
        # Predicted distribution
        axes[1].hist(y_pred_labels, bins=len(self.label_encoder.classes_), alpha=0.7, edgecolor='black', color='orange')
        axes[1].set_xlabel('Class')
        axes[1].set_ylabel('Frequency')
        axes[1].set_title('Predicted Class Distribution')
        axes[1].grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(output_dir / f'class_distribution.{self.config.plot_format}', dpi=150)
        plt.close()
    
    def _print_summary(self):
        """Print final summary"""
        print("\n" + "="*80)
        print(f"EVALUATION SUMMARY: {self.config.variable.upper()}")
        print("="*80)
        
        if self.config.task == 'regression':
            print(f"\n[Regression Metrics]")
            print(f"  RMSE:      {self.metrics.rmse:.4f}")
            print(f"  MAE:       {self.metrics.mae:.4f}")
            print(f"  R²:        {self.metrics.r2:.4f}")
            print(f"  Pearson:   {self.metrics.pearson_r:.3f}")
            print(f"  Spearman:  {self.metrics.spearman_r:.3f}")
            print(f"  ECE:       {self.metrics.ece:.4f}")
            print(f"  MCE:       {self.metrics.mce:.4f}")
            
            print(f"\n[Length-Specific]")
            if self.metrics.rmse_short is not None:
                print(f"  SHORT:   RMSE {self.metrics.rmse_short:.4f} (n={self.metrics.n_short})")
            if self.metrics.rmse_medium is not None:
                print(f"  MEDIUM:  RMSE {self.metrics.rmse_medium:.4f} (n={self.metrics.n_medium})")
            if self.metrics.rmse_long is not None:
                print(f"  LONG:    RMSE {self.metrics.rmse_long:.4f} (n={self.metrics.n_long})")
            
            print(f"\n[Language-Specific]")
            if self.metrics.rmse_en is not None:
                print(f"  EN:        RMSE {self.metrics.rmse_en:.4f} (n={self.metrics.n_en})")
            if self.metrics.rmse_hinglish is not None:
                print(f"  Hinglish:  RMSE {self.metrics.rmse_hinglish:.4f} (n={self.metrics.n_hinglish})")
        
        else:
            print(f"\n[Classification Metrics]")
            print(f"  Accuracy:    {self.metrics.accuracy:.3f}")
            print(f"  Macro-F1:    {self.metrics.macro_f1:.3f}")
            print(f"  Micro-F1:    {self.metrics.micro_f1:.3f}")
            print(f"  Weighted-F1: {self.metrics.weighted_f1:.3f}")
            print(f"  Brier:       {self.metrics.brier_score:.4f}")
            print(f"  Log-loss:    {self.metrics.log_loss_val:.4f}")
        
        print(f"\n[Leakage Validation]")
        print(f"  Temporal: {'❌ DETECTED' if self.metrics.temporal_leakage_detected else '✓ Clean'}")
        print(f"  User:     {'❌ DETECTED' if self.metrics.user_leakage_detected else '✓ Clean'}")
        
        print("\n" + "="*80 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Calibration & Evaluation")
    parser.add_argument("--variable", required=True, choices=['valence', 'arousal', 'willingness', 'invoked', 'expressed', 'congruence', 'comparator'])
    parser.add_argument("--model-path", required=True, type=Path, help="Path to trained model (e.g., models/valence_final.pkl)")
    parser.add_argument("--task", default="regression", choices=['regression', 'classification'])
    parser.add_argument("--data-dir", type=Path, default=Path("enrichment-worker/data"))
    parser.add_argument("--output-dir", type=Path, default=Path("enrichment-worker/reports"))
    parser.add_argument("--no-plots", action="store_true", help="Skip plot generation")
    
    args = parser.parse_args()
    
    config = CalibrationConfig(
        variable=args.variable,
        task=args.task,
        model_path=args.model_path,
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        create_plots=not args.no_plots
    )
    
    evaluator = CalibrationEvaluator(config)
    metrics = evaluator.run()
    
    print(f"\n✓ Evaluation complete. Metrics saved to {config.output_dir / config.variable}")


if __name__ == "__main__":
    main()
