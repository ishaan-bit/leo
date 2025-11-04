"""
Add mock perception labels to synthetic data for testing.

Adds realistic valence/arousal/willingness scores based on
the edge case category (sarcasm → low valence, suicide → very low, etc.)
"""

import json
import random
from pathlib import Path

# Mock label generators based on category
LABEL_GENERATORS = {
    "sarcasm": {
        "valence": lambda: random.uniform(0.2, 0.4),  # Negative
        "arousal": lambda: random.uniform(0.4, 0.6),  # Medium
        "willingness": lambda: random.uniform(0.3, 0.5),  # Low-medium
    },
    "suicide": {
        "valence": lambda: random.uniform(0.0, 0.15),  # Very negative
        "arousal": lambda: random.uniform(0.6, 0.9),  # High distress
        "willingness": lambda: random.uniform(0.1, 0.3),  # Very low
    },
    "selfharm": {
        "valence": lambda: random.uniform(0.05, 0.25),  # Very negative
        "arousal": lambda: random.uniform(0.5, 0.8),  # High
        "willingness": lambda: random.uniform(0.2, 0.4),  # Low
    },
    "abuse": {
        "valence": lambda: random.uniform(0.1, 0.3),  # Very negative
        "arousal": lambda: random.uniform(0.6, 0.85),  # High fear/anger
        "willingness": lambda: random.uniform(0.15, 0.35),  # Low
    },
    "profanity": {
        "valence": lambda: random.uniform(0.25, 0.45),  # Negative
        "arousal": lambda: random.uniform(0.55, 0.75),  # Medium-high
        "willingness": lambda: random.uniform(0.4, 0.6),  # Medium
    },
    "sociopathic": {
        "valence": lambda: random.uniform(0.15, 0.35),  # Negative
        "arousal": lambda: random.uniform(0.3, 0.5),  # Low-medium (cold)
        "willingness": lambda: random.uniform(0.2, 0.4),  # Low
    },
    "fincoer": {
        "valence": lambda: random.uniform(0.1, 0.3),  # Very negative
        "arousal": lambda: random.uniform(0.6, 0.85),  # High stress
        "willingness": lambda: random.uniform(0.15, 0.35),  # Low
    },
}

def add_labels_to_item(item: dict) -> dict:
    """Add mock perception labels based on category."""
    rid = item.get("rid", "")
    
    # Extract category from RID
    category = None
    for cat in LABEL_GENERATORS.keys():
        if cat in rid:
            category = cat
            break
    
    if category is None:
        # Default neutral
        item["valence"] = 0.5
        item["arousal"] = 0.5
        item["willingness"] = 0.5
    else:
        generators = LABEL_GENERATORS[category]
        item["valence"] = generators["valence"]()
        item["arousal"] = generators["arousal"]()
        item["willingness"] = generators["willingness"]()
    
    # Add mock hierarchical labels (simplified)
    item["invoked"] = "distress" if item["valence"] < 0.3 else "neutral"
    item["expressed"] = "inhibited" if item["willingness"] < 0.4 else "direct"
    
    # Add congruence/comparator (mock)
    item["congruence"] = random.uniform(0.4, 0.7)
    item["comparator"] = random.uniform(0.4, 0.7)
    
    return item


def main():
    """Add labels to all splits and CV folds."""
    features_dir = Path("enrichment-worker/data/features")
    
    # Process main splits
    for split_name in ["train", "val", "test"]:
        split_path = features_dir / f"{split_name}_features.jsonl"
        
        if not split_path.exists():
            print(f"[Skip] {split_name} not found")
            continue
        
        print(f"[Processing] {split_name}...")
        
        # Load items
        items = []
        with open(split_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    items.append(json.loads(line))
        
        # Add labels
        for item in items:
            add_labels_to_item(item)
        
        # Save
        with open(split_path, "w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        
        print(f"  ✓ Added labels to {len(items)} items")
    
    # Process CV folds
    cv_dir = features_dir / "cv_folds"
    if cv_dir.exists():
        for fold_dir in sorted(cv_dir.iterdir()):
            if not fold_dir.is_dir():
                continue
            
            fold_name = fold_dir.name
            print(f"\n[Processing] {fold_name}...")
            
            for split_name in ["train", "val"]:
                split_path = fold_dir / f"{split_name}_features.jsonl"
                
                if not split_path.exists():
                    continue
                
                # Load items
                items = []
                with open(split_path, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            items.append(json.loads(line))
                
                # Add labels
                for item in items:
                    add_labels_to_item(item)
                
                # Save
                with open(split_path, "w", encoding="utf-8") as f:
                    for item in items:
                        f.write(json.dumps(item, ensure_ascii=False) + "\n")
                
                print(f"  ✓ {split_name}: {len(items)} items labeled")
    
    print("\n" + "="*70)
    print("✓ Mock labels added to all splits and CV folds")
    print("="*70)


if __name__ == "__main__":
    main()
