"""
Feature extraction pipeline orchestrator.

Coordinates all feature extractors (lexical, embeddings, temporal)
and prepares data for model training.

Pipeline:
1. Load splits (train/val/test or CV folds)
2. Extract lexical features (CPU)
3. Extract embeddings (GPU/NPU)
4. Extract temporal features (CPU)
5. Save feature-enriched datasets

Output: JSONL files with all features for training.
"""

import json
from pathlib import Path
from typing import List, Dict, Optional
from collections import defaultdict
import sys

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from features.lexical_extractor import LexicalFeatureExtractor
from features.embedding_extractor import EmbeddingExtractor, EmbeddingConfig
from features.temporal_extractor import TemporalFeatureExtractor


class FeaturePipeline:
    """
    Orchestrate feature extraction across all modalities.
    
    Steps:
    1. Load data splits
    2. Extract lexical features (fast, CPU)
    3. Extract embeddings (slow, GPU/NPU)
    4. Extract temporal features (medium, CPU)
    5. Save enriched datasets
    """
    
    def __init__(
        self,
        data_dir: Path,
        output_dir: Path,
        device: str = "cpu",
        batch_size: int = 32
    ):
        """
        Initialize feature pipeline.
        
        Args:
            data_dir: Path to data/splits/ directory
            output_dir: Path to save enriched features
            device: Device for embeddings (cpu/cuda)
            batch_size: Batch size for embedding extraction
        """
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize extractors
        print("[Pipeline] Initializing feature extractors...")
        self.lex_extractor = LexicalFeatureExtractor()
        
        embed_config = EmbeddingConfig(
            device=device,
            batch_size=batch_size
        )
        self.emb_extractor = EmbeddingExtractor(embed_config)
        
        self.tm_extractor = TemporalFeatureExtractor(
            ema_alpha=0.3,
            lookback_days=7,
            max_sequence_length=10
        )
        
        print(f"[Pipeline] Extractors initialized on device: {device}")
    
    def process_split(
        self,
        split_name: str,
        extract_temporal: bool = True
    ) -> List[Dict]:
        """
        Process a single split (train/val/test).
        
        Args:
            split_name: "train", "val", or "test"
            extract_temporal: Whether to extract temporal features
        
        Returns:
            List of items with all features
        """
        print(f"\n{'='*70}")
        print(f"PROCESSING SPLIT: {split_name.upper()}")
        print(f"{'='*70}")
        
        # Load split
        split_path = self.data_dir / f"{split_name}.jsonl"
        if not split_path.exists():
            raise FileNotFoundError(f"Split not found: {split_path}")
        
        items = self._load_jsonl(split_path)
        print(f"[1/4] Loaded {len(items)} items from {split_path}")
        
        # Extract lexical features
        print(f"[2/4] Extracting lexical features...")
        items = self.lex_extractor.extract_batch(items)
        print(f"      ✓ Lexical features extracted")
        
        # Extract embeddings
        print(f"[3/4] Extracting sentence embeddings...")
        items = self.emb_extractor.extract_batch(items)
        print(f"      ✓ Embeddings extracted")
        
        # Extract temporal features (if requested)
        if extract_temporal:
            print(f"[4/4] Extracting temporal features...")
            user_timelines = self._build_user_timelines(items)
            items = self.tm_extractor.extract_batch(items, user_timelines)
            print(f"      ✓ Temporal features extracted")
        else:
            print(f"[4/4] Skipping temporal features")
        
        # Save enriched split
        output_path = self.output_dir / f"{split_name}_features.jsonl"
        self._save_jsonl(items, output_path)
        print(f"\n✓ Saved enriched split to: {output_path}")
        
        return items
    
    def process_cv_folds(self, extract_temporal: bool = True):
        """
        Process all CV folds.
        
        Args:
            extract_temporal: Whether to extract temporal features
        """
        cv_dir = self.data_dir / "cv_folds"
        if not cv_dir.exists():
            print(f"[Pipeline] No CV folds found at {cv_dir}")
            return
        
        # Find all folds
        fold_dirs = sorted([d for d in cv_dir.iterdir() if d.is_dir()])
        print(f"\n[Pipeline] Found {len(fold_dirs)} CV folds")
        
        for fold_dir in fold_dirs:
            fold_name = fold_dir.name
            print(f"\n{'='*70}")
            print(f"PROCESSING FOLD: {fold_name.upper()}")
            print(f"{'='*70}")
            
            # Process train and val for this fold
            for split in ["train", "val"]:
                split_path = fold_dir / f"{split}.jsonl"
                if not split_path.exists():
                    print(f"[Pipeline] Skipping {split} (not found)")
                    continue
                
                # Load items
                items = self._load_jsonl(split_path)
                print(f"\n[{fold_name}/{split}] Loaded {len(items)} items")
                
                # Extract features
                print(f"  [1/3] Lexical features...")
                items = self.lex_extractor.extract_batch(items)
                
                print(f"  [2/3] Embeddings...")
                items = self.emb_extractor.extract_batch(items)
                
                if extract_temporal:
                    print(f"  [3/3] Temporal features...")
                    user_timelines = self._build_user_timelines(items)
                    items = self.tm_extractor.extract_batch(items, user_timelines)
                else:
                    print(f"  [3/3] Skipping temporal")
                
                # Save
                output_dir = self.output_dir / "cv_folds" / fold_name
                output_dir.mkdir(parents=True, exist_ok=True)
                output_path = output_dir / f"{split}_features.jsonl"
                self._save_jsonl(items, output_path)
                print(f"  ✓ Saved to {output_path}")
    
    def _build_user_timelines(self, items: List[Dict]) -> Dict[str, List[Dict]]:
        """
        Build user timelines from items.
        
        Returns:
            Dict mapping owner_id to list of items
        """
        timelines = defaultdict(list)
        for item in items:
            user_id = item.get("owner_id")
            if user_id:
                timelines[user_id].append(item)
        
        # Sort each timeline by timestamp
        for user_id in timelines:
            timelines[user_id] = sorted(
                timelines[user_id],
                key=lambda x: x.get("ts", "")
            )
        
        return dict(timelines)
    
    def _load_jsonl(self, path: Path) -> List[Dict]:
        """Load JSONL file."""
        items = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    items.append(json.loads(line))
        return items
    
    def _save_jsonl(self, items: List[Dict], path: Path):
        """Save items to JSONL."""
        with open(path, "w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")


