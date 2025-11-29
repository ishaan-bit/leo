"""
Graded Negation and Litotes Detection

Replaces binary negation flips with strength-aware adjustments.

Negation Strength:
- Weak: "not good" → -0.7 (attenuated flip)
- Moderate: "not happy" → -0.8 (standard negation)
- Strong: "not at all", "never" → -1.0 (complete reversal)

Litotes (Double Negatives):
- "not unhappy" → +0.3 (attenuated positive)
- "not bad" → +0.4 (mild positive)
- "not unsuccessful" → +0.5 (moderate positive)

This module provides nuanced negation handling that preserves semantic subtlety.

LEGACY SUPPORT: Also maintains backward-compatible emotion flip logic for existing pipeline.
"""

import re
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass


@dataclass
class NegationResult:
    """Result of negation analysis"""
    has_negation: bool
    strength: str  # 'weak', 'moderate', 'strong', 'litotes', or 'none'
    flip_factor: float  # Multiplier for valence adjustment
    explanation: str


# ============================================================================
# GRADED NEGATION SYSTEM (v2.2)
# ============================================================================

# Negation markers with strength levels
STRONG_NEGATION = [
    r'\bnot at all\b',
    r'\bnever\b',
    r'\bnot even\b',
    r'\bno way\b',
    r'\babsolutely not\b',
    r'\bdefinitely not\b',
    r'\bcertainly not\b',
]

MODERATE_NEGATION = [
    r'\bnot\b',
    r'\bdon\'?t\b',
    r'\bdoesn\'?t\b',
    r'\bdidn\'?t\b',
    r'\bwon\'?t\b',
    r'\bwouldn\'?t\b',
    r'\bcan\'?t\b',
    r'\bcouldn\'?t\b',
    r'\bisn\'?t\b',
    r'\bwasn\'?t\b',
    r'\baren\'?t\b',
    r'\bweren\'?t\b',
    r'\bhasn\'?t\b',
    r'\bhaven\'?t\b',
    r'\bhadn\'?t\b',
]

WEAK_NEGATION = [
    r'\bbarely\b',
    r'\bhardly\b',
    r'\bscarcely\b',
    r'\bseldom\b',
    r'\brarely\b',
]

# Litotes patterns (double negatives that create positive meaning)
LITOTES_PATTERNS = [
    # Pattern: (regex, base_score, explanation)
    (r'\bnot (un|in)happy\b', 0.30, 'not_unhappy→mild_positive'),
    (r'\bnot (un|in)pleasant\b', 0.35, 'not_unpleasant→mild_positive'),
    (r'\b(not|n\'t|wasn\'t|isn\'t|aren\'t)\s+(bad|terrible|awful|horrible)\b', 0.40, 'not_bad→moderate_positive'),
    (r'\b(not\s+a|not\s+an)\s+(bad|terrible|awful|horrible)\b', 0.40, 'not_a_terrible→moderate_positive'),
    (r'\bnot (un|in)successful\b', 0.50, 'not_unsuccessful→moderate_positive'),
    (r'\bnot (un|in)common\b', 0.50, 'not_uncommon→moderate_positive'),
    (r'\bnot (un|in)likely\b', 0.55, 'not_unlikely→moderate_positive'),
    (r'\bnot (un|in)important\b', 0.60, 'not_unimportant→strong_positive'),
    (r'\bnot (un|in)helpful\b', 0.55, 'not_unhelpful→moderate_positive'),
    (r'\bnot wrong\b', 0.50, 'not_wrong→moderate_positive'),
    (r'\bnot (un|in)interesting\b', 0.45, 'not_uninteresting→moderate_positive'),
    (r'\bnot (un|in)grateful\b', 0.55, 'not_ungrateful→moderate_positive'),
]


# ============================================================================
# LEGACY EMOTION FLIP SYSTEM (v2.0/v2.1)
# ============================================================================

NEGATION_TOKENS = ["not", "n't", "no", "never", "none", "neither", "nor", "nothing", "nowhere", "nobody", "without", "hardly", "barely"]
FORWARD_ONLY_NEGATIONS = {"without", "no"}

