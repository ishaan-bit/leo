"""
Temporal Sequence Modeling for Congruence/Comparator

GRU-based temporal model with:
- Sequence length: 32 timesteps (user history)
- Inputs: valence, arousal, invoked_proba[6], expressed_proba[6], EMA features, metadata
- Outputs: congruence (valence shift expectation), comparator (arousal shift expectation)
- Loss: MSE(v_expected) + MSE(a_expected) + CE(primary_expected) + λ*Smoothness
- Optuna HPO with acceptance gates

Usage:
    python scripts/train_temporal.py --variable congruence --seq_len 32 --device NPU --hpo
    python scripts/train_temporal.py --variable comparator --seq_len 32 --device GPU --hpo
"""

import argparse
import json
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

import optuna
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import (
    mean_squared_error,
    mean_absolute_error,
    r2_score
)
from scipy.stats import pearsonr, spearmanr

# Intel Extension for PyTorch (optional but recommended for Arc GPU)
try:
    import intel_extension_for_pytorch as ipex
    IPEX_AVAILABLE = True
except ImportError:
    IPEX_AVAILABLE = False


@dataclass
class TemporalConfig:
    """Configuration for temporal model training"""
    variable: str  # 'congruence' or 'comparator'
    seq_len: int = 32
    hidden_size: int = 128
    num_layers: int = 2
    dropout: float = 0.1
    learning_rate: float = 3e-4
    batch_size: int = 32
    epochs: int = 50
    warmup_ratio: float = 0.1
    smoothness_weight: float = 0.05
    
    # Feature dimensions
    num_scalar_features: int = 2  # v, a
    num_emotion_features: int = 12  # invoked[6] + expressed[6]
    num_ema_features: int = 6  # v_ema_1d, v_ema_7d, v_ema_28d, a_ema_1d, a_ema_7d, a_ema_28d
    num_meta_features: int = 3  # hour_bucket, length_bucket, risk_flags
    
    # Paths
    data_dir: Path = Path("enrichment-worker/data/splits")
    output_dir: Path = Path("enrichment-worker/models/temporal")
    
    # Training
    n_folds: int = 5
    device: str = "GPU"  # GPU, NPU, or CPU
    early_stop_patience: int = 10
    
    # HPO
    n_trials: int = 40
    hpo_enabled: bool = False


