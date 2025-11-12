"""
Profanity sentiment analysis module.
Distinguishes positive hype from negative frustration and adjusts arousal.
"""
import json
from pathlib import Path
from typing import Dict, Tuple, Optional, List

# Load profanity rules
RULES_DIR = Path(__file__).parent.parent.parent / 'rules'
with open(RULES_DIR / 'profanity.json', 'r') as f:
    PROFANITY_RULES = json.load(f)

POSITIVE_HYPE = PROFANITY_RULES['positive_hype']
NEGATIVE_FRUSTRATION = PROFANITY_RULES['negative_frustration']
AROUSAL_BOOST_RANGE = PROFANITY_RULES['arousal_boost_range']


def detect_profanity(text: str) -> Tuple[Optional[str], List[str]]:
    """
    Detect profanity and classify as positive/negative.
    
    Returns:
        (sentiment, matched_phrases) where sentiment ∈ {positive, negative, None}
    """
    text_lower = text.lower()
    matched_phrases = []
    
    # Check positive hype (phrase-level first)
    for phrase in POSITIVE_HYPE:
        if phrase in text_lower:
            matched_phrases.append(phrase)
    
    if matched_phrases:
        return 'positive', matched_phrases
    
    # Check negative frustration
    matched_phrases = []
    for phrase in NEGATIVE_FRUSTRATION:
        if phrase in text_lower:
            matched_phrases.append(phrase)
    
    if matched_phrases:
        return 'negative', matched_phrases
    
    return None, []


def compute_arousal_boost(profanity_count: int) -> float:
    """
    Calculate arousal boost based on profanity frequency.
    
    Returns:
        Arousal boost in range [0.05, 0.12]
    """
    min_boost, max_boost = AROUSAL_BOOST_RANGE
    
    # Linear scale: 1 phrase = min, 3+ phrases = max
    boost = min_boost + min(profanity_count - 1, 2) * (max_boost - min_boost) / 2
    
    return max(min_boost, min(max_boost, boost))


def apply_profanity_sentiment(
    text: str,
    p_hf: Dict[str, float],
    domain: str,
    control: str,
    base_arousal: float
) -> Tuple[Dict[str, float], float, str]:
    """
    Apply profanity sentiment analysis.
    
    Args:
        text: Input text
        p_hf: HF model probabilities
        domain: Event domain
        control: Control level {low, medium, high}
        base_arousal: Base arousal before profanity boost
        
    Returns:
        (modified_probs, modified_arousal, profanity_kind)
    """
    sentiment, matched_phrases = detect_profanity(text)
    
    if sentiment is None:
        return p_hf.copy(), base_arousal, 'none'
    
    # Calculate arousal boost
    arousal_boost = compute_arousal_boost(len(matched_phrases))
    modified_arousal = min(1.0, base_arousal + arousal_boost)
    
    modified_probs = p_hf.copy()
    
    if sentiment == 'positive':
        # Positive hype: keep positive emotions, boost arousal
        # Boost Happy/Strong slightly
        for emotion in ['Happy', 'Strong']:
            if emotion in modified_probs:
                modified_probs[emotion] *= 1.1
    
    elif sentiment == 'negative':
        # Negative frustration: boost Angry/Sad based on domain/control
        # work + low control → Angry/Fearful
        # other contexts → Angry/Sad
        
        if domain == 'work' and control == 'low':
            # Boost Angry and Fearful
            boost_emotions = ['Angry', 'Fearful']
        else:
            # Boost Angry and Sad
            boost_emotions = ['Angry', 'Sad']
        
        for emotion in boost_emotions:
            if emotion in modified_probs:
                modified_probs[emotion] *= 1.15
    
    # Renormalize
    total = sum(modified_probs.values())
    if total > 0:
        modified_probs = {k: v / total for k, v in modified_probs.items()}
    
    return modified_probs, modified_arousal, sentiment


def extract_profanity_cues(text: str) -> Dict:
    """
    Extract profanity metadata.
    
    Returns:
        {
            'profanity_kind': str,  # positive, negative, none
            'matched_phrases': List[str],
            'count': int,
            'arousal_boost': float
        }
    """
    sentiment, matched_phrases = detect_profanity(text)
    
    arousal_boost = 0.0
    if sentiment:
        arousal_boost = compute_arousal_boost(len(matched_phrases))
    
    return {
        'profanity_kind': sentiment or 'none',
        'matched_phrases': matched_phrases,
        'count': len(matched_phrases),
        'arousal_boost': arousal_boost
    }
