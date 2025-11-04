"""
Sentence embedding feature extraction (Eb) for emotion perception.

Uses sentence-transformers to generate 384-dim dense vectors.

Models:
- all-MiniLM-L6-v2 (EN): 384-dim, fast, good quality
- distiluse-base-multilingual-v2 (Hinglish/HI): 512-dim → PCA to 384-dim

Features:
- Raw 384-dim embedding
- PCA-reduced for multilingual
- Cosine similarity to emotion anchors
- Device-aware inference (GPU → NPU → CPU)

Output: Per-item embedding vectors for downstream models.
"""

import numpy as np
import torch
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class EmbeddingConfig:
    """Configuration for embedding extraction."""
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    multilingual_model: str = "sentence-transformers/distiluse-base-multilingual-cased-v2"
    embed_dim: int = 384
    device: str = "cpu"  # Auto-detected from config
    batch_size: int = 32
    max_length: int = 512
    normalize: bool = True


class EmbeddingExtractor:
    """
    Extract sentence embeddings using sentence-transformers.
    
    Features:
    - EN: all-MiniLM-L6-v2 (384-dim)
    - Multilingual: distiluse-base-multilingual → PCA(384)
    - Emotion anchor similarities
    - Device-aware (GPU/NPU/CPU)
    """
    
    def __init__(self, config: EmbeddingConfig = None):
        """
        Initialize embedding models.
        
        Args:
            config: EmbeddingConfig with model settings
        """
        self.config = config or EmbeddingConfig()
        
        # Lazy import to avoid blocking if not installed
        try:
            from sentence_transformers import SentenceTransformer
            self.SentenceTransformer = SentenceTransformer
        except ImportError:
            raise ImportError(
                "sentence-transformers not installed. "
                "Install with: pip install sentence-transformers"
            )
        
        # Load models
        self.model_en = None
        self.model_multi = None
        self._load_models()
        
        # Emotion anchors (for similarity features)
        self.emotion_anchors = {
            "joy": "I feel happy and joyful",
            "sadness": "I feel sad and depressed",
            "anger": "I feel angry and frustrated",
            "fear": "I feel afraid and anxious",
            "calm": "I feel calm and peaceful",
            "excited": "I feel excited and energetic",
        }
        self.anchor_embeddings = None
        self._compute_anchor_embeddings()
    
    def _load_models(self):
        """Load sentence-transformer models."""
        print(f"[Eb] Loading EN model: {self.config.model_name}")
        self.model_en = self.SentenceTransformer(self.config.model_name)
        self.model_en.to(self.config.device)
        
        print(f"[Eb] Loading multilingual model: {self.config.multilingual_model}")
        self.model_multi = self.SentenceTransformer(self.config.multilingual_model)
        self.model_multi.to(self.config.device)
        
        print(f"[Eb] Models loaded on device: {self.config.device}")
    
    def _compute_anchor_embeddings(self):
        """Precompute emotion anchor embeddings."""
        anchor_texts = list(self.emotion_anchors.values())
        self.anchor_embeddings = self.model_en.encode(
            anchor_texts,
            batch_size=len(anchor_texts),
            normalize_embeddings=True,
            convert_to_numpy=True
        )
        print(f"[Eb] Precomputed {len(anchor_texts)} emotion anchor embeddings")
    
    def extract(self, text: str, lang: str = "EN") -> Dict:
        """
        Extract embedding for single text.
        
        Args:
            text: Input text (normalized)
            lang: Language (EN, HI, Hinglish)
        
        Returns:
            Dict with 'embedding' (384-dim) and 'anchor_sims'
        """
        # Select model
        model = self.model_en if lang == "EN" else self.model_multi
        
        # Encode
        embedding = model.encode(
            text,
            normalize_embeddings=self.config.normalize,
            convert_to_numpy=True
        )
        
        # If multilingual (512-dim), reduce to 384
        if embedding.shape[0] > self.config.embed_dim:
            embedding = self._reduce_dim(embedding)
        
        # Compute anchor similarities (only for EN model)
        anchor_sims = {}
        if lang == "EN":
            anchor_sims = self._compute_anchor_similarities(embedding)
        
        return {
            "embedding": embedding.tolist(),  # Convert to list for JSON
            "anchor_sims": anchor_sims,
            "embed_dim": len(embedding),
        }
    
    def extract_batch(self, items: List[Dict]) -> List[Dict]:
        """
        Extract embeddings for batch of items.
        
        Args:
            items: List of perception items with 'normalized_text' and 'lang'
        
        Returns:
            List of items with added 'emb_features' field
        """
        # Group by language for batch processing
        en_items = [item for item in items if item.get("lang") == "EN"]
        multi_items = [item for item in items if item.get("lang") in ["Hinglish", "HI"]]
        
        print(f"[Eb] Extracting embeddings: {len(en_items)} EN, {len(multi_items)} multilingual")
        
        # Process EN batch
        if en_items:
            en_texts = [item.get("normalized_text", "") for item in en_items]
            en_embeddings = self.model_en.encode(
                en_texts,
                batch_size=self.config.batch_size,
                normalize_embeddings=self.config.normalize,
                convert_to_numpy=True,
                show_progress_bar=True
            )
            
            # Add to items
            for item, embedding in zip(en_items, en_embeddings):
                anchor_sims = self._compute_anchor_similarities(embedding)
                item["emb_features"] = {
                    "embedding": embedding.tolist(),
                    "anchor_sims": anchor_sims,
                    "embed_dim": len(embedding),
                }
        
        # Process multilingual batch
        if multi_items:
            multi_texts = [item.get("normalized_text", "") for item in multi_items]
            multi_embeddings = self.model_multi.encode(
                multi_texts,
                batch_size=self.config.batch_size,
                normalize_embeddings=self.config.normalize,
                convert_to_numpy=True,
                show_progress_bar=True
            )
            
            # Reduce dim if needed
            if multi_embeddings.shape[1] > self.config.embed_dim:
                multi_embeddings = np.array([
                    self._reduce_dim(emb) for emb in multi_embeddings
                ])
            
            # Add to items
            for item, embedding in zip(multi_items, multi_embeddings):
                item["emb_features"] = {
                    "embedding": embedding.tolist(),
                    "anchor_sims": {},  # No EN anchors for multilingual
                    "embed_dim": len(embedding),
                }
        
        return items
    
    def _reduce_dim(self, embedding: np.ndarray) -> np.ndarray:
        """
        Reduce embedding dimension using simple truncation.
        
        For production, use proper PCA fitted on train set.
        """
        return embedding[:self.config.embed_dim]
    
    def _compute_anchor_similarities(self, embedding: np.ndarray) -> Dict[str, float]:
        """
        Compute cosine similarity to emotion anchors.
        
        Args:
            embedding: 384-dim normalized vector
        
        Returns:
            Dict mapping emotion to similarity score
        """
        # Ensure normalized
        embedding = embedding / (np.linalg.norm(embedding) + 1e-8)
        
        # Compute cosine similarities
        sims = {}
        for emotion, anchor_emb in zip(self.emotion_anchors.keys(), self.anchor_embeddings):
            sim = float(np.dot(embedding, anchor_emb))
            sims[f"sim_{emotion}"] = sim
        
        return sims


