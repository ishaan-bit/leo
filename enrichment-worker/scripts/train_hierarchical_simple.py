"""
Hierarchical Emotion Classification Training (Simplified - No HPO)

Transformer-based hierarchical classification without Optuna dependency
Uses fixed hyperparameters based on Stage-2 best config
"""

import argparse
import json
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from pathlib import Path
from typing import Dict, List, Tuple
from dataclasses import dataclass
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

from transformers import (
    AutoTokenizer,
    AutoModel,
    get_linear_schedule_with_warmup
)
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import f1_score, precision_recall_fscore_support
from scipy.special import softmax

# Load taxonomy from taxonomy_216.json
TAXONOMY_PATH = Path("enrichment-worker/data/curated/taxonomy_216.json")
with open(TAXONOMY_PATH, 'r') as f:
    TAXONOMY = json.load(f)

# Emotion hierarchy (6×6×6 structure)
EMOTION_HIERARCHY = TAXONOMY['nuances']  # {core: [nuances]}
PRIMARY_EMOTIONS = TAXONOMY['cores']  # ["Happy", "Strong", "Peaceful", "Sad", "Angry", "Fearful"]

# Flat indices
SECONDARY_EMOTIONS = []
for primary in PRIMARY_EMOTIONS:
    SECONDARY_EMOTIONS.extend(EMOTION_HIERARCHY[primary])  # 36 nuances total

PRIMARY_TO_IDX = {e: i for i, e in enumerate(PRIMARY_EMOTIONS)}
SECONDARY_TO_IDX = {e: i for i, e in enumerate(SECONDARY_EMOTIONS)}


@dataclass
class HierarchicalConfig:
    """Training configuration for hierarchical models"""
    variable: str  # 'invoked' or 'expressed'
    model_name: str = "roberta-base"
    
    # Data paths
    data_dir: Path = Path("enrichment-worker/data/splits")
    output_dir: Path = Path("enrichment-worker/models/hierarchical")
    
    # Training (fixed hyperparameters)
    max_epochs: int = 3
    batch_size: int = 8
    learning_rate: float = 3e-5
    warmup_ratio: float = 0.08
    dropout: float = 0.10
    focal_gamma: float = 2.5
    
    # Token budgets
    max_length: int = 512
    
    # Device
    device: str = "cpu"
    
    # Acceptance criteria
    acceptance_macro_f1: float = 0.75
    acceptance_hier_f1: float = 0.60
    acceptance_path_validity: float = 0.92
    
    # Early stopping
    early_stop_patience: int = 5


class HierarchicalDataset(Dataset):
    """Dataset for hierarchical emotion classification"""
    
    def __init__(self, data_path: Path, tokenizer, config: HierarchicalConfig):
        self.tokenizer = tokenizer
        self.config = config
        self.items = []
        
        with open(data_path, 'r', encoding='utf-8') as f:
            for line in f:
                item = json.loads(line)
                self.items.append(item)
    
    def __len__(self):
        return len(self.items)
    
    def __getitem__(self, idx):
        item = self.items[idx]
        
        # Get labels
        primary_field = f"{self.config.variable}_primary"
        secondary_field = f"{self.config.variable}_secondary"
        
        primary_idx = item[primary_field]
        secondary_name = item[secondary_field]
        secondary_idx = SECONDARY_TO_IDX[secondary_name]
        
        # Tokenize
        encoding = self.tokenizer(
            item['text'],
            max_length=self.config.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].squeeze(0),
            'attention_mask': encoding['attention_mask'].squeeze(0),
            'primary_label': primary_idx,
            'secondary_label': secondary_idx,
            'rid': item['rid']
        }


class FocalLoss(nn.Module):
    """Focal loss for handling class imbalance"""
    
    def __init__(self, gamma: float = 2.0, weight: torch.Tensor = None):
        super().__init__()
        self.gamma = gamma
        self.weight = weight
    
    def forward(self, inputs, targets):
        ce_loss = F.cross_entropy(inputs, targets, weight=self.weight, reduction='none')
        pt = torch.exp(-ce_loss)
        focal_loss = ((1 - pt) ** self.gamma) * ce_loss
        return focal_loss.mean()


