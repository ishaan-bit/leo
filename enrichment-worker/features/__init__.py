"""
Feature extraction module for emotion perception models.

Extractors:
- LexicalFeatureExtractor: Rule-based emotion keywords, valence/arousal lexicons
- EmbeddingExtractor: Sentence embeddings (384-dim) with emotion anchor similarities
- TemporalFeatureExtractor: Time-series features (EMA, variance, gaps)

Usage:
    from features import FeaturePipeline
    
    pipeline = FeaturePipeline(
        data_dir="data/splits",
        output_dir="data/features",
        device="cuda"
    )
    
    # Process main splits
    pipeline.process_split("train")
    pipeline.process_split("val")
    pipeline.process_split("test")
    
    # Or process CV folds
    pipeline.process_cv_folds()
"""

from .lexical_extractor import LexicalFeatureExtractor
from .embedding_extractor import EmbeddingExtractor, EmbeddingConfig
from .temporal_extractor import TemporalFeatureExtractor
from .pipeline import FeaturePipeline

__all__ = [
    "LexicalFeatureExtractor",
    "EmbeddingExtractor",
    "EmbeddingConfig",
    "TemporalFeatureExtractor",
    "FeaturePipeline",
]
