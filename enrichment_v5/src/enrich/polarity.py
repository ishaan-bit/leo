"""
Polarity detection module with augmented rules.
Handles planned/happened/did_not_happen with present-progressive and counterfactuals.
"""
import re
from typing import Tuple, Dict

# Pattern lists
PLANNED_PATTERNS = [
    'will', 'going to', 'planning', 'scheduled', 'upcoming', 'gonna',
    'intend to', 'aim to', 'want to', 'hope to', 'next week', 'tomorrow',
    'soon', 'later', 'eventually'
]

DID_NOT_HAPPEN_PATTERNS = [
    "didn't", "did not", 'failed', 'missed', 'cancelled', 'postponed',
    'unable to', "couldn't", "wasn't able", 'never happened', 'fell through',
    'called off', 'abandoned', 'gave up on'
]

COUNTERFACTUAL_PATTERNS = [
    'if i had', 'wish i had', 'should have', 'could have', 'would have',
    'if only', 'regret not', 'wish i could', 'if i could'
]

PRESENT_PROGRESSIVE_PATTERNS = [
    "i'm working", "i'm doing", "i'm trying", "i'm handling", "i'm managing",
    "currently", "right now", "at the moment", "in progress"
]


def detect_counterfactual(text: str) -> bool:
    """
    Detect counterfactual expressions.
    Example: "If I had studied" → did_not_happen
    """
    text_lower = text.lower()
    
    for pattern in COUNTERFACTUAL_PATTERNS:
        if pattern in text_lower:
            return True
    
    return False


def detect_present_progressive(text: str) -> bool:
    """
    Detect present progressive (ongoing action).
    Example: "I'm working on it" → happened (ongoing)
    """
    text_lower = text.lower()
    
    for pattern in PRESENT_PROGRESSIVE_PATTERNS:
        if pattern in text_lower:
            return True
    
    # Regex for "I'm [verb]ing"
    if re.search(r"\bi'?m\s+\w+ing\b", text_lower):
        return True
    
    return False


def detect_explicit_future(text: str) -> bool:
    """
    Detect explicit future markers.
    """
    text_lower = text.lower()
    
    for pattern in PLANNED_PATTERNS:
        if pattern in text_lower:
            return True
    
    return False


def detect_explicit_negation(text: str) -> bool:
    """
    Detect explicit did_not_happen markers.
    """
    text_lower = text.lower()
    
    for pattern in DID_NOT_HAPPEN_PATTERNS:
        if pattern in text_lower:
            return True
    
    return False


def detect_polarity_rule_based(text: str) -> Tuple[str, float]:
    """
    Detect event polarity with disambiguation precedence.
    
    Precedence: explicit negation > counterfactual > future > present > default past
    
    Returns:
        (polarity, confidence)
        polarity ∈ {planned, happened, did_not_happen}
        confidence ∈ [0, 1]
    """
    # Explicit negation (highest priority)
    if detect_explicit_negation(text):
        return 'did_not_happen', 0.85
    
    # Counterfactual (second priority)
    if detect_counterfactual(text):
        return 'did_not_happen', 0.80
    
    # Explicit future (third priority)
    if detect_explicit_future(text):
        return 'planned', 0.80
    
    # Present progressive (fourth priority)
    if detect_present_progressive(text):
        # Check for future markers within present progressive
        if any(marker in text.lower() for marker in ['will', 'going to', 'next']):
            return 'planned', 0.70
        else:
            return 'happened', 0.75
    
    # Default: past tense (happened)
    # Low confidence default
    return 'happened', 0.50


def extract_polarity_metadata(text: str) -> Dict:
    """
    Extract detailed polarity detection metadata.
    
    Returns:
        {
            'polarity': str,
            'confidence': float,
            'counterfactual': bool,
            'explicit_negation': bool,
            'future_markers': bool,
            'present_progressive': bool,
            'matched_patterns': List[str]
        }
    """
    polarity, confidence = detect_polarity_rule_based(text)
    
    text_lower = text.lower()
    matched_patterns = []
    
    # Collect matched patterns
    if detect_counterfactual(text):
        matched_patterns.extend([p for p in COUNTERFACTUAL_PATTERNS if p in text_lower])
    
    if detect_explicit_negation(text):
        matched_patterns.extend([p for p in DID_NOT_HAPPEN_PATTERNS if p in text_lower])
    
    if detect_explicit_future(text):
        matched_patterns.extend([p for p in PLANNED_PATTERNS if p in text_lower])
    
    if detect_present_progressive(text):
        matched_patterns.extend([p for p in PRESENT_PROGRESSIVE_PATTERNS if p in text_lower])
    
    return {
        'polarity': polarity,
        'confidence': confidence,
        'counterfactual': detect_counterfactual(text),
        'explicit_negation': detect_explicit_negation(text),
        'future_markers': detect_explicit_future(text),
        'present_progressive': detect_present_progressive(text),
        'matched_patterns': list(set(matched_patterns))
    }