EMOTION_KEYWORDS = {
    'Happy': ['happy', 'joy', 'joyful', 'glad', 'cheerful', 'delighted', 'pleased', 'content'],
    'Strong': ['strong', 'powerful', 'confident', 'proud', 'capable', 'empowered'],
    'Peaceful': ['peaceful', 'calm', 'relaxed', 'serene', 'tranquil', 'content'],
    'Sad': ['sad', 'unhappy', 'down', 'depressed', 'miserable', 'gloomy'],
    'Angry': ['angry', 'mad', 'furious', 'irritated', 'annoyed', 'frustrated'],
    'Fearful': ['afraid', 'scared', 'anxious', 'worried', 'fearful', 'nervous', 'terrified']
}

NEGATION_FLIP_MAP = {
    'Happy': 'Sad',
    'Sad': 'Peaceful',
    'Angry': 'Peaceful',
    'Fearful': 'Peaceful',
    'Strong': 'Fearful',
    'Peaceful': 'Fearful'
}


# ============================================================================
# GRADED NEGATION API (v2.2)
# ============================================================================

def detect_litotes(text: str) -> Tuple[bool, Optional[float], Optional[str]]:
    """
    Detect litotes (double negatives conveying attenuated positive meaning).
    
    Args:
        text: Input text
        
    Returns:
        (is_litotes, positive_score, explanation)
        - is_litotes: True if litotes detected
        - positive_score: Attenuated positive value [0, 1] or None
        - explanation: Human-readable description or None
    """
    text_lower = text.lower()
    
    for pattern_str, score, explanation in LITOTES_PATTERNS:
        pattern = re.compile(pattern_str, re.IGNORECASE)
        if pattern.search(text_lower):
            return True, score, explanation
    
    return False, None, None


def detect_negation_strength(text: str) -> str:
    """
    Detect negation strength in text.
    
    Args:
        text: Input text
        
    Returns:
        'strong', 'moderate', 'weak', or 'none'
    """
    text_lower = text.lower()
    
    # Check strong negation first (most specific)
    for pattern_str in STRONG_NEGATION:
        if re.search(pattern_str, text_lower, re.IGNORECASE):
            return 'strong'
    
    # Check moderate negation
    for pattern_str in MODERATE_NEGATION:
        if re.search(pattern_str, text_lower, re.IGNORECASE):
            return 'moderate'
    
    # Check weak negation
    for pattern_str in WEAK_NEGATION:
        if re.search(pattern_str, text_lower, re.IGNORECASE):
            return 'weak'
    
    return 'none'


def compute_negation_factor(strength: str) -> float:
    """
    Get flip factor for negation strength.
    
    Args:
        strength: 'strong', 'moderate', 'weak', or 'none'
        
    Returns:
        Flip factor (negative multiplier)
        - strong: -1.0 (complete reversal)
        - moderate: -0.8 (standard negation)
        - weak: -0.7 (attenuated flip)
        - none: 0.0 (no flip)
    """
    factors = {
        'strong': -1.0,
        'moderate': -0.8,
        'weak': -0.7,
        'none': 0.0
    }
    return factors.get(strength, 0.0)


def analyze_negation(text: str) -> NegationResult:
    """
    Comprehensive negation analysis with graded strength and litotes detection.
    
    Args:
        text: Input text
        
    Returns:
        NegationResult with strength, flip factor, and explanation
    """
    # First check for litotes (takes precedence over simple negation)
    is_litotes, litotes_score, litotes_explanation = detect_litotes(text)
    
    if is_litotes:
        return NegationResult(
            has_negation=True,
            strength='litotes',
            flip_factor=litotes_score,  # Positive score, not a flip
            explanation=litotes_explanation
        )
    
    # Check for standard negation
    strength = detect_negation_strength(text)
    
    if strength == 'none':
        return NegationResult(
            has_negation=False,
            strength='none',
            flip_factor=0.0,
            explanation='no_negation_detected'
        )
    
    flip_factor = compute_negation_factor(strength)
    
    return NegationResult(
        has_negation=True,
        strength=strength,
        flip_factor=flip_factor,
        explanation=f'{strength}_negation(flip×{flip_factor:.1f})'
    )


