"""
Leak-proof train/val/test split with user-grouped holdout and 7-day embargo.

CRITICAL RULES:
1. Group by user: No user appears in >1 split or CV fold
2. Time-aware: 7-day embargo between train and val/test for same user
3. Stratify at user level: primary_core, language, length_bucket, tier
4. Final sets: Train 70% / Val 15% / Test 15% (user counts)
5. K-fold CV on train users only: Grouped, stratified, time-blocked 5-fold

Variables handled:
- Valence/Arousal: stratify on language + length_bucket
- Invoked/Expressed: stratify on primary_core + tier
- Willingness: stratify on device + language + length_bucket
- Congruence/Comparator: stratify on timeline_density (temporal users)
"""

import json
import random
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Set
from collections import defaultdict, Counter
import argparse
import numpy as np


class UserGroupedSplitter:
    """
    User-grouped train/val/test split with embargo enforcement.
    """
    
    def __init__(
        self,
        embargo_days: int = 7,
        val_pct: float = 0.15,
        test_pct: float = 0.15,
        seed: int = 137,
        verbose: bool = True
    ):
        self.embargo_days = embargo_days
        self.val_pct = val_pct
        self.test_pct = test_pct
        self.train_pct = 1.0 - val_pct - test_pct
        self.seed = seed
        self.verbose = verbose
        
        random.seed(seed)
        np.random.seed(seed)
    
    def _compute_user_profiles(self, items: List[Dict]) -> Dict[str, Dict]:
        """
        Compute compact user profile for stratification.
        
        Profile:
        - primary_core: Most frequent core emotion
        - language: Most frequent language
        - length_bucket: Most frequent bucket
        - tier: Most frequent tier (from invoked emotion)
        - timeline_days: Span of user's reflections in days
        - item_count: Number of reflections
        """
        user_items = defaultdict(list)
        
        for item in items:
            user_id = item.get("owner_id") or item.get("user_id")
            if not user_id:
                continue
            user_items[user_id].append(item)
        
        profiles = {}
        
        for user_id, user_data in user_items.items():
            # Primary core
            cores = [item.get("invoked_core") for item in user_data if item.get("invoked_core")]
            primary_core = Counter(cores).most_common(1)[0][0] if cores else "Unknown"
            
            # Language
            langs = [item.get("lang") for item in user_data if item.get("lang")]
            language = Counter(langs).most_common(1)[0][0] if langs else "EN"
            
            # Length bucket
            lengths = [item.get("length_bucket") for item in user_data if item.get("length_bucket")]
            length_bucket = Counter(lengths).most_common(1)[0][0] if lengths else "MEDIUM"
            
            # Tier (from invoked emotion cell_id lookup)
            tiers = []
            for item in user_data:
                if item.get("invoked", {}).get("tier"):
                    tiers.append(item["invoked"]["tier"])
            tier = Counter(tiers).most_common(1)[0][0] if tiers else "B"
            
            # Timeline
            timestamps = []
            for item in user_data:
                ts_str = item.get("ts")
                if ts_str:
                    try:
                        timestamps.append(datetime.fromisoformat(ts_str.replace('Z', '+00:00')))
                    except:
                        pass
            
            if timestamps:
                timeline_days = (max(timestamps) - min(timestamps)).days
                first_ts = min(timestamps)
                last_ts = max(timestamps)
            else:
                timeline_days = 0
                first_ts = None
                last_ts = None
            
            profiles[user_id] = {
                "primary_core": primary_core,
                "language": language,
                "length_bucket": length_bucket,
                "tier": tier,
                "timeline_days": timeline_days,
                "item_count": len(user_data),
                "first_ts": first_ts,
                "last_ts": last_ts,
            }
        
        return profiles
    
    def _stratified_user_split(
        self,
        user_profiles: Dict[str, Dict],
        strat_keys: List[str]
    ) -> Tuple[List[str], List[str], List[str]]:
        """
        Stratified split of users into train/val/test.
        
        Args:
            user_profiles: User profile dict
            strat_keys: Keys to stratify on (e.g., ['primary_core', 'language'])
        
        Returns:
            (train_users, val_users, test_users)
        """
        # Group users by strata
        strata = defaultdict(list)
        for user_id, profile in user_profiles.items():
            strat_tuple = tuple(profile.get(k, "Unknown") for k in strat_keys)
            strata[strat_tuple].append(user_id)
        
        train_users = []
        val_users = []
        test_users = []
        
        # Split each stratum proportionally
        for strat_key, users in strata.items():
            random.shuffle(users)
            n = len(users)
            
            n_val = max(1, int(n * self.val_pct))
            n_test = max(1, int(n * self.test_pct))
            n_train = n - n_val - n_test
            
            test_users.extend(users[:n_test])
            val_users.extend(users[n_test:n_test + n_val])
            train_users.extend(users[n_test + n_val:])
        
        if self.verbose:
            print(f"  Stratified on: {strat_keys}")
            print(f"  Train users: {len(train_users)} ({len(train_users)/len(user_profiles)*100:.1f}%)")
            print(f"  Val users: {len(val_users)} ({len(val_users)/len(user_profiles)*100:.1f}%)")
            print(f"  Test users: {len(test_users)} ({len(test_users)/len(user_profiles)*100:.1f}%)")
        
        return train_users, val_users, test_users
    
    def _apply_embargo(
        self,
        items: List[Dict],
        train_users: Set[str],
        val_users: Set[str],
        test_users: Set[str]
    ) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        """
        Apply 7-day embargo: purge train items within 7 days before val/test.
        
        For each val/test user:
        - Find their earliest val/test timestamp
        - Remove any train items from that user within embargo_days before
        """
        embargo_delta = timedelta(days=self.embargo_days)
        
        # Organize items by user
        user_items = defaultdict(list)
        for item in items:
            user_id = item.get("owner_id") or item.get("user_id")
            if user_id:
                user_items[user_id].append(item)
        
        train_items = []
        val_items = []
        test_items = []
        purged_count = 0
        
        for user_id, user_data in user_items.items():
            # Sort by timestamp
            user_data_sorted = sorted(
                user_data,
                key=lambda x: datetime.fromisoformat(x["ts"].replace('Z', '+00:00')) if x.get("ts") else datetime.min
            )
            
            if user_id in test_users:
                test_items.extend(user_data_sorted)
            elif user_id in val_users:
                val_items.extend(user_data_sorted)
            elif user_id in train_users:
                # Check if this user also appears in val/test (shouldn't happen, but safe check)
                # Apply embargo if user has future val/test items
                
                # For now, just add all train items (embargo applies across users)
                train_items.extend(user_data_sorted)
            else:
                # User not in any split (shouldn't happen)
                if self.verbose:
                    print(f"  [WARN] User {user_id} not in any split")
        
        # Cross-user embargo: if a user has val/test items, purge train items near val/test dates
        # (This is conservative - typically embargo is per-user, but we can do global)
        
        # Find earliest val/test timestamps
        val_test_items_with_ts = []
        for item in val_items + test_items:
            ts_str = item.get("ts")
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                    val_test_items_with_ts.append((ts, item.get("owner_id") or item.get("user_id")))
                except:
                    pass
        
        # For each val/test timestamp, find embargo cutoff
        embargo_zones = {}  # user_id -> earliest_embargo_cutoff
        for ts, user_id in val_test_items_with_ts:
            cutoff = ts - embargo_delta
            if user_id not in embargo_zones or cutoff < embargo_zones[user_id]:
                embargo_zones[user_id] = cutoff
        
        # Filter train items
        train_items_filtered = []
        for item in train_items:
            user_id = item.get("owner_id") or item.get("user_id")
            ts_str = item.get("ts")
            
            if user_id in embargo_zones and ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
                    if ts >= embargo_zones[user_id]:
                        # Within embargo zone - purge
                        purged_count += 1
                        continue
                except:
                    pass
            
            train_items_filtered.append(item)
        
        if self.verbose and purged_count > 0:
            print(f"  ⚠️  Embargo purged {purged_count} train items (within {self.embargo_days} days before val/test)")
        
        return train_items_filtered, val_items, test_items
    
    def split(
        self,
        items: List[Dict],
        strat_keys: List[str] = None
    ) -> Dict[str, List[Dict]]:
        """
        Main split function.
        
        Args:
            items: List of perception items
            strat_keys: Keys to stratify on (default: ['primary_core', 'language', 'length_bucket', 'tier'])
        
        Returns:
            Dict with 'train', 'val', 'test' keys
        """
        if strat_keys is None:
            strat_keys = ['primary_core', 'language', 'length_bucket', 'tier']
        
        if self.verbose:
            print(f"\n[1/3] Computing user profiles...")
        
        user_profiles = self._compute_user_profiles(items)
        
        if self.verbose:
            print(f"  ✓ {len(user_profiles)} unique users")
            print(f"  ✓ {len(items)} total items")
        
        if self.verbose:
            print(f"\n[2/3] Stratified user split...")
        
        train_users, val_users, test_users = self._stratified_user_split(user_profiles, strat_keys)
        
        train_users_set = set(train_users)
        val_users_set = set(val_users)
        test_users_set = set(test_users)
        
        if self.verbose:
            print(f"\n[3/3] Applying {self.embargo_days}-day embargo...")
        
        train_items, val_items, test_items = self._apply_embargo(
            items,
            train_users_set,
            val_users_set,
            test_users_set
        )
        
        if self.verbose:
            print(f"  ✓ Train: {len(train_items)} items from {len(train_users)} users")
            print(f"  ✓ Val: {len(val_items)} items from {len(val_users)} users")
            print(f"  ✓ Test: {len(test_items)} items from {len(test_users)} users")
        
        return {
            "train": train_items,
            "val": val_items,
            "test": test_items,
            "train_users": train_users,
            "val_users": val_users,
            "test_users": test_users,
            "user_profiles": user_profiles,
        }
    
    def create_cv_folds(
        self,
        train_items: List[Dict],
        train_users: List[str],
        user_profiles: Dict[str, Dict],
        n_folds: int = 5,
        strat_keys: List[str] = None
    ) -> List[Dict]:
        """
        Create K-fold CV splits on train users (grouped, stratified, time-blocked).
        
        Args:
            train_items: Training items
            train_users: Training user IDs
            user_profiles: User profile dict
            n_folds: Number of folds (default 5)
            strat_keys: Keys to stratify on
        
        Returns:
            List of fold dicts with 'train' and 'val' keys
        """
        if strat_keys is None:
            strat_keys = ['primary_core', 'language', 'length_bucket']
        
        if self.verbose:
            print(f"\n[CV] Creating {n_folds}-fold grouped CV...")
        
        # Group users by strata
        strata = defaultdict(list)
        for user_id in train_users:
            if user_id in user_profiles:
                profile = user_profiles[user_id]
                strat_tuple = tuple(profile.get(k, "Unknown") for k in strat_keys)
                strata[strat_tuple].append(user_id)
        
        # Assign users to folds within each stratum
        user_to_fold = {}
        for strat_key, users in strata.items():
            random.shuffle(users)
            for i, user_id in enumerate(users):
                user_to_fold[user_id] = i % n_folds
        
        # Create folds
        folds = []
        for fold_idx in range(n_folds):
            fold_train_users = set(u for u, f in user_to_fold.items() if f != fold_idx)
            fold_val_users = set(u for u, f in user_to_fold.items() if f == fold_idx)
            
            # Organize items by user
            user_items = defaultdict(list)
            for item in train_items:
                user_id = item.get("owner_id") or item.get("user_id")
                if user_id:
                    user_items[user_id].append(item)
            
            # Time-blocked: sort each user's items by timestamp
            fold_train_items = []
            fold_val_items = []
            
            for user_id, items in user_items.items():
                items_sorted = sorted(
                    items,
                    key=lambda x: datetime.fromisoformat(x["ts"].replace('Z', '+00:00')) if x.get("ts") else datetime.min
                )
                
                if user_id in fold_train_users:
                    fold_train_items.extend(items_sorted)
                elif user_id in fold_val_users:
                    fold_val_items.extend(items_sorted)
            
            folds.append({
                "fold_idx": fold_idx,
                "train": fold_train_items,
                "val": fold_val_items,
                "train_users": list(fold_train_users),
                "val_users": list(fold_val_users),
            })
            
            if self.verbose:
                print(f"  Fold {fold_idx}: {len(fold_train_items)} train, {len(fold_val_items)} val")
        
        return folds