def main():
    """Demo usage."""
    # Mock device detection
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    config = EmbeddingConfig(
        device=device,
        batch_size=8
    )
    
    extractor = EmbeddingExtractor(config)
    
    # Test items
    test_items = [
        {
            "rid": "test1",
            "normalized_text": "I feel incredibly happy today",
            "lang": "EN"
        },
        {
            "rid": "test2",
            "normalized_text": "Feeling so anxious about tomorrow",
            "lang": "EN"
        },
        {
            "rid": "test3",
            "normalized_text": "yaar bahut tension hai",
            "lang": "Hinglish"
        },
    ]
    
    results = extractor.extract_batch(test_items)
    
    print("="*70)
    print("EMBEDDING FEATURE EXTRACTION — Demo")
    print("="*70)
    
    for item in results:
        print(f"\n[{item['rid']}] {item['normalized_text']}")
        print(f"  Lang: {item['lang']}")
        
        emb = item['emb_features']
        print(f"  Embedding dim: {emb['embed_dim']}")
        print(f"  First 5 dims: {emb['embedding'][:5]}")
        
        if emb['anchor_sims']:
            print(f"  Anchor similarities:")
            for emotion, sim in emb['anchor_sims'].items():
                print(f"    {emotion}: {sim:.3f}")


if __name__ == "__main__":
    main()
