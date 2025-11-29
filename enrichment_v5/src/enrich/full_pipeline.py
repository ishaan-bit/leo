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
        print(f"[HF API] Calling classify_emotion_hf for text: {text[:80]}...")
        response = requests.post(
            HF_ZEROSHOT_URL,
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            json=payload,
            timeout=TIMEOUT
        )
        
        print(f"[HF API] Response status: {response.status_code}")
        
        if response.status_code != 200:
            print(f"[HF API] ERROR {response.status_code}: {response.text[:200]}")
            print(f"[HF API] Falling back to keyword classifier")
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
            print(f"[HF API] SUCCESS - Top scores: {sorted(scores.items(), key=lambda x: x[1], reverse=True)[:3]}")
            return scores
        
        # Fallback for unexpected format
        print(f"[HF API] Unexpected response format: {type(result)}, falling back")
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
    
    Enhanced v5.1 with:
    - Joy/celebration vs achievement distinction
    - Negation and contrast detection ("but", "however")
    - Physiological anxiety cues
    - Self-directed anger detection
    """
    print(f"[FALLBACK] Using keyword classifier for: {text[:80]}...")
    
    text_lower = text.lower()
    primaries = ['Happy', 'Strong', 'Peaceful', 'Sad', 'Angry', 'Fearful']
    scores = {p: 1.0/len(primaries) for p in primaries}
    
    # Check for negation/contrast patterns FIRST
    # "X but Y" or "X however Y" - the Y part is the true emotion
    has_contrast = False
    contrast_second_half = text_lower
    
    if ' but ' in text_lower:
        contrast_second_half = text_lower.split(' but ', 1)[1]
        has_contrast = True
    elif ' however ' in text_lower:
        contrast_second_half = text_lower.split(' however ', 1)[1]
        has_contrast = True
    
    # Use the post-contrast text if present
    analysis_text = contrast_second_half if has_contrast else text_lower
    
    # Check for self-directed anger/guilt ("I hate myself", "I feel guilty")
    self_anger_words = ['hate myself', 'guilty', 'blame myself', 'my fault', 'shame']
    if any(w in analysis_text for w in self_anger_words):
        print("[FALLBACK] Detected self-directed anger → Angry or Sad")
        # Angry if active self-criticism, Sad if passive guilt
        if 'hate myself' in analysis_text or 'wasting' in analysis_text:
            scores['Angry'] = 0.6
            scores['Sad'] = 0.2
        else:
            scores['Sad'] = 0.6
            scores['Fearful'] = 0.2
        total = sum(scores.values())
        return {k: v/total for k, v in scores.items()}
    
    # Check for physiological anxiety cues (high arousal)
    anxiety_physical = [
        'heart racing', 'heart starts racing', 'can\'t sleep', 'cannot sleep',
        'keep checking', 'constantly checking', 'stomach hurts', 'hands shaking',
        'feel sick', 'throwing up', 'can\'t breathe'
    ]
    has_physical_anxiety = any(cue in analysis_text for cue in anxiety_physical)
    
    if has_physical_anxiety:
        print("[FALLBACK] Detected physiological anxiety → Fearful")
        scores['Fearful'] = 0.7
        scores['Sad'] = 0.1
        total = sum(scores.values())
        return {k: v/total for k, v in scores.items()}
    
    # Check for frustration/irritation keywords
    frustration_words = [
        'irritating', 'irritated', 'frustrat', 'annoyed', 'annoying',
        'boss around', 'doesnt do shit', 'doesn\'t do shit', 'useless manager',
        'terrible manager', 'new manager', 'micromanag', 'waste of time',
        'pain in the ass', 'driving me crazy', 'sick of', 'fed up'
    ]
    has_frustration = any(word in analysis_text for word in frustration_words)
    
    if has_frustration:
        print("[FALLBACK] Detected frustration/irritation → Angry")
        scores['Angry'] = 0.6
        scores['Fearful'] = 0.2
        total = sum(scores.values())
        return {k: v/total for k, v in scores.items()}
    
    # Check for sarcasm (positive word + negative context)
    has_sarcasm = False
    positive_words = ['great', 'wonderful', 'perfect', 'amazing', 'fantastic', 'love']
    negative_context = ['deadline', 'stress', 'problem', 'issue', 'fail', 'delay', 'late']
    
    has_positive = any(w in analysis_text for w in positive_words)
    has_negative = any(w in analysis_text for w in negative_context)
    
    # Sarcasm patterns
    if has_positive and has_negative:
        has_sarcasm = True
    if 'not' in analysis_text and any(w in analysis_text for w in ['stressed', 'worried', 'anxious', 'fine']):
        has_sarcasm = True  # "not stressed at all" = sarcastic stress
    
    # If sarcasm detected, boost Angry/Fearful
    if has_sarcasm:
        scores['Angry'] = 0.5
        scores['Fearful'] = 0.3
        scores['Happy'] = 0.05
        total = sum(scores.values())
        return {k: v/total for k, v in scores.items()}
    
    # Standard keyword matching (no sarcasm)
    # JOY/CELEBRATION keywords (distinct from achievement)
    joy_celebration = [
        'laughed', 'laugh', 'laughter', 'smiling', 'smile', 'fun', 'enjoy',
        'love it', 'loved it', 'best day', 'so good', 'felt good', 'feels good'
    ]
    if any(w in analysis_text for w in joy_celebration):
        print("[FALLBACK] Detected joy/celebration → Happy")
        scores['Happy'] = 0.7
        scores['Peaceful'] = 0.2
    # ACHIEVEMENT keywords (distinct from joy)
    elif any(w in analysis_text for w in ['smashed', 'nailed', 'crushed', 'handled', 'managing', 'better than expected']):
        print("[FALLBACK] Detected achievement → Happy with Strong undertone")
        scores['Happy'] = 0.5
        scores['Strong'] = 0.3
    # Career success
    elif any(w in analysis_text for w in ['promoted', 'promotion', 'hired', 'accepted', 'won', 'success']):
        scores['Happy'] = 0.7
        scores['Strong'] = 0.2
    # General positive emotions
    elif any(w in analysis_text for w in ['happy', 'glad', 'joy', 'excited', 'amazing', 'wonderful']):
        scores['Happy'] = 0.6
    # Strength/competence (NOT achievement)
    elif any(w in analysis_text for w in ['strong', 'confident', 'powerful', 'capable']):
        scores['Strong'] = 0.6
    # Peace/calm
    elif any(w in analysis_text for w in ['calm', 'peaceful', 'relaxed', 'serene']):
        scores['Peaceful'] = 0.6
    # Sadness/depression
    elif any(w in analysis_text for w in ['sad', 'down', 'depressed', 'unhappy', 'crying', 'devastated', 'exhausted', 'tired all the time']):
        scores['Sad'] = 0.6
    # Anger
    elif any(w in analysis_text for w in ['angry', 'mad', 'furious', 'pissed', 'annoyed', 'frustrated']):
        scores['Angry'] = 0.6
    # Fear/anxiety
    elif any(w in analysis_text for w in ['scared', 'afraid', 'anxious', 'worried', 'fearful', 'stressed', 'hanging by a thread']):
        scores['Fearful'] = 0.6
    # Strong negative events
    elif any(w in analysis_text for w in ['fired', 'rejected', 'failed', 'lost', 'breakup']):
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
    user_priors: Optional[Dict] = None,
    use_none_gate: bool = True
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
        use_none_gate: If True, returns None for low-density moments. If False, fallback to Neutral/Calm
    
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
        user_priors=user_priors,
        use_none_gate=use_none_gate
    )
    
    return result