def apply_negation_to_valence(
    base_valence: float,
    text: str,
    neutral_point: float = 0.5
) -> Tuple[float, str]:
    """
    Apply graded negation adjustment to valence score.
    
    Args:
        base_valence: Original valence score [0, 1]
        text: Input text (for negation detection)
        neutral_point: Neutral reference point (default 0.5)
        
    Returns:
        (adjusted_valence, explanation)
        
    Examples:
        >>> apply_negation_to_valence(0.8, "not good")
        (0.26, 'moderate_negation(flip×-0.8)')
        # Calculation: 0.5 + (0.8 - 0.5) * -0.8 = 0.5 + (-0.24) = 0.26
        
        >>> apply_negation_to_valence(0.3, "not bad")
        (0.4, 'not_bad→moderate_positive')
        # Litotes detected, returns fixed positive score
        
        >>> apply_negation_to_valence(0.9, "never happy")
        (0.1, 'strong_negation(flip×-1.0)')
        # Calculation: 0.5 + (0.9 - 0.5) * -1.0 = 0.5 + (-0.4) = 0.1
    """
    negation = analyze_negation(text)
    
    if not negation.has_negation:
        return base_valence, 'no_negation'
    
    # Litotes: return fixed positive score (not a flip)
    if negation.strength == 'litotes':
        return negation.flip_factor, negation.explanation
    
    # Graded flip: flip around neutral point with strength factor
    deviation = base_valence - neutral_point
    adjusted_deviation = deviation * negation.flip_factor
    adjusted_valence = neutral_point + adjusted_deviation
    
    # Clamp to [0, 1]
    adjusted_valence = max(0.0, min(1.0, adjusted_valence))
    
    return adjusted_valence, negation.explanation


def get_negation_indicators(text: str) -> List[str]:
    """
    Get list of all negation indicators found in text.
    
    Useful for debugging and explanation generation.
    
    Args:
        text: Input text
        
    Returns:
        List of matched negation patterns
    """
    indicators = []
    text_lower = text.lower()
    
    # Check litotes
    for pattern_str, _, explanation in LITOTES_PATTERNS:
        if re.search(pattern_str, text_lower, re.IGNORECASE):
            indicators.append(f'litotes:{explanation}')
    
    # Check strong negation
    for pattern_str in STRONG_NEGATION:
        if re.search(pattern_str, text_lower, re.IGNORECASE):
            match = re.search(pattern_str, text_lower, re.IGNORECASE)
            indicators.append(f'strong:{match.group(0)}')
    
    # Check moderate negation
    for pattern_str in MODERATE_NEGATION:
        if re.search(pattern_str, text_lower, re.IGNORECASE):
            match = re.search(pattern_str, text_lower, re.IGNORECASE)
            indicators.append(f'moderate:{match.group(0)}')
    
    # Check weak negation
    for pattern_str in WEAK_NEGATION:
        if re.search(pattern_str, text_lower, re.IGNORECASE):
            match = re.search(pattern_str, text_lower, re.IGNORECASE)
            indicators.append(f'weak:{match.group(0)}')
    
    return indicators


# ============================================================================
# LEGACY EMOTION FLIP API (v2.0/v2.1 - Backward Compatible)
# ============================================================================

def tokenize(text: str) -> List[Tuple[str, int]]:
    """
    Tokenize text and return (token, index) pairs.
    
    Returns:
        List of (token, token_index) tuples
    """
    tokens = text.lower().split()
    return [(token, i) for i, token in enumerate(tokens)]


def get_negation_scope(tokens: List[Tuple[str, int]]) -> Dict[int, bool]:
    """
    Get negation scope: marks tokens affected by negation words.
    
    Context-aware windows:
    - Forward-only negations (without, no): affect 0 to +3 tokens
    - Bidirectional negations (not, n't, never): affect -1 to +3 tokens
    
    Args:
        tokens: List of (token, index) pairs
        
    Returns:
        Dict mapping token_index -> is_negated
    """
    negation_scope = {}
    
    for token, idx in tokens:
        # Check if token contains negation
        is_negation = False
        is_forward_only = False
        
        if "n't" in token:
            is_negation = True
            is_forward_only = False  # Contractions can negate backward ("didn't fail")
        elif token in NEGATION_TOKENS:
            is_negation = True
            is_forward_only = (token in FORWARD_ONLY_NEGATIONS)
            
        if is_negation:
            if is_forward_only:
                # Forward only: 0 to +3 (without, no)
                for offset in range(0, 4):  # 0, 1, 2, 3
                    target_idx = idx + offset
                    if 0 <= target_idx < len(tokens):
                        negation_scope[target_idx] = True
            else:
                # Bidirectional: -1 to +3 (not, never, n't)
                for offset in range(-1, 4):  # -1, 0, 1, 2, 3
                    target_idx = idx + offset
                    if 0 <= target_idx < len(tokens):
                        negation_scope[target_idx] = True
    
    return negation_scope


