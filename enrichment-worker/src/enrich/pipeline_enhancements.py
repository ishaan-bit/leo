"""
Pipeline enhancement utilities for v2.0+ lexicon-based improvements.
Includes neutral fallback, concession logic, and emotion-specific negation.
"""
from typing import Dict, Optional, Tuple, List
from enrich.lexicons import (
    get_hedges,
    get_emotion_terms,
    get_concession_markers,
    get_agency_verbs,
    get_negations
)


def detect_neutral_text(text: str, event_meta: Dict) -> bool:
    """
    Detect neutral/flat text that should not be forced into emotion.
    
    Criteria:
    - No event anchors detected
    - No strong emotion words
    - Token count ≤ 6 OR multiple hedges/repetitions
    
    Args:
        text: Input text
        event_meta: Event valence metadata dict
        
    Returns:
        True if neutral text detected
    """
    # Check for event anchors
    has_anchors = (
        len(event_meta.get('positive_anchors', [])) > 0 or 
        len(event_meta.get('negative_anchors', [])) > 0
    )
    
    text_lower = text.lower()
    tokens = text_lower.split()
    
    # Check for strong emotion words (any category)
    emotion_categories = ['joy', 'fear', 'anger', 'sad', 'peace']
    has_emotion_words = False
    for category in emotion_categories:
        emotion_terms = get_emotion_terms(category)
        if any(word in text_lower for word in emotion_terms):
            has_emotion_words = True
            break
    
    # Count hedges
    hedges = get_hedges()
    hedge_count = sum(1 for hedge in hedges if hedge in text_lower)
    
    # Check for repetition patterns ("fine. totally fine.")
    unique_words = set(tokens)
    has_repetition = len(tokens) > 0 and len(unique_words) / len(tokens) < 0.7
    
    is_short = len(tokens) <= 6
    is_hedged = hedge_count >= 2
    
    # Neutral if: no anchors AND no emotion words AND (short OR hedged OR repetitive)
    return (not has_anchors and 
            not has_emotion_words and 
            (is_short or is_hedged or has_repetition))


def create_neutral_result(
    p_hf: Dict[str, float],
    secondary_similarity: Dict[str, float]
) -> Dict:
    """
    Return neutral fallback result for flat/ambiguous text.
    
    Returns:
        Neutral enrichment result with low confidence
    """
    return {
        'primary': None,
        'secondary': None,
        'valence': 0.50,
        'arousal': 0.35,
        'event_valence': 0.50,
        'control': 'unknown',
        'polarity': 0.0,
        'domain': {'primary': 'personal', 'secondary': None, 'mixture_ratio': 1.0},
        'confidence': 0.40,
        'confidence_category': 'low',
        'flags': {
            'neutral_text': True,
            'negation': False,
            'sarcasm': False,
            'profanity': 'none'
        }
    }


def detect_concession_agency(text: str) -> Optional[str]:
    """
    Detect concession pattern with agency in second clause.
    
    Pattern: "[fear/negative] + [but/though] + [agency/positive]"
    Example: "terrified, but proud I did it"
    
    Args:
        text: Input text
        
    Returns:
        'agency_after_fear' if pattern detected, None otherwise
    """
    text_lower = text.lower()
    concession_markers = get_concession_markers()
    agency_verbs = get_agency_verbs()
    
    for marker in concession_markers:
        if marker in text_lower:
            # Split on concession marker
            parts = text_lower.split(marker, 1)
            if len(parts) == 2:
                clause1, clause2 = parts
                
                # Check for fear/negative terms in clause1
                fear_terms = get_emotion_terms('fear')
                has_fear_clause1 = any(term in clause1 for term in fear_terms)
                
                # Check for agency in clause2
                has_agency_clause2 = any(verb in clause2 for verb in agency_verbs)
                
                if has_fear_clause1 or has_agency_clause2:
                    return 'agency_after_fear'
    
    return None


def apply_concession_boost(
    p_hf: Dict[str, float],
    concession_type: str
) -> Dict[str, float]:
    """
    Boost Strong, attenuate Fearful when agency after fear detected.
    
    Args:
        p_hf: HF model probabilities
        concession_type: Type of concession detected
        
    Returns:
        Modified probabilities
    """
    modified_probs = p_hf.copy()
    
    if concession_type == 'agency_after_fear':
        # Boost Strong
        if 'Strong' in modified_probs:
            modified_probs['Strong'] *= 1.15
        
        # Attenuate Fearful
        if 'Fearful' in modified_probs:
            modified_probs['Fearful'] *= 0.85
        
        # Renormalize
        total = sum(modified_probs.values())
        if total > 0:
            modified_probs = {k: v / total for k, v in modified_probs.items()}
    
    return modified_probs


def detect_negated_joy(text: str) -> bool:
    """
    Detect if joy/happiness is negated.
    
    Pattern: negation + joy term within 3 tokens
    Example: "can't enjoy it", "not happy", "don't feel excited"
    
    Args:
        text: Input text
        
    Returns:
        True if joy negated
    """
    tokens = text.lower().split()
    negation_config = get_negations()
    negators = negation_config.get('negators', [])
    joy_terms = get_emotion_terms('joy')
    
    for i, token in enumerate(tokens):
        # Check if token contains negation
        is_negation = any(neg in token for neg in negators)
        
        if is_negation:
            # Check 3 tokens forward for joy terms
            for j in range(i, min(i + 4, len(tokens))):
                if any(joy in tokens[j] for joy in joy_terms):
                    return True
    
    return False


def apply_negated_joy_penalty(
    p_hf: Dict[str, float],
    event_valence: float
) -> Dict[str, float]:
    """
    Penalize Happy (×0.65), boost Strong (×1.15) if joy negated + high event.
    
    Pattern: "Got promoted, but can't even enjoy it"
    → High event + negated joy → Strong/Resilient (not Happy)
    
    Args:
        p_hf: HF model probabilities
        event_valence: Event valence score [0,1]
        
    Returns:
        Modified probabilities
    """
    modified_probs = p_hf.copy()
    
    # Penalize Happy
    if 'Happy' in modified_probs:
        modified_probs['Happy'] *= 0.65
    
    # Boost Strong if high event (achievement despite emotional difficulty)
    if event_valence > 0.6:
        if 'Strong' in modified_probs:
            modified_probs['Strong'] *= 1.15
    
    # Renormalize
    total = sum(modified_probs.values())
    if total > 0:
        modified_probs = {k: v / total for k, v in modified_probs.items()}
    
    return modified_probs


__all__ = [
    'detect_neutral_text',
    'create_neutral_result',
    'detect_concession_agency',
    'apply_concession_boost',
    'detect_negated_joy',
    'apply_negated_joy_penalty'
]
