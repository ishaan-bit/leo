"""
Generate mock data splits for perception stack training (MOCK DATA MODE)

Creates 5-fold CV splits with mock labels for:
- Hierarchical models (invoked, expressed)
- Temporal models (congruence, comparator)

Uses 6×6×6 emotion taxonomy from taxonomy_216.json
"""

import json
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
import random

# Load taxonomy from taxonomy_216.json
TAXONOMY_PATH = Path("enrichment-worker/data/curated/taxonomy_216.json")
with open(TAXONOMY_PATH, 'r') as f:
    TAXONOMY = json.load(f)

# Emotion hierarchy (6×6×6 structure)
PRIMARY_EMOTIONS = TAXONOMY['cores']  # ["Happy", "Strong", "Peaceful", "Sad", "Angry", "Fearful"]
SECONDARY_EMOTIONS = TAXONOMY['nuances']  # {core: [nuances]}

def generate_mock_item(user_id: str, timestamp: int, idx: int) -> dict:
    """Generate a single mock reflection with labels"""
    
    # Primary emotion
    primary_idx = random.randint(0, 5)
    primary = PRIMARY_EMOTIONS[primary_idx]
    
    # Secondary emotion (valid for primary)
    secondary = random.choice(SECONDARY_EMOTIONS[primary])
    
    # Mock text
    texts = [
        "Today was challenging but I learned something new.",
        "Feeling grateful for the support I received today.",
        "Overwhelmed with everything happening right now.",
        "Had a great conversation that lifted my spirits.",
        "Struggling to find motivation lately.",
        "Proud of the progress I made on my goals."
    ]
    text = random.choice(texts)
    
    # Mock labels
    valence = np.random.beta(2, 2)  # Centered around 0.5
    arousal = np.random.beta(2, 2)
    willingness = np.random.beta(2, 5)  # Skewed lower
    
    # Invoked/expressed probabilities (one-hot with noise)
    invoked_proba = np.zeros(6)
    invoked_proba[primary_idx] = 0.7 + np.random.uniform(0, 0.25)
    invoked_proba += np.random.dirichlet([0.1] * 6) * 0.15
    invoked_proba /= invoked_proba.sum()
    
    expressed_proba = np.zeros(6)
    expressed_primary_idx = primary_idx if random.random() > 0.3 else random.randint(0, 5)
    expressed_proba[expressed_primary_idx] = 0.6 + np.random.uniform(0, 0.3)
    expressed_proba += np.random.dirichlet([0.1] * 6) * 0.2
    expressed_proba /= expressed_proba.sum()
    
    # EMA features (simulate history)
    v_ema_1d = valence + np.random.normal(0, 0.05)
    v_ema_7d = valence + np.random.normal(0, 0.08)
    v_ema_28d = valence + np.random.normal(0, 0.10)
    
    a_ema_1d = arousal + np.random.normal(0, 0.05)
    a_ema_7d = arousal + np.random.normal(0, 0.08)
    a_ema_28d = arousal + np.random.normal(0, 0.10)
    
    # Clip to [0, 1]
    def clip(x):
        return max(0.0, min(1.0, x))
    
    # Temporal expectations (congruence/comparator)
    congruence_v_expected = clip(v_ema_7d + np.random.normal(0, 0.03))
    congruence_a_expected = clip(a_ema_7d + np.random.normal(0, 0.03))
    
    comparator_v_expected = clip(valence + np.random.normal(0, 0.05))
    comparator_a_expected = clip(arousal + np.random.normal(0, 0.05))
    
    # Metadata
    hour = random.randint(0, 23)
    length = len(text.split())
    risk_flag = 1 if random.random() < 0.05 else 0
    
    return {
        "rid": f"refl_{timestamp}_{user_id}_{idx}",
        "user_id": user_id,
        "timestamp": timestamp,
        "text": text,
        "length": length,
        "hour": hour,
        "risk_flag": risk_flag,
        
        # Regression labels
        "valence": float(valence),
        "arousal": float(arousal),
        "willingness": float(willingness),
        
        # Hierarchical labels
        "invoked_primary": primary_idx,
        "invoked_primary_name": primary,
        "invoked_secondary": secondary,
        "invoked_proba": invoked_proba.tolist(),
        
        "expressed_primary": expressed_primary_idx,
        "expressed_primary_name": PRIMARY_EMOTIONS[expressed_primary_idx],
        "expressed_proba": expressed_proba.tolist(),
        
        # EMA features
        "v_ema_1d": float(v_ema_1d),
        "v_ema_7d": float(v_ema_7d),
        "v_ema_28d": float(v_ema_28d),
        "a_ema_1d": float(a_ema_1d),
        "a_ema_7d": float(a_ema_7d),
        "a_ema_28d": float(a_ema_28d),
        
        # Temporal labels
        "congruence_v_expected": float(congruence_v_expected),
        "congruence_a_expected": float(congruence_a_expected),
        "comparator_v_expected": float(comparator_v_expected),
        "comparator_a_expected": float(comparator_a_expected),
    }


