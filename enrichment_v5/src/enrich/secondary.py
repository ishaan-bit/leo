"""
Secondary emotion selection with hierarchy validation and context awareness.

v2.2 Enhancement: Score normalization before context boosting.
"""
from typing import Dict, Optional
import math
from .wheel import WHEEL_HIERARCHY, get_valid_secondaries


def normalize_scores(scores: Dict[str, float], method: str = 'min-max') -> Dict[str, float]:
    """
    Normalize scores to [0, 1] range.
    
    Methods:
    - 'min-max': Linear scaling to [0, 1]
    - 'z-score': Standardize then sigmoid transform
    - 'softmax': Exponential normalization (emphasizes differences)
    
    Args:
        scores: Dict of {secondary: raw_score}
        method: Normalization method
        
    Returns:
        Normalized scores in [0, 1]
    """
    if not scores:
        return scores
    
    values = list(scores.values())
    
    if method == 'min-max':
        # Linear scaling to [0, 1]
        min_val = min(values)
        max_val = max(values)
        
        if max_val - min_val < 1e-6:  # All scores equal
            return {k: 0.5 for k in scores.keys()}
        
        return {
            k: (v - min_val) / (max_val - min_val)
            for k, v in scores.items()
        }
    
    elif method == 'z-score':
        # Z-score normalization followed by sigmoid
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std = math.sqrt(variance + 1e-6)  # Add small epsilon to avoid division by zero
        
        if std < 1e-6:  # All scores equal
            return {k: 0.5 for k in scores.keys()}
        
        # Standardize then apply sigmoid to map to [0, 1]
        def sigmoid(x):
            return 1 / (1 + math.exp(-x))
        
        return {
            k: sigmoid((v - mean) / std)
            for k, v in scores.items()
        }
    
    elif method == 'softmax':
        # Softmax normalization (exponential)
        # Emphasizes score differences more than min-max
        max_score = max(values)  # For numerical stability
        exp_scores = {k: math.exp(v - max_score) for k, v in scores.items()}
        sum_exp = sum(exp_scores.values())
        
        return {
            k: exp_val / sum_exp
            for k, exp_val in exp_scores.items()
        }
    
    else:
        raise ValueError(f"Unknown normalization method: {method}")


def select_secondary(
    primary: str,
    secondary_similarity: Dict[str, float],
    event_valence: float,
    control_level: str,
    polarity: str,  # Changed from float to str (categorical: 'planned', 'happened', 'did_not_happen')
    normalize: bool = True,  # NEW v2.2: enable score normalization
    norm_method: str = 'min-max'  # NEW v2.2: normalization method
) -> tuple[str, float]:
    """
    Select best secondary emotion with hierarchy validation and context rules.
    
    v2.2 Enhancement: Optional score normalization before context boosting.
    
    Args:
        primary: Selected primary emotion
        secondary_similarity: HF similarity scores for all secondaries
        event_valence: Event outcome score [0, 1]
        control_level: "low", "medium", "high"
        polarity: Sentiment polarity [-1, 1]
        normalize: Whether to normalize scores before context boosting (default True)
        norm_method: Normalization method ('min-max', 'z-score', 'softmax')
        
    Returns:
        (best_secondary, similarity_score)
    """
    # 1. Get valid secondaries for this primary
    valid_secondaries = get_valid_secondaries(primary, WHEEL_HIERARCHY)
    
    if not valid_secondaries:
        raise ValueError(f"Unknown primary: {primary}")
    
    # 2. Filter similarity scores to only valid secondaries
    valid_sim = {
        sec: score 
        for sec, score in secondary_similarity.items() 
        if sec in valid_secondaries
    }
    
    if not valid_sim:
        # Fallback: return first valid secondary with 0 score
        return valid_secondaries[0], 0.0
    
    # 3. Normalize scores (NEW v2.2)
    if normalize:
        valid_sim = normalize_scores(valid_sim, method=norm_method)
    
    # 4. Apply context-aware boosting
    boosted_sim = apply_context_boost(
        valid_sim, 
        primary, 
        event_valence, 
        control_level, 
        polarity
    )
    
    # 5. Select highest score
    best_secondary = max(boosted_sim, key=boosted_sim.get)
    score = boosted_sim[best_secondary]
    
    return best_secondary, score


