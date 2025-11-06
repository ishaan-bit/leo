"""
Full enrichment pipeline with HuggingFace Inference API integration.
Uses HTTP endpoints for zero-shot classification and sentence embeddings.
"""

import os
import requests
from typing import Dict, Optional, List
from datetime import datetime
from dotenv import load_dotenv

from .pipeline import enrich as enrich_core
from .features import extract_features

# Load environment
load_dotenv()
HF_TOKEN = os.getenv('HF_TOKEN')

# HF Inference API endpoints
HF_ZEROSHOT_URL = "https://router.huggingface.co/hf-inference/models/facebook/bart-large-mnli"
HF_EMBED_URL = "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2"
TIMEOUT = 20  # seconds


def classify_emotion_hf(text: str) -> Dict[str, float]:
    """
    Classify emotion using HuggingFace Inference API (zero-shot classification).
    
    Uses facebook/bart-large-mnli for zero-shot classification across 6 primaries.
    Returns dict of primary emotions with probabilities.
    """
    if not HF_TOKEN:
        print("Warning: HF_TOKEN not found in environment, using fallback")
        return _mock_classify(text)
    
    # 6 primaries from Willcox wheel (v5 uses 6, not 8)
    primaries = ['Happy', 'Strong', 'Peaceful', 'Sad', 'Angry', 'Fearful']
    
    payload = {
        "inputs": text,
        "parameters": {
            "candidate_labels": [p.lower() for p in primaries],
            "multi_label": False
        }
    }
    
    try:
        response = requests.post(
            HF_ZEROSHOT_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code != 200:
            print(f"HF API error: {response.status_code} - {response.text[:200]}")
            return _mock_classify(text)
        
        result = response.json()
        
        # HF Inference API returns list of {label, score} dicts
        if isinstance(result, list) and len(result) > 0:
            # Map labels (lowercase) back to proper case
            emotion_map = {p.lower(): p for p in primaries}
            scores = {
                emotion_map.get(item['label'], item['label'].capitalize()): item['score']
                for item in result
            }
            return scores
        
        # Fallback for unexpected format
        print(f"Unexpected HF API response format: {type(result)}")
        return _mock_classify(text)
        
    except requests.Timeout:
        print("HF API timeout, using fallback")
        return _mock_classify(text)
    except Exception as e:
        print(f"HF classification error: {e}")
        import traceback
        traceback.print_exc()
        return _mock_classify(text)


def _mock_classify(text: str) -> Dict[str, float]:
    """
    Fallback keyword-based classifier when HF API unavailable.
    
    Enhanced with sarcasm/negation awareness to avoid misclassifying
    sarcastic "great" as Happy instead of Angry.
    """
    text_lower = text.lower()
    primaries = ['Happy', 'Strong', 'Peaceful', 'Sad', 'Angry', 'Fearful']
    scores = {p: 1.0/len(primaries) for p in primaries}
    
    # Check for sarcasm first (positive word + negative context)
    has_sarcasm = False
    positive_words = ['great', 'wonderful', 'perfect', 'amazing', 'fantastic', 'love']
    negative_context = ['deadline', 'stress', 'problem', 'issue', 'fail', 'delay', 'late']
    
    has_positive = any(w in text_lower for w in positive_words)
    has_negative = any(w in text_lower for w in negative_context)
    
    # Sarcasm patterns
    if has_positive and has_negative:
        has_sarcasm = True
    if 'not' in text_lower and any(w in text_lower for w in ['stressed', 'worried', 'anxious', 'fine']):
        has_sarcasm = True  # "not stressed at all" = sarcastic stress
    
    # If sarcasm detected, boost Angry/Fearful
    if has_sarcasm:
        scores['Angry'] = 0.5
        scores['Fearful'] = 0.3
        scores['Happy'] = 0.05
        total = sum(scores.values())
        return {k: v/total for k, v in scores.items()}
    
    # Standard keyword matching (no sarcasm)
    # Check for strong positive events first (career, achievement)
    if any(w in text_lower for w in ['promoted', 'promotion', 'hired', 'accepted', 'won', 'success']):
        scores['Happy'] = 0.7
        scores['Strong'] = 0.2
    # Then emotion keywords
    elif any(w in text_lower for w in ['happy', 'glad', 'joy', 'excited', 'amazing', 'wonderful']):
        scores['Happy'] = 0.6
    elif any(w in text_lower for w in ['strong', 'confident', 'powerful', 'capable', 'proud']):
        scores['Strong'] = 0.6
    elif any(w in text_lower for w in ['calm', 'peaceful', 'relaxed', 'serene']):
        scores['Peaceful'] = 0.6
    elif any(w in text_lower for w in ['sad', 'down', 'depressed', 'unhappy', 'crying', 'devastated']):
        scores['Sad'] = 0.6
    elif any(w in text_lower for w in ['angry', 'mad', 'furious', 'pissed', 'annoyed', 'frustrated']):
        scores['Angry'] = 0.6
    elif any(w in text_lower for w in ['scared', 'afraid', 'anxious', 'worried', 'fearful', 'stressed']):
        scores['Fearful'] = 0.6
    # Check for strong negative events
    elif any(w in text_lower for w in ['fired', 'rejected', 'failed', 'lost', 'breakup']):
        scores['Sad'] = 0.5
        scores['Fearful'] = 0.3
    
    # Normalize
    total = sum(scores.values())
    return {k: v/total for k, v in scores.items()}


def compute_secondary_similarity(text: str, secondaries: List[str]) -> Dict[str, float]:
    """
    Compute cosine similarity between text and secondary emotions using embeddings.
    
    Uses sentence-transformers/all-MiniLM-L6-v2 via HF Inference API.
    Returns dict of secondary → similarity score.
    """
    if not HF_TOKEN or not secondaries:
        # Fallback to uniform
        return {sec: 1.0 / len(secondaries) for sec in secondaries}
    
    payload = {
        "inputs": {
            "source_sentence": text,
            "sentences": secondaries
        }
    }
    
    try:
        response = requests.post(
            HF_EMBED_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json=payload,
            timeout=TIMEOUT
        )
        
        if response.status_code != 200:
            print(f"HF embedding API error: {response.status_code}")
            return {sec: 1.0 / len(secondaries) for sec in secondaries}
        
        similarities = response.json()  # List of floats
        
        # Map to dict
        return {
            sec: float(sim)
            for sec, sim in zip(secondaries, similarities)
        }
        
    except requests.Timeout:
        print("HF embedding API timeout")
        return {sec: 1.0 / len(secondaries) for sec in secondaries}
    except Exception as e:
        print(f"Embedding error: {e}")
        return {sec: 1.0 / len(secondaries) for sec in secondaries}


def enrich(
    text: str,
    include_tertiary: bool = True,
    include_neutral: bool = True,
    timestamp: Optional[datetime] = None,
    context: Optional[Dict] = None,
    user_priors: Optional[Dict] = None
) -> Dict:
    """
    Full enrichment pipeline with automatic HF classification.
    
    This is a wrapper around the core pipeline that adds HuggingFace Inference API integration.
    
    Args:
        text: User reflection text
        include_tertiary: Whether to compute tertiary (currently unused, for compatibility)
        include_neutral: Whether to detect neutral states (currently unused, for compatibility)
        timestamp: When reflection was created
        context: User history
        user_priors: User-specific priors
    
    Returns:
        Complete enrichment result
    """
    # Step 1: Get HF emotion probabilities via API
    p_hf = classify_emotion_hf(text)
    
    # Step 2: Get all possible secondaries (36 total from 6 primaries)
    all_secondaries = [
        # Happy secondaries
        'Joyful', 'Optimistic', 'Playful', 'Content', 'Interested', 'Proud',
        # Strong secondaries
        'Confident', 'Proud', 'Respected', 'Courageous', 'Hopeful', 'Resilient',
        # Peaceful secondaries
        'Serene', 'Trusting', 'Comfortable', 'Loving', 'Thoughtful', 'Grateful',
        # Sad secondaries
        'Lonely', 'Vulnerable', 'Despair', 'Guilty', 'Depressed', 'Hurt',
        # Angry secondaries
        'Mad', 'Frustrated', 'Distant', 'Critical', 'Annoyed', 'Bitter',
        # Fearful secondaries
        'Scared', 'Anxious', 'Insecure', 'Weak', 'Rejected', 'Threatened'
    ]
    
    # Step 3: Compute secondary similarity via HF embedding API
    secondary_similarity = compute_secondary_similarity(text, all_secondaries)
    
    # Step 4: Call core pipeline
    result = enrich_core(
        text=text,
        p_hf=p_hf,
        secondary_similarity=secondary_similarity,
        driver_scores=None,
        history=context,
        user_priors=user_priors
    )
    
    return result