class TemporalGRU(nn.Module):
    """GRU-based temporal sequence model"""
    
    def __init__(self, config: TemporalConfig):
        super().__init__()
        self.config = config
        
        # Calculate total input size per timestep
        self.input_size = (
            config.num_scalar_features +  # v, a
            config.num_emotion_features +  # invoked[6], expressed[6]
            config.num_ema_features +      # EMA features
            config.num_meta_features       # metadata
        )
        
        # GRU layers
        self.gru = nn.GRU(
            input_size=self.input_size,
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0.0,
            batch_first=True,
            bidirectional=False
        )
        
        # Output heads
        self.dropout = nn.Dropout(config.dropout)
        
        # Regression head (v_expected, a_expected)
        self.regression_head = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.hidden_size // 2, 2)  # v_expected, a_expected
        )
        
        # Primary emotion classification head (6 classes)
        self.classification_head = nn.Sequential(
            nn.Linear(config.hidden_size, config.hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(config.dropout),
            nn.Linear(config.hidden_size // 2, 6)  # 6 primary emotions
        )
    
    def forward(self, x: torch.Tensor, lengths: Optional[torch.Tensor] = None) -> Dict[str, torch.Tensor]:
        """
        Args:
            x: [batch, seq_len, input_size]
            lengths: [batch] actual sequence lengths (optional)
        
        Returns:
            Dict with 'regression' [batch, 2], 'classification' [batch, 6]
        """
        batch_size = x.size(0)
        
        # Pack sequences if lengths provided
        if lengths is not None:
            x_packed = nn.utils.rnn.pack_padded_sequence(
                x, lengths.cpu(), batch_first=True, enforce_sorted=False
            )
            gru_out, hidden = self.gru(x_packed)
            gru_out, _ = nn.utils.rnn.pad_packed_sequence(gru_out, batch_first=True)
        else:
            gru_out, hidden = self.gru(x)
        
        # Use last hidden state
        if self.config.num_layers > 1:
            last_hidden = hidden[-1]  # [batch, hidden_size]
        else:
            last_hidden = hidden.squeeze(0)
        
        last_hidden = self.dropout(last_hidden)
        
        # Compute outputs
        regression_out = self.regression_head(last_hidden)  # [batch, 2]
        classification_out = self.classification_head(last_hidden)  # [batch, 6]
        
        return {
            'regression': regression_out,
            'classification': classification_out,
            'hidden': last_hidden
        }


class TemporalDataset(Dataset):
    """Dataset for temporal sequence modeling"""
    
    def __init__(self, data_path: Path, seq_len: int = 32, variable: str = 'congruence'):
        self.data = self._load_data(data_path)
        self.seq_len = seq_len
        self.variable = variable
        
        # Build user sequences
        self.sequences = self._build_sequences()
    
    def _load_data(self, path: Path) -> List[Dict]:
        """Load split data"""
        with open(path, 'r', encoding='utf-8') as f:
            return [json.loads(line) for line in f]
    
    def _build_sequences(self) -> List[Dict]:
        """Build temporal sequences grouped by user"""
        from collections import defaultdict
        
        # Group by user
        user_data = defaultdict(list)
        for item in self.data:
            user_id = item.get('user_id', 'unknown')
            user_data[user_id].append(item)
        
        # Sort by timestamp and create sequences
        sequences = []
        for user_id, items in user_data.items():
            # Sort by timestamp
            items_sorted = sorted(items, key=lambda x: x.get('timestamp', 0))
            
            # Create overlapping sequences of length seq_len
            for i in range(len(items_sorted)):
                # Get sequence up to current point (max seq_len)
                start_idx = max(0, i - self.seq_len + 1)
                seq_items = items_sorted[start_idx:i+1]
                
                # Current item is the target
                target_item = items_sorted[i]
                
                sequences.append({
                    'user_id': user_id,
                    'sequence': seq_items,
                    'target': target_item,
                    'seq_length': len(seq_items)
                })
        
        return sequences
    
    def _extract_features(self, item: Dict) -> np.ndarray:
        """Extract features for a single timestep"""
        features = []
        
        # Scalar features (v, a)
        features.append(item.get('valence', 0.5))
        features.append(item.get('arousal', 0.5))
        
        # Emotion features (invoked[6], expressed[6])
        invoked = item.get('invoked_proba', [0.0] * 6)
        expressed = item.get('expressed_proba', [0.0] * 6)
        features.extend(invoked[:6])
        features.extend(expressed[:6])
        
        # EMA features
        features.append(item.get('v_ema_1d', 0.5))
        features.append(item.get('v_ema_7d', 0.5))
        features.append(item.get('v_ema_28d', 0.5))
        features.append(item.get('a_ema_1d', 0.5))
        features.append(item.get('a_ema_7d', 0.5))
        features.append(item.get('a_ema_28d', 0.5))
        
        # Metadata features
        hour = item.get('hour', 12) / 24.0  # Normalize to [0, 1]
        length = min(item.get('length', 50), 500) / 500.0  # Normalize
        risk_flags = float(item.get('risk_flag', 0))
        features.extend([hour, length, risk_flags])
        
        return np.array(features, dtype=np.float32)
    
    def __len__(self) -> int:
        return len(self.sequences)
    
    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        seq_data = self.sequences[idx]
        sequence = seq_data['sequence']
        target = seq_data['target']
        seq_length = seq_data['seq_length']
        
        # Extract features for each timestep
        features = np.zeros((self.seq_len, 23), dtype=np.float32)  # 23 total features
        for i, item in enumerate(sequence):
            features[i] = self._extract_features(item)
        
        # Pad if needed
        if seq_length < self.seq_len:
            # Already zero-padded from initialization
            pass
        
        # Target values
        v_target = target.get('valence', 0.5)
        a_target = target.get('arousal', 0.5)
        
        # Expected shifts (for congruence/comparator)
        v_expected = target.get(f'{self.variable}_v_expected', v_target)
        a_expected = target.get(f'{self.variable}_a_expected', a_target)
        
        # Primary emotion (for classification)
        primary_label = target.get('invoked_primary', 0)  # Default to 'sad'
        
        return {
            'features': torch.from_numpy(features),
            'seq_length': torch.tensor(seq_length, dtype=torch.long),
            'regression_target': torch.tensor([v_expected, a_expected], dtype=torch.float32),
            'classification_target': torch.tensor(primary_label, dtype=torch.long)
        }


class SmoothnessLoss(nn.Module):
    """Temporal smoothness regularization"""
    
    def __init__(self, weight: float = 0.05):
        super().__init__()
        self.weight = weight
    
    def forward(self, predictions: torch.Tensor, seq_lengths: torch.Tensor) -> torch.Tensor:
        """
        Args:
            predictions: [batch, seq_len, output_dim]
            seq_lengths: [batch]
        
        Returns:
            Scalar smoothness loss
        """
        if predictions.size(1) < 2:
            return torch.tensor(0.0, device=predictions.device)
        
        # Compute differences between consecutive predictions
        diffs = predictions[:, 1:, :] - predictions[:, :-1, :]
        
        # L2 norm of differences
        smoothness = torch.mean(diffs ** 2)
        
        return self.weight * smoothness


class TemporalTrainer:
    """Trainer for temporal GRU models"""
    
    def __init__(self, config: TemporalConfig):
        self.config = config
        self.config.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Device setup
        self.device = self._setup_device()
        
        # Load data
        self.train_loader = None
        self.val_loader = None
        
        # Best model tracking
        self.best_model = None
        self.best_metrics = {}
    
    def _setup_device(self) -> torch.device:
        """Setup device (GPU/NPU/CPU)"""
        if self.config.device.upper() == "XPU" and hasattr(torch, 'xpu') and torch.xpu.is_available():
            print(f"✓ Using Intel Arc GPU (XPU): {torch.xpu.device_count()} device(s)")
            return torch.device("xpu")
        elif self.config.device.upper() == "GPU" and torch.cuda.is_available():
            return torch.device("cuda")
        elif self.config.device.upper() == "NPU":
            # Intel NPU not yet supported in PyTorch, fall back to CPU
            print("⚠️ NPU requested but not yet supported, using CPU")
            return torch.device("cpu")
        else:
            return torch.device("cpu")
    
    def _load_fold_data(self, fold: int):
        """Load train/val data for a fold"""
        train_path = self.config.data_dir / f"fold_{fold}_train.jsonl"
        val_path = self.config.data_dir / f"fold_{fold}_val.jsonl"
        
        train_dataset = TemporalDataset(train_path, self.config.seq_len, self.config.variable)
        val_dataset = TemporalDataset(val_path, self.config.seq_len, self.config.variable)
        
        self.train_loader = DataLoader(
            train_dataset,
            batch_size=self.config.batch_size,
            shuffle=True,
            num_workers=0,
            pin_memory=True if self.device.type == "cuda" else False
        )
        
        self.val_loader = DataLoader(
            val_dataset,
            batch_size=self.config.batch_size,
            shuffle=False,
            num_workers=0,
            pin_memory=True if self.device.type == "cuda" else False
        )
    
    def train(self) -> Dict:
        """Train with cross-validation"""
        print(f"\n{'='*60}")
        print(f"TEMPORAL MODEL TRAINING: {self.config.variable.upper()}")
        print(f"{'='*60}\n")
        
        if self.config.hpo_enabled:
            print(f"[1/3] Running Optuna HPO ({self.config.n_trials} trials)...")
            best_params = self._run_optuna()
            
            # Update config with best params
            for key, value in best_params.items():
                setattr(self.config, key, value)
        
        print(f"\n[2/3] Training final model with 5-fold CV...")
        fold_metrics = []
        
        for fold in range(self.config.n_folds):
            print(f"\n--- Fold {fold + 1}/{self.config.n_folds} ---")
            self._load_fold_data(fold)
            
            metrics = self._train_single_fold(fold)
            fold_metrics.append(metrics)
        
        # Aggregate metrics
        avg_metrics = self._aggregate_metrics(fold_metrics)
        
        print(f"\n[3/3] Checking acceptance gates...")
        acceptance_passed = self._check_acceptance(avg_metrics)
        
        # Save final model
        self._save_final_model(acceptance_passed)
        
        return avg_metrics
    
    def _run_optuna(self) -> Dict:
        """Run Optuna hyperparameter optimization"""
        
        def objective(trial: optuna.Trial) -> float:
            # Sample hyperparameters
            config = TemporalConfig(
                variable=self.config.variable,
                seq_len=self.config.seq_len,
                hidden_size=trial.suggest_categorical('hidden_size', [64, 128, 256]),
                num_layers=trial.suggest_int('num_layers', 1, 2),
                dropout=trial.suggest_float('dropout', 0.0, 0.2),
                learning_rate=trial.suggest_float('learning_rate', 1e-4, 5e-4, log=True),
                batch_size=self.config.batch_size,
                epochs=trial.suggest_int('epochs', 30, 50),
                warmup_ratio=trial.suggest_float('warmup_ratio', 0.05, 0.15),
                smoothness_weight=trial.suggest_float('smoothness_weight', 0.01, 0.1),
                data_dir=self.config.data_dir,
                output_dir=self.config.output_dir,
                n_folds=1,  # Use only fold 0 for HPO
                device=self.config.device
            )
            
            # Train on fold 0
            self._load_fold_data(0)
            metrics = self._train_single_fold(0, trial=trial)
            
            # Optimize for RMSE
            return metrics['rmse']
        
        study = optuna.create_study(direction='minimize', study_name=f'temporal_{self.config.variable}')
        study.optimize(objective, n_trials=self.config.n_trials, show_progress_bar=True)
        
        print(f"\n✓ Best RMSE: {study.best_value:.4f}")
        print(f"✓ Best params: {study.best_params}")
        
        return study.best_params
    
    def _train_single_fold(self, fold: int, trial: Optional[optuna.Trial] = None) -> Dict:
        """Train on a single fold"""
        model = TemporalGRU(self.config).to(self.device)
        
        # Optimizer
        optimizer = torch.optim.AdamW(
            model.parameters(),
            lr=self.config.learning_rate,
            weight_decay=0.01
        )
        
        # Apply IPEX optimizations if available and using XPU
        if IPEX_AVAILABLE and self.device.type == 'xpu':
            model, optimizer = ipex.optimize(model, optimizer=optimizer, dtype=torch.bfloat16)
            print("✓ IPEX optimizations applied (BF16)")
        
        # Scheduler
        num_training_steps = len(self.train_loader) * self.config.epochs
        num_warmup_steps = int(num_training_steps * self.config.warmup_ratio)
        
        scheduler = torch.optim.lr_scheduler.OneCycleLR(
            optimizer,
            max_lr=self.config.learning_rate,
            total_steps=num_training_steps,
            pct_start=self.config.warmup_ratio,
            anneal_strategy='cos'
        )
        
        # Loss functions
        mse_loss = nn.MSELoss()
        ce_loss = nn.CrossEntropyLoss()
        smoothness_loss = SmoothnessLoss(self.config.smoothness_weight)
        
        # Mixed precision context for XPU
        use_amp = self.device.type == 'xpu'
        if use_amp:
            amp_ctx = torch.xpu.amp.autocast(enabled=True, dtype=torch.bfloat16)
        else:
            amp_ctx = torch.amp.autocast('cpu', enabled=False)
        
        # Training loop
        best_val_rmse = float('inf')
        patience_counter = 0
        
        for epoch in range(self.config.epochs):
            model.train()
            train_losses = []
            
            for batch in self.train_loader:
                features = batch['features'].to(self.device)
                seq_lengths = batch['seq_length'].to(self.device)
                reg_target = batch['regression_target'].to(self.device)
                cls_target = batch['classification_target'].to(self.device)
                
                # Forward pass with mixed precision
                with amp_ctx:
                    outputs = model(features, seq_lengths)
                    
                    # Compute losses
                    reg_loss = mse_loss(outputs['regression'], reg_target)
                    cls_loss = ce_loss(outputs['classification'], cls_target)
                    
                    # Total loss
                    loss = reg_loss + 0.3 * cls_loss
                
                # Backward pass
                optimizer.zero_grad()
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                
                train_losses.append(loss.item())
            
            # Validation
            val_metrics = self._evaluate(model, use_amp, amp_ctx if use_amp else None)
            
            # Early stopping
            if val_metrics['rmse'] < best_val_rmse:
                best_val_rmse = val_metrics['rmse']
                patience_counter = 0
                
                # Save best model for this fold
                if trial is None:  # Only save during final training
                    self.best_model = model.state_dict()
            else:
                patience_counter += 1
            
            if patience_counter >= self.config.early_stop_patience:
                print(f"  Early stopping at epoch {epoch + 1}")
                break
            
            # Report to Optuna
            if trial is not None:
                trial.report(val_metrics['rmse'], epoch)
                if trial.should_prune():
                    raise optuna.TrialPruned()
        
        return val_metrics
    
    def _evaluate(self, model: nn.Module, use_amp=False, amp_ctx=None) -> Dict:
        """Evaluate model on validation set"""
        model.eval()
        
        all_preds = []
        all_targets = []
        
        with torch.no_grad():
            for batch in self.val_loader:
                features = batch['features'].to(self.device)
                seq_lengths = batch['seq_length'].to(self.device)
                reg_target = batch['regression_target'].to(self.device)
                
                # Use AMP if enabled
                if use_amp and amp_ctx is not None:
                    with amp_ctx:
                        outputs = model(features, seq_lengths)
                else:
                    outputs = model(features, seq_lengths)
                
                all_preds.append(outputs['regression'].cpu().numpy())
                all_targets.append(reg_target.cpu().numpy())
        
        preds = np.vstack(all_preds)
        targets = np.vstack(all_targets)
        
        # Compute metrics
        rmse = np.sqrt(mean_squared_error(targets, preds))
        mae = mean_absolute_error(targets, preds)
        
        # Temporal correlation (average across v and a)
        r_v, _ = pearsonr(targets[:, 0], preds[:, 0])
        r_a, _ = pearsonr(targets[:, 1], preds[:, 1])
        temporal_r = (r_v + r_a) / 2.0
        
        return {
            'rmse': rmse,
            'mae': mae,
            'temporal_r': temporal_r,
            'r_v': r_v,
            'r_a': r_a
        }
    
    def _aggregate_metrics(self, fold_metrics: List[Dict]) -> Dict:
        """Aggregate metrics across folds"""
        aggregated = {}
        for key in fold_metrics[0].keys():
            values = [m[key] for m in fold_metrics]
            aggregated[key] = np.mean(values)
            aggregated[f'{key}_std'] = np.std(values)
        
        return aggregated
    
    def _check_acceptance(self, metrics: Dict) -> bool:
        """Check acceptance gates"""
        variable = self.config.variable
        
        # Variable-specific thresholds
        thresholds = {
            'congruence': {'rmse': 0.12, 'temporal_r': 0.55},
            'comparator': {'rmse': 0.12, 'temporal_r': 0.55}
        }
        
        thresh = thresholds[variable]
        
        checks = [
            ('RMSE', metrics['rmse'], '<=', thresh['rmse']),
            ('Temporal-r', metrics['temporal_r'], '>=', thresh['temporal_r']),
        ]
        
        print(f"\nACCEPTANCE CHECK: {variable.upper()}")
        passed_count = 0
        
        for name, value, op, threshold in checks:
            if op == '<=':
                passed = value <= threshold
            else:
                passed = value >= threshold
            
            status = "[OK]" if passed else "[FAIL]"
            print(f"  {status} {name}: {value:.4f} {op} {threshold}")
            
            if passed:
                passed_count += 1
        
        acceptance_passed = passed_count == len(checks)
        
        if acceptance_passed:
            print(f"\n✅ ACCEPTANCE PASSED ({passed_count}/{len(checks)} checks)")
        else:
            print(f"\n⚠️ ACCEPTANCE FAILED ({passed_count}/{len(checks)} checks)")
            print(f"  Model saved as '_pending' for inspection")
        
        return acceptance_passed
    
    def _save_final_model(self, acceptance_passed: bool):
        """Save final model"""
        status = "accepted" if acceptance_passed else "pending"
        model_path = self.config.output_dir / f"{self.config.variable}_final_{status}.pt"
        
        # Save model state dict
        torch.save(self.best_model, model_path)
        
        # Save config
        config_path = self.config.output_dir / f"{self.config.variable}_config.json"
        with open(config_path, 'w') as f:
            json.dump(asdict(self.config), f, indent=2, default=str)
        
        print(f"\n✓ Model saved: {model_path}")
        print(f"✓ Config saved: {config_path}")


def main():
    parser = argparse.ArgumentParser(description="Train temporal GRU model")
    parser.add_argument('--variable', type=str, required=True, choices=['congruence', 'comparator'])
    parser.add_argument('--seq_len', type=int, default=32)
    parser.add_argument('--hidden_size', type=int, default=128)
    parser.add_argument('--num_layers', type=int, default=2)
    parser.add_argument('--dropout', type=float, default=0.1)
    parser.add_argument('--lr', type=float, default=3e-4)
    parser.add_argument('--batch_size', type=int, default=32)
    parser.add_argument('--epochs', type=int, default=50)
    parser.add_argument('--cv', type=int, default=5)
    parser.add_argument('--device', type=str, default='GPU', choices=['GPU', 'NPU', 'CPU'])
    parser.add_argument('--hpo', action='store_true', help='Enable Optuna HPO')
    parser.add_argument('--n_trials', type=int, default=40)
    
    args = parser.parse_args()
    
    config = TemporalConfig(
        variable=args.variable,
        seq_len=args.seq_len,
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        dropout=args.dropout,
        learning_rate=args.lr,
        batch_size=args.batch_size,
        epochs=args.epochs,
        n_folds=args.cv,
        device=args.device,
        hpo_enabled=args.hpo,
        n_trials=args.n_trials
    )
    
    trainer = TemporalTrainer(config)
    metrics = trainer.train()
    
    print(f"\n{'='*60}")
    print(f"FINAL METRICS")
    print(f"{'='*60}")
    for key, value in metrics.items():
        print(f"{key}: {value:.4f}")


if __name__ == "__main__":
    main()