def apply_context_boost(
    similarity_scores: Dict[str, float],
    primary: str,
    event_valence: float,
    control_level: str,
    polarity: str  # Changed from float to str
) -> Dict[str, float]:
    """
    Apply context-aware boosts to secondary similarity scores.
    
    Context rules:
    - Low event valence + high control + Strong → boost Resilient, Determined, Courageous
    - Low event valence + Happy → boost Hopeful, Optimistic (not Joyful, Playful)
    - High event valence + Strong → boost Confident, Proud
    - High event valence + Happy → boost Excited, Playful
    - Negative polarity + Sad → boost Hurt, Depressed, Grief
    - Low control + Fearful → boost Helpless, Weak, Overwhelmed
    
    Args:
        similarity_scores: Original similarity scores for valid secondaries
        primary: Primary emotion
        event_valence: Event outcome [0, 1]
        control_level: "low", "medium", "high"
        polarity: Categorical polarity ('planned', 'happened', 'did_not_happen')
        
    Returns:
        Boosted similarity scores (original dict is not modified)
    """
    boosted = similarity_scores.copy()
    
    # Define boost factor
    BOOST_FACTOR = 1.25  # 25% increase
    
    # Convert categorical polarity to boolean for negative check
    is_negative_polarity = (polarity == 'did_not_happen')
    
    # Rule 1: Low event valence + high control + Strong → struggle/resilience
    if primary == "Strong" and event_valence <= 0.3 and control_level in ["high", "medium"]:
        struggle_secondaries = ["Resilient", "Courageous", "Hopeful"]
        for sec in struggle_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
    
    # Rule 2: Low event valence + Happy → tempered optimism (not pure joy)
    if primary == "Happy" and event_valence <= 0.3:
        tempered_secondaries = ["Hopeful", "Optimistic", "Interested"]
        avoid_secondaries = ["Joyful", "Playful", "Excited"]  # Too high-energy for struggle
        
        for sec in tempered_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
        
        for sec in avoid_secondaries:
            if sec in boosted:
                boosted[sec] *= 0.8  # Penalize
    
    # Rule 3: High event valence + Strong → confidence/pride
    if primary == "Strong" and event_valence >= 0.7:
        success_secondaries = ["Confident", "Proud", "Respected"]
        for sec in success_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
    
    # Rule 4: High event valence + Happy → high-energy joy
    if primary == "Happy" and event_valence >= 0.7:
        joy_secondaries = ["Excited", "Playful", "Energetic"]
        for sec in joy_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
    
    # Rule 5: Negative polarity + Sad → hurt/grief
    if primary == "Sad" and is_negative_polarity:
        pain_secondaries = ["Hurt", "Depressed", "Grief"]
        for sec in pain_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
    
    # Rule 6: Low control + Fearful → helplessness
    if primary == "Fearful" and control_level == "low":
        helpless_secondaries = ["Helpless", "Weak", "Overwhelmed"]
        for sec in helpless_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
    
    # Rule 7: High control + Angry → assertive anger
    if primary == "Angry" and control_level == "high":
        assertive_secondaries = ["Critical", "Frustrated", "Aggressive"]
        for sec in assertive_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
    
    # Rule 8: Low control + Angry → reactive anger
    if primary == "Angry" and control_level == "low":
        reactive_secondaries = ["Mad", "Humiliated"]
        for sec in reactive_secondaries:
            if sec in boosted:
                boosted[sec] *= BOOST_FACTOR
    
    return boosted


__all__ = ['select_secondary', 'apply_context_boost']