class HierarchicalClassifier(nn.Module):
    """Hierarchical emotion classifier"""
    
    def __init__(self, config: HierarchicalConfig):
        super().__init__()
        self.config = config
        
        # Load pretrained transformer
        self.transformer = AutoModel.from_pretrained(config.model_name)
        hidden_size = self.transformer.config.hidden_size
        
        # Primary classifier head
        self.primary_head = nn.Sequential(
            nn.Dropout(config.dropout),
            nn.Linear(hidden_size, len(PRIMARY_EMOTIONS))
        )
        
        # Secondary classifier head (hierarchical)
        self.secondary_head = nn.Sequential(
            nn.Dropout(config.dropout),
            nn.Linear(hidden_size + len(PRIMARY_EMOTIONS), len(SECONDARY_EMOTIONS))
        )
    
    def forward(self, input_ids, attention_mask, primary_labels=None):
        # Get transformer embeddings
        outputs = self.transformer(input_ids=input_ids, attention_mask=attention_mask)
        pooled = outputs.last_hidden_state[:, 0, :]  # [CLS] token
        
        # Primary classification
        primary_logits = self.primary_head(pooled)
        
        # Secondary classification (conditioned on primary)
        if primary_labels is not None:
            # Training: use ground truth primary
            primary_one_hot = F.one_hot(primary_labels, num_classes=len(PRIMARY_EMOTIONS)).float()
        else:
            # Inference: use predicted primary
            primary_one_hot = F.softmax(primary_logits, dim=-1)
        
        combined = torch.cat([pooled, primary_one_hot], dim=-1)
        secondary_logits = self.secondary_head(combined)
        
        return primary_logits, secondary_logits


def validate(model, dataloader, config, device):
    """Validate model and compute metrics"""
    model.eval()
    
    all_primary_preds = []
    all_primary_labels = []
    all_secondary_preds = []
    all_secondary_labels = []
    
    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            primary_labels = batch['primary_label'].to(device)
            secondary_labels = batch['secondary_label'].to(device)
            
            primary_logits, secondary_logits = model(input_ids, attention_mask)
            
            primary_preds = torch.argmax(primary_logits, dim=-1)
            secondary_preds = torch.argmax(secondary_logits, dim=-1)
            
            all_primary_preds.extend(primary_preds.cpu().numpy())
            all_primary_labels.extend(primary_labels.cpu().numpy())
            all_secondary_preds.extend(secondary_preds.cpu().numpy())
            all_secondary_labels.extend(secondary_labels.cpu().numpy())
    
    # Compute primary metrics
    primary_macro_f1 = f1_score(all_primary_labels, all_primary_preds, average='macro')
    primary_micro_f1 = f1_score(all_primary_labels, all_primary_preds, average='micro')
    
    # Compute secondary metrics
    secondary_macro_f1 = f1_score(all_secondary_labels, all_secondary_preds, average='macro')
    
    # Compute hierarchical F1 (joint primary + secondary)
    correct_both = sum(1 for p1, p2, l1, l2 in zip(all_primary_preds, all_secondary_preds, 
                                                     all_primary_labels, all_secondary_labels)
                       if p1 == l1 and p2 == l2)
    hier_accuracy = correct_both / len(all_primary_labels)
    
    # Compute path validity (predicted secondary matches predicted primary)
    valid_paths = 0
    for primary_pred, secondary_pred in zip(all_primary_preds, all_secondary_preds):
        primary_name = PRIMARY_EMOTIONS[primary_pred]
        secondary_name = SECONDARY_EMOTIONS[secondary_pred]
        if secondary_name in EMOTION_HIERARCHY[primary_name]:
            valid_paths += 1
    
    path_validity = valid_paths / len(all_primary_preds)
    
    return {
        'primary_macro_f1': primary_macro_f1,
        'primary_micro_f1': primary_micro_f1,
        'secondary_macro_f1': secondary_macro_f1,
        'hier_accuracy': hier_accuracy,
        'hier_f1': hier_accuracy,  # Use accuracy as proxy for hier F1
        'path_validity': path_validity
    }