def generate_splits(n_users: int = 500, items_per_user: int = 10, n_folds: int = 5):
    """Generate mock splits with user-level grouping"""
    
    print(f"Generating mock data: {n_users} users, {items_per_user} items/user, {n_folds} folds")
    
    # Generate all items grouped by user
    all_items = []
    base_timestamp = int(datetime(2024, 1, 1).timestamp())
    
    for user_idx in range(n_users):
        user_id = f"user_{user_idx:04d}"
        
        for item_idx in range(items_per_user):
            # Timestamps spaced by ~1 day
            timestamp = base_timestamp + (user_idx * items_per_user + item_idx) * 86400
            item = generate_mock_item(user_id, timestamp, item_idx)
            all_items.append(item)
    
    print(f"✓ Generated {len(all_items)} items")
    
    # Split users into folds
    user_ids = [f"user_{i:04d}" for i in range(n_users)]
    random.shuffle(user_ids)
    
    fold_size = n_users // n_folds
    folds = [user_ids[i*fold_size:(i+1)*fold_size] for i in range(n_folds)]
    
    # Create train/val splits for each fold
    output_dir = Path("enrichment-worker/data/splits")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    for fold_idx in range(n_folds):
        # Validation = current fold
        val_users = set(folds[fold_idx])
        
        # Train = all other folds
        train_users = set()
        for i in range(n_folds):
            if i != fold_idx:
                train_users.update(folds[i])
        
        # Split items
        train_items = [item for item in all_items if item['user_id'] in train_users]
        val_items = [item for item in all_items if item['user_id'] in val_users]
        
        # Sort by timestamp
        train_items.sort(key=lambda x: x['timestamp'])
        val_items.sort(key=lambda x: x['timestamp'])
        
        # Save
        train_path = output_dir / f"fold_{fold_idx}_train.jsonl"
        val_path = output_dir / f"fold_{fold_idx}_val.jsonl"
        
        with open(train_path, 'w', encoding='utf-8') as f:
            for item in train_items:
                f.write(json.dumps(item) + '\n')
        
        with open(val_path, 'w', encoding='utf-8') as f:
            for item in val_items:
                f.write(json.dumps(item) + '\n')
        
        print(f"✓ Fold {fold_idx}: {len(train_items)} train, {len(val_items)} val")
    
    # Also create a test split (10% of users)
    test_size = n_users // 10
    test_users = set(user_ids[:test_size])
    test_items = [item for item in all_items if item['user_id'] in test_users]
    test_items.sort(key=lambda x: x['timestamp'])
    
    test_path = output_dir / "test.jsonl"
    with open(test_path, 'w', encoding='utf-8') as f:
        for item in test_items:
            f.write(json.dumps(item) + '\n')
    
    print(f"✓ Test: {len(test_items)} items")
    print(f"\n✓ Splits saved to {output_dir}")


if __name__ == "__main__":
    np.random.seed(42)
    random.seed(42)
    generate_splits(n_users=500, items_per_user=10, n_folds=5)