def main():
    """Run feature extraction pipeline."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Extract features for perception training")
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "splits",
        help="Path to data splits directory"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent.parent / "data" / "features",
        help="Path to save enriched features"
    )
    parser.add_argument(
        "--device",
        type=str,
        default="cpu",
        choices=["cpu", "cuda"],
        help="Device for embedding extraction"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size for embeddings"
    )
    parser.add_argument(
        "--splits",
        nargs="+",
        default=["train", "val", "test"],
        help="Splits to process"
    )
    parser.add_argument(
        "--cv-folds",
        action="store_true",
        help="Process CV folds instead of main splits"
    )
    parser.add_argument(
        "--no-temporal",
        action="store_true",
        help="Skip temporal feature extraction"
    )
    
    args = parser.parse_args()
    
    # Initialize pipeline
    pipeline = FeaturePipeline(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        device=args.device,
        batch_size=args.batch_size
    )
    
    # Process splits or CV folds
    if args.cv_folds:
        pipeline.process_cv_folds(extract_temporal=not args.no_temporal)
    else:
        for split in args.splits:
            pipeline.process_split(split, extract_temporal=not args.no_temporal)
    
    print(f"\n{'='*70}")
    print("FEATURE EXTRACTION COMPLETE")
    print(f"{'='*70}")
    print(f"Output directory: {args.output_dir}")


if __name__ == "__main__":
    main()