def detect_negations(text: str) -> List[Tuple[int, str]]:
    """
    Detect all negation tokens and their positions.
    
    Returns:
        List of (token_index, negation_token) tuples
    """
    tokens = tokenize(text)
    negations = []
    
    for token, idx in tokens:
        # Handle contractions like "isn't", "can't"
        if "n't" in token:
            negations.append((idx, "n't"))
        elif token in NEGATION_TOKENS:
            negations.append((idx, token))
    
    return negations


def find_emotion_keywords(text: str) -> List[Tuple[int, str, str]]:
    """
    Find emotion keywords and their token positions.
    
    Returns:
        List of (token_index, emotion_primary, keyword) tuples
    """
    tokens = tokenize(text)
    emotion_matches = []
    
    for token, idx in tokens:
        for primary, keywords in EMOTION_KEYWORDS.items():
            if token in keywords or any(kw in token for kw in keywords):
                emotion_matches.append((idx, primary, token))
                break
    
    return emotion_matches


def check_negation_window(neg_pos: int, emotion_pos: int, window_size: int = 3) -> bool:
    """
    Check if negation is within window_size tokens before emotion keyword.
    """
    return 0 < (emotion_pos - neg_pos) <= window_size


def apply_negation_flip(text: str, p_hf: Dict[str, float]) -> Tuple[Dict[str, float], bool]:
    """
    Apply negation reversal to emotion probabilities.
    
    LEGACY FUNCTION for backward compatibility with v2.0/v2.1 pipeline.
    
    Args:
        text: Input text
        p_hf: Original HF model probabilities {primary: prob}
        
    Returns:
        (modified_probs, negation_flag)
    """
    negations = detect_negations(text)
    emotion_keywords = find_emotion_keywords(text)
    
    if not negations or not emotion_keywords:
        return p_hf.copy(), False
    
    # Check for negation-emotion pairs
    negation_detected = False
    flip_emotions = set()
    
    for neg_pos, neg_token in negations:
        for emotion_pos, primary, keyword in emotion_keywords:
            if check_negation_window(neg_pos, emotion_pos):
                negation_detected = True
                flip_emotions.add(primary)
    
    if not negation_detected:
        return p_hf.copy(), False
    
    # Apply flip logic
    modified_probs = p_hf.copy()
    
    for emotion_to_flip in flip_emotions:
        if emotion_to_flip in NEGATION_FLIP_MAP:
            target_emotion = NEGATION_FLIP_MAP[emotion_to_flip]
            
            # Transfer probability: reduce original, boost target
            original_prob = modified_probs.get(emotion_to_flip, 0.0)
            transfer_amount = original_prob * 0.6  # Transfer 60% of probability
            
            modified_probs[emotion_to_flip] = max(0.0, original_prob - transfer_amount)
            modified_probs[target_emotion] = modified_probs.get(target_emotion, 0.0) + transfer_amount
    
    # Renormalize
    total = sum(modified_probs.values())
    if total > 0:
        modified_probs = {k: v / total for k, v in modified_probs.items()}
    
    return modified_probs, True


def extract_negation_cues(text: str) -> Dict:
    """
    Extract negation metadata for willingness scoring and confidence.
    
    LEGACY FUNCTION for backward compatibility.
    
    Returns:
        {
            'negation_count': int,
            'negations': List[str],
            'negated_emotions': List[str],
            'negation_flag': bool
        }
    """
    negations = detect_negations(text)
    emotion_keywords = find_emotion_keywords(text)
    
    negated_emotions = []
    for neg_pos, _ in negations:
        for emotion_pos, primary, _ in emotion_keywords:
            if check_negation_window(neg_pos, emotion_pos):
                negated_emotions.append(primary)
    
    return {
        'negation_count': len(negations),
        'negations': [neg[1] for neg in negations],
        'negated_emotions': list(set(negated_emotions)),
        'negation_flag': len(negated_emotions) > 0
    }


__all__ = [
    # v2.2 Graded Negation API
    'NegationResult',
    'detect_litotes',
    'detect_negation_strength',
    'compute_negation_factor',
    'analyze_negation',
    'apply_negation_to_valence',
    'get_negation_indicators',
    # Legacy v2.0/v2.1 API
    'tokenize',
    'get_negation_scope',
    'detect_negations',
    'find_emotion_keywords',
    'check_negation_window',
    'apply_negation_flip',
    'extract_negation_cues',
]