def train_fold(config: HierarchicalConfig, fold_idx: int):
    """Train on a single fold"""
    device = torch.device(config.device)
    print(f"\n{'='*60}")
    print(f"Training Fold {fold_idx}")
    print(f"{'='*60}")
    
    # Load tokenizer and data
    tokenizer = AutoTokenizer.from_pretrained(config.model_name)
    
    train_path = config.data_dir / f"fold_{fold_idx}_train.jsonl"
    val_path = config.data_dir / f"fold_{fold_idx}_val.jsonl"
    
    train_dataset = HierarchicalDataset(train_path, tokenizer, config)
    val_dataset = HierarchicalDataset(val_path, tokenizer, config)
    
    train_loader = DataLoader(train_dataset, batch_size=config.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=config.batch_size * 2)
    
    # Initialize model
    model = HierarchicalClassifier(config).to(device)
    
    # Optimizer and scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=config.learning_rate)
    
    num_training_steps = len(train_loader) * config.max_epochs
    num_warmup_steps = int(num_training_steps * config.warmup_ratio)
    
    scheduler = get_linear_schedule_with_warmup(
        optimizer,
        num_warmup_steps=num_warmup_steps,
        num_training_steps=num_training_steps
    )
    
    # Loss functions
    primary_criterion = FocalLoss(gamma=config.focal_gamma)
    secondary_criterion = FocalLoss(gamma=config.focal_gamma)
    
    # Training loop
    best_val_metric = 0.0
    patience_counter = 0
    
    for epoch in range(config.max_epochs):
        model.train()
        epoch_loss = 0.0
        
        for batch_idx, batch in enumerate(train_loader):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            primary_labels = batch['primary_label'].to(device)
            secondary_labels = batch['secondary_label'].to(device)
            
            optimizer.zero_grad()
            
            primary_logits, secondary_logits = model(input_ids, attention_mask, primary_labels)
            
            loss_primary = primary_criterion(primary_logits, primary_labels)
            loss_secondary = secondary_criterion(secondary_logits, secondary_labels)
            
            loss = loss_primary + loss_secondary
            
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            scheduler.step()
            
            epoch_loss += loss.item()
            
            if batch_idx % 50 == 0:
                print(f"  Epoch {epoch+1}/{config.max_epochs}, Batch {batch_idx}/{len(train_loader)}, Loss: {loss.item():.4f}")
        
        # Validate
        val_metrics = validate(model, val_loader, config, device)
        
        print(f"\n  Validation Metrics:")
        print(f"    Primary Macro-F1: {val_metrics['primary_macro_f1']:.4f}")
        print(f"    Secondary Macro-F1: {val_metrics['secondary_macro_f1']:.4f}")
        print(f"    Hierarchical F1: {val_metrics['hier_f1']:.4f}")
        print(f"    Path Validity: {val_metrics['path_validity']:.4f}")
        
        # Early stopping on combined metric
        current_metric = (val_metrics['primary_macro_f1'] + val_metrics['hier_f1'] + val_metrics['path_validity']) / 3
        
        if current_metric > best_val_metric:
            best_val_metric = current_metric
            patience_counter = 0
            
            # Save best model
            config.output_dir.mkdir(parents=True, exist_ok=True)
            save_path = config.output_dir / f"{config.variable}_fold_{fold_idx}_best.pt"
            torch.save({
                'model_state_dict': model.state_dict(),
                'metrics': val_metrics,
                'config': config
            }, save_path)
            print(f"  ✓ Saved best model to {save_path}")
        else:
            patience_counter += 1
            print(f"  No improvement (patience: {patience_counter}/{config.early_stop_patience})")
            
            if patience_counter >= config.early_stop_patience:
                print(f"  Early stopping triggered at epoch {epoch+1}")
                break
    
    return val_metrics


def main():
    parser = argparse.ArgumentParser(description="Train hierarchical emotion classifier (simplified)")
    parser.add_argument("--variable", required=True, choices=['invoked', 'expressed'])
    parser.add_argument("--model_name", default="roberta-base")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--n_folds", type=int, default=5)
    
    args = parser.parse_args()
    
    # Adjust acceptance criteria per variable
    acceptance_macro_f1 = 0.75 if args.variable == 'invoked' else 0.73
    acceptance_hier_f1 = 0.60 if args.variable == 'invoked' else 0.58
    
    config = HierarchicalConfig(
        variable=args.variable,
        model_name=args.model_name,
        device=args.device,
        acceptance_macro_f1=acceptance_macro_f1,
        acceptance_hier_f1=acceptance_hier_f1
    )
    
    # Train all folds
    all_metrics = []
    for fold_idx in range(args.n_folds):
        fold_metrics = train_fold(config, fold_idx)
        all_metrics.append(fold_metrics)
    
    # Aggregate metrics
    print(f"\n{'='*60}")
    print(f"Cross-Validation Results ({args.variable})")
    print(f"{'='*60}")
    
    for metric_name in all_metrics[0].keys():
        values = [m[metric_name] for m in all_metrics]
        mean_val = np.mean(values)
        std_val = np.std(values)
        print(f"{metric_name}: {mean_val:.4f} ± {std_val:.4f}")
    
    # Check acceptance
    mean_macro_f1 = np.mean([m['primary_macro_f1'] for m in all_metrics])
    mean_hier_f1 = np.mean([m['hier_f1'] for m in all_metrics])
    mean_path_validity = np.mean([m['path_validity'] for m in all_metrics])
    
    accepted = (mean_macro_f1 >= config.acceptance_macro_f1 and 
                mean_hier_f1 >= config.acceptance_hier_f1 and
                mean_path_validity >= config.acceptance_path_validity)
    
    status = "ACCEPTED ✓" if accepted else "PENDING ⏳"
    print(f"\n{status}")
    
    # Save final model
    save_name = f"{args.variable}_final_{'accepted' if accepted else 'pending'}.pt"
    # (Would average fold models here for production)
    
    print(f"\n✓ Training complete for {args.variable}")


if __name__ == "__main__":
    main()
