"""
Valence & Arousal calculation with expanded ranges and intensity modulation.

v2.0+: Enhanced with arousal governors for hedges and effort words.
"""
import json
from pathlib import Path
from typing import Dict, Tuple, Optional
from datetime import datetime
from enrich.lexicons import get_hedges, get_effort_words

# Expanded valence/arousal ranges (reduced overlap)
WILLCOX_VA_MAP = {
    'Happy':    {'valence': (0.80, 0.92), 'arousal': (0.50, 0.65)},
    'Strong':   {'valence': (0.70, 0.88), 'arousal': (0.55, 0.72)},
    'Peaceful': {'valence': (0.72, 0.86), 'arousal': (0.28, 0.46)},
    'Sad':      {'valence': (0.12, 0.32), 'arousal': (0.28, 0.48)},
    'Angry':    {'valence': (0.20, 0.42), 'arousal': (0.64, 0.82)},
    'Fearful':  {'valence': (0.16, 0.38), 'arousal': (0.66, 0.84)},
}

# Load intensifiers
RULES_DIR = Path(__file__).parent.parent.parent / 'rules'
with open(RULES_DIR / 'intensifiers.json', 'r') as f:
    INTENSIFIER_RULES = json.load(f)

INTENSIFIERS_POS = INTENSIFIER_RULES['intensifiers_positive']
INTENSIFIERS_NEG = INTENSIFIER_RULES['intensifiers_negative']

# Driver adjustments (keep existing patterns)
DRIVER_ADJUSTMENTS = {
    'overwhelm': {'valence': -0.15, 'arousal': +0.10},
    'fatigue': {'valence': -0.10, 'arousal': -0.20},
    'relief': {'valence': +0.15, 'arousal': -0.05},
    'connection': {'valence': +0.10, 'arousal': +0.05},
    'withdrawal': {'valence': -0.20, 'arousal': -0.10},
    'urgency': {'valence': -0.08, 'arousal': +0.15},
    'achievement': {'valence': +0.12, 'arousal': +0.08}
}

# Secondary emotion adjustments
SECONDARY_AROUSAL_BOOST = ['excited', 'energetic', 'passionate', 'furious', 'panicked']
SECONDARY_AROUSAL_REDUCE = ['calm', 'content', 'relaxed', 'peaceful', 'tired', 'exhausted']


def parse_intensity(text: str) -> float:
    """
    Parse intensity modifiers from text.
    
    Returns:
        Intensity score in [-0.3, +0.3]
    """
    text_lower = text.lower()
    intensity_score = 0.0
    
    # Positive intensifiers
    for word, boost in INTENSIFIERS_POS.items():
        if word in text_lower:
            intensity_score += boost
    
    # Negative intensifiers (reducers)
    for word, reduction in INTENSIFIERS_NEG.items():
        if word in text_lower:
            intensity_score += reduction  # Already negative
    
    # Clip to range
    return max(-0.3, min(0.3, intensity_score))


def get_circadian_phase() -> str:
    """
    Get current circadian phase based on time of day.
    
    Returns:
        'morning', 'afternoon', 'evening', or 'night'
    """
    hour = datetime.now().hour
    
    if 6 <= hour < 12:
        return 'morning'
    elif 12 <= hour < 17:
        return 'afternoon'
    elif 17 <= hour < 22:
        return 'evening'
    else:
        return 'night'


def apply_circadian_priors(valence: float, arousal: float, phase: str) -> Tuple[float, float]:
    """
    Apply circadian-based adjustments.
    """
    if phase == 'morning':
        valence += 0.10
        arousal += 0.15
    elif phase == 'night':
        valence -= 0.07
        arousal -= 0.07
    # afternoon/evening: no adjustment
    
    return valence, arousal


def compute_base_va(primary: str, secondary: Optional[str], intensity: float) -> Tuple[float, float]:
    """
    Compute base valence/arousal with intensity modulation.
    
    Args:
        primary: Primary emotion
        secondary: Secondary emotion (optional)
        intensity: Intensity score from parse_intensity
        
    Returns:
        (base_valence, base_arousal)
    """
    # Get range for primary
    va_range = WILLCOX_VA_MAP.get(primary, {'valence': (0.4, 0.6), 'arousal': (0.4, 0.6)})
    
    # Start with midpoint
    v_min, v_max = va_range['valence']
    a_min, a_max = va_range['arousal']
    
    base_v = (v_min + v_max) / 2
    base_a = (a_min + a_max) / 2
    
    # Apply intensity modulation (move within range)
    v_range_width = v_max - v_min
    a_range_width = a_max - a_min
    
    base_v += intensity * (v_range_width / 2)
    base_a += intensity * (a_range_width / 2)
    
    # Clip to range
    base_v = max(v_min, min(v_max, base_v))
    base_a = max(a_min, min(a_max, base_a))
    
    # Secondary adjustments
    if secondary:
        secondary_lower = secondary.lower()
        
        # Arousal boost
        if any(word in secondary_lower for word in SECONDARY_AROUSAL_BOOST):
            base_a = min(a_max, base_a + 0.05)
        
        # Arousal reduce
        if any(word in secondary_lower for word in SECONDARY_AROUSAL_REDUCE):
            base_a = max(a_min, base_a - 0.05)
    
    return base_v, base_a