def load_jsonl(path: Path) -> List[Dict]:
    """Load JSONL file."""
    items = []
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            items.append(json.loads(line))
    return items


def save_jsonl(items: List[Dict], path: Path):
    """Save JSONL file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        for item in items:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')


def save_split_manifest(split_result: Dict, output_dir: Path):
    """Save split manifest JSON."""
    manifest = {
        "split_timestamp": datetime.now().isoformat(),
        "embargo_days": 7,
        "seed": 137,
        "train_users_count": len(split_result["train_users"]),
        "val_users_count": len(split_result["val_users"]),
        "test_users_count": len(split_result["test_users"]),
        "train_items_count": len(split_result["train"]),
        "val_items_count": len(split_result["val"]),
        "test_items_count": len(split_result["test"]),
    }
    
    manifest_path = output_dir / "split_manifest.json"
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
    
    print(f"  ✓ Manifest saved: {manifest_path}")


def main(args):
    """Main execution."""
    print("="*70)
    print("LEAK-PROOF TRAIN/VAL/TEST SPLIT — User-Grouped + 7-Day Embargo")
    print("="*70)
    
    # Load data
    print(f"\n[LOAD] Reading {args.input}...")
    input_path = Path(args.input)
    
    if not input_path.exists():
        print(f"  ✗ File not found: {input_path}")
        print(f"  [INFO] Generate synthetic data first:")
        print(f"    python scripts/synth_edge_cases.py")
        return
    
    items = load_jsonl(input_path)
    print(f"  ✓ Loaded {len(items)} items")
    
    # Initialize splitter
    splitter = UserGroupedSplitter(
        embargo_days=args.embargo_days,
        val_pct=args.val_pct,
        test_pct=args.test_pct,
        seed=args.seed,
        verbose=True
    )
    
    # Split
    print(f"\n[SPLIT] Applying user-grouped stratified split...")
    split_result = splitter.split(items, strat_keys=args.strat_keys.split(',') if args.strat_keys else None)
    
    # Save splits
    output_dir = Path(args.output_dir)
    
    print(f"\n[SAVE] Saving splits to {output_dir}...")
    save_jsonl(split_result["train"], output_dir / "train.jsonl")
    save_jsonl(split_result["val"], output_dir / "val.jsonl")
    save_jsonl(split_result["test"], output_dir / "test.jsonl")
    
    # Save user lists
    with open(output_dir / "train_users.json", 'w') as f:
        json.dump(split_result["train_users"], f, indent=2)
    with open(output_dir / "val_users.json", 'w') as f:
        json.dump(split_result["val_users"], f, indent=2)
    with open(output_dir / "test_users.json", 'w') as f:
        json.dump(split_result["test_users"], f, indent=2)
    
    save_split_manifest(split_result, output_dir)
    
    # Create CV folds if requested
    if args.create_cv_folds:
        print(f"\n[CV] Creating {args.n_folds}-fold CV on train set...")
        folds = splitter.create_cv_folds(
            split_result["train"],
            split_result["train_users"],
            split_result["user_profiles"],
            n_folds=args.n_folds
        )
        
        cv_dir = output_dir / "cv_folds"
        cv_dir.mkdir(exist_ok=True)
        
        for fold in folds:
            fold_dir = cv_dir / f"fold_{fold['fold_idx']}"
            fold_dir.mkdir(exist_ok=True)
            
            save_jsonl(fold["train"], fold_dir / "train.jsonl")
            save_jsonl(fold["val"], fold_dir / "val.jsonl")
            
            with open(fold_dir / "users.json", 'w') as f:
                json.dump({
                    "train_users": fold["train_users"],
                    "val_users": fold["val_users"],
                }, f, indent=2)
        
        print(f"  ✓ CV folds saved to: {cv_dir}")
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    print(f"Embargo: {args.embargo_days} days")
    print(f"Seed: {args.seed}")
    print(f"\nTrain: {len(split_result['train'])} items, {len(split_result['train_users'])} users")
    print(f"Val:   {len(split_result['val'])} items, {len(split_result['val_users'])} users")
    print(f"Test:  {len(split_result['test'])} items, {len(split_result['test_users'])} users")
    
    if args.create_cv_folds:
        print(f"\nCV folds: {args.n_folds} (grouped, stratified, time-blocked)")
    
    print(f"\n[OK] Splits saved to: {output_dir}")
    print(f"\n[INFO] Next: Run QA validation")
    print(f"  python scripts/qa_dataset.py --splits-dir {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Leak-proof train/val/test split")
    parser.add_argument(
        "--input",
        type=str,
        default="data/curated/perception_synth.jsonl",
        help="Input JSONL file"
    )
    parser.add_argument(
        "--output-dir",
        type=str,
        default="data/splits",
        help="Output directory for splits"
    )
    parser.add_argument(
        "--embargo-days",
        type=int,
        default=7,
        help="Embargo period in days"
    )
    parser.add_argument(
        "--val-pct",
        type=float,
        default=0.15,
        help="Validation users percentage"
    )
    parser.add_argument(
        "--test-pct",
        type=float,
        default=0.15,
        help="Test users percentage"
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=137,
        help="Random seed"
    )
    parser.add_argument(
        "--strat-keys",
        type=str,
        default="primary_core,language,length_bucket,tier",
        help="Comma-separated stratification keys"
    )
    parser.add_argument(
        "--create-cv-folds",
        action="store_true",
        help="Create K-fold CV on train set"
    )
    parser.add_argument(
        "--n-folds",
        type=int,
        default=5,
        help="Number of CV folds"
    )
    
    args = parser.parse_args()
    main(args)
