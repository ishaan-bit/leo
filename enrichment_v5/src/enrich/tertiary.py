"""
Tertiary emotion selection using embeddings and hierarchy validation.

Selects the micro-emotion (tertiary) that best matches the text
while respecting the Willcox wheel strict hierarchy.
"""

from typing import Dict, List, Tuple, Optional
import json
from pathlib import Path

# Load Willcox wheel hierarchy
WHEEL_PATH = Path(__file__).parent.parent.parent / 'willcox_feelings_wheel_strict.json'

with open(WHEEL_PATH, 'r', encoding='utf-8') as f:
    WHEEL_DATA = json.load(f)

MICROS = WHEEL_DATA['micros']  # {secondary: [tertiaries]}


def get_valid_tertiaries(secondary: str) -> List[str]:
    """
    Get valid tertiary emotions for a given secondary.
    
    Args:
        secondary: Secondary emotion (nuance)
        
    Returns:
        List of valid tertiary emotions (6 micros)
    """
    return MICROS.get(secondary, [])


def select_tertiary(
    primary: str,
    secondary: str,
    text: str,
    text_embedding: Optional[List[float]] = None,
    tertiary_embeddings: Optional[Dict[str, List[float]]] = None
) -> Tuple[str, float]:
    """
    Select best tertiary emotion using embeddings.
    
    Args:
        primary: Selected primary emotion
        secondary: Selected secondary emotion
        text: Original reflection text
        text_embedding: Optional pre-computed embedding of text
        tertiary_embeddings: Optional pre-computed embeddings of valid tertiaries
        
    Returns:
        (best_tertiary, similarity_score)
    """
    # Get valid tertiaries for this secondary
    valid_tertiaries = get_valid_tertiaries(secondary)
    
    if not valid_tertiaries:
        # Fallback if secondary not in wheel
        return "Unknown", 0.0
    
    # If no embeddings provided, pick first (deterministic fallback)
    if text_embedding is None or tertiary_embeddings is None:
        return valid_tertiaries[0], 0.5
    
    # Compute similarities using cosine distance
    from ..http_clients import cosine_similarity
    
    similarities = {}
    for tertiary in valid_tertiaries:
        if tertiary in tertiary_embeddings:
            sim = cosine_similarity(text_embedding, tertiary_embeddings[tertiary])
            similarities[tertiary] = sim
        else:
            similarities[tertiary] = 0.0
    
    # Select best match
    if not similarities:
        return valid_tertiaries[0], 0.5
    
    best_tertiary = max(similarities, key=similarities.get)
    best_score = similarities[best_tertiary]
    
    return best_tertiary, best_score


def select_tertiary_batch(
    primary: str,
    secondary: str,
    text: str
) -> Tuple[str, float]:
    """
    Select tertiary using HF embeddings API (batch mode).
    
    This function calls HF API to get embeddings for text and all valid tertiaries,
    then selects the best match.
    
    Args:
        primary: Selected primary emotion
        secondary: Selected secondary emotion
        text: Original reflection text
        
    Returns:
        (best_tertiary, similarity_score)
    """
    # Import HF functions from full_pipeline which has them
    import sys
    import os
    import requests
    
    # Get valid tertiaries
    valid_tertiaries = get_valid_tertiaries(secondary)
    
    if not valid_tertiaries:
        return "Unknown", 0.0
    
    # Get HF token
    HF_TOKEN = os.getenv('HF_TOKEN')
    if not HF_TOKEN:
        # Fallback: pick first tertiary
        return valid_tertiaries[0], 0.5
    
    # Get embeddings for text + all tertiaries in one batch call
    HF_EMBED_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2"
    all_texts = [text] + valid_tertiaries
    
    try:
        response = requests.post(
            HF_EMBED_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json={"inputs": all_texts},
            timeout=20
        )
        
        if response.status_code != 200:
            return valid_tertiaries[0], 0.5
        
        embeddings = response.json()
        
        if not isinstance(embeddings, list) or len(embeddings) != len(all_texts):
            return valid_tertiaries[0], 0.5
        
        # First embedding is the text, rest are tertiaries
        text_emb = embeddings[0]
        tertiary_embs = embeddings[1:]
        
        # Compute cosine similarities
        def cosine_sim(vec1, vec2):
            dot = sum(a * b for a, b in zip(vec1, vec2))
            norm1 = sum(a * a for a in vec1) ** 0.5
            norm2 = sum(b * b for b in vec2) ** 0.5
            if norm1 == 0 or norm2 == 0:
                return 0.0
            return dot / (norm1 * norm2)
        
        similarities = {}
        for tertiary, emb in zip(valid_tertiaries, tertiary_embs):
            sim = cosine_sim(text_emb, emb)
            similarities[tertiary] = sim
        
        # Select best match
        if not similarities:
            return valid_tertiaries[0], 0.5
        
        best_tertiary = max(similarities, key=similarities.get)
        best_score = similarities[best_tertiary]
        
        return best_tertiary, best_score
        
    except Exception as e:
        # Fallback on any error
        return valid_tertiaries[0], 0.5