def apply_driver_adjustments(
    valence: float,
    arousal: float,
    driver_scores: Dict[str, float]
) -> Tuple[float, float]:
    """
    Apply driver-based adjustments.
    
    Args:
        valence: Base valence
        arousal: Base arousal
        driver_scores: {driver_name: score} with scores in [0, 1]
        
    Returns:
        (adjusted_valence, adjusted_arousal)
    """
    for driver, adjustment in DRIVER_ADJUSTMENTS.items():
        score = driver_scores.get(driver, 0.0)
        
        if score > 0.3:  # Only apply if driver is significant
            valence += adjustment.get('valence', 0.0) * score
            arousal += adjustment.get('arousal', 0.0) * score
    
    return valence, arousal


def blend_with_event_valence(
    emotion_valence: float,
    event_valence: float,
    confidence: float
) -> float:
    """
    Blend emotion valence with event valence when confidence is low.
    
    Args:
        emotion_valence: Emotion valence [0, 1]
        event_valence: Event valence [0, 1]
        confidence: Overall confidence [0, 1]
        
    Returns:
        Blended valence
    """
    if confidence >= 0.7:
        # High confidence: keep emotion valence
        return emotion_valence
    
    # Low confidence: blend 15% event valence
    return 0.85 * emotion_valence + 0.15 * event_valence


def apply_ema_smoothing(
    current_v: float,
    current_a: float,
    history_v: Optional[float],
    history_a: Optional[float],
    confidence: float
) -> Tuple[float, float]:
    """
    Apply EMA smoothing based on confidence.
    
    Args:
        current_v/a: Current valence/arousal
        history_v/a: Historical valence/arousal (if available)
        confidence: Overall confidence
        
    Returns:
        (smoothed_valence, smoothed_arousal)
    """
    if history_v is None or history_a is None:
        # No history: return current
        return current_v, current_a
    
    # Adaptive alpha based on confidence
    # High confidence: alpha = 0.8 (trust current)
    # Low confidence: alpha = 0.5 (blend with history)
    alpha = 0.5 + (confidence * 0.3)
    
    smoothed_v = alpha * current_v + (1 - alpha) * history_v
    smoothed_a = alpha * current_a + (1 - alpha) * history_a
    
    return smoothed_v, smoothed_a


def apply_arousal_governors(
    arousal: float,
    text: str,
    effort_detected: bool = False
) -> float:
    """
    Apply arousal governors (v2.0+ enhancement).
    
    Rules:
    - 2+ hedges → reduce arousal by 0.10 (floor at 0.20)
    - Effort-only text → cap arousal at 0.65
    
    Args:
        arousal: Base arousal value
        text: Input text
        effort_detected: Whether effort words dominate (optional)
        
    Returns:
        Governed arousal value
    """
    text_lower = text.lower()
    
    # Count hedges
    hedges = get_hedges()
    hedge_count = sum(1 for hedge in hedges if hedge in text_lower)
    
    # Apply hedge reduction
    if hedge_count >= 2:
        arousal -= 0.10
        arousal = max(0.20, arousal)  # Floor at 0.20
    
    # Cap arousal for effort-only text
    effort_words = get_effort_words()
    effort_count = sum(1 for word in effort_words if word in text_lower)
    
    # If effort words dominate (3+ effort words or explicitly flagged)
    if effort_count >= 3 or effort_detected:
        arousal = min(0.65, arousal)
    
    return arousal


def compute_valence_arousal(
    text: str,
    primary: str,
    secondary: Optional[str],
    driver_scores: Dict[str, float],
    event_valence: float,
    confidence: float,
    history: Optional[Dict] = None
) -> Tuple[float, float]:
    """
    Main function to compute valence and arousal.
    
    v2.0+: Applies arousal governors before final clipping.
    
    Args:
        text: Input text
        primary: Primary emotion
        secondary: Secondary emotion
        driver_scores: Driver signal scores
        event_valence: Event valence [0, 1]
        confidence: Overall confidence
        history: Optional previous VA values
        
    Returns:
        (valence, arousal) both in [0, 1]
    """
    # 1. Parse intensity
    intensity = parse_intensity(text)
    
    # 2. Compute base VA with intensity modulation
    base_v, base_a = compute_base_va(primary, secondary, intensity)
    
    # 3. Apply driver adjustments
    base_v, base_a = apply_driver_adjustments(base_v, base_a, driver_scores)
    
    # 4. Apply circadian priors
    circadian_phase = get_circadian_phase()
    base_v, base_a = apply_circadian_priors(base_v, base_a, circadian_phase)
    
    # 5. Blend with event valence if low confidence
    base_v = blend_with_event_valence(base_v, event_valence, confidence)
    
    # 5.5. Apply arousal governors (v2.0+ NEW)
    base_a = apply_arousal_governors(base_a, text)
    
    # 6. Apply EMA smoothing if history exists
    history_v = history.get('valence') if history else None
    history_a = history.get('arousal') if history else None
    
    final_v, final_a = apply_ema_smoothing(base_v, base_a, history_v, history_a, confidence)
    
    # 7. Final clipping
    final_v = max(0.0, min(1.0, final_v))
    final_a = max(0.0, min(1.0, final_a))
    
    return final_v, final_a
