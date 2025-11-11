"""
Context-based rerank module with 6-term formula and user priors.
Score = α·HF + β·Similarity + γ·Domain + δ·Control + ε·Polarity + ζ·EventValence
"""
from typing import Dict, Optional, Tuple

# Default weights - HF should dominate, context should refine
DEFAULT_WEIGHTS = {
    'alpha': 0.50,    # HF model probability (MAIN signal)
    'beta': 0.15,     # Secondary similarity
    'gamma': 0.10,    # Domain prior (reduced - was too strong)
    'delta': 0.10,    # Control alignment
    'epsilon': 0.05,  # Polarity alignment
    'zeta': 0.10      # Event valence
}

# Domain prior table (8 domains × 6 emotions) - REDUCED MAGNITUDE
DOMAIN_PRIOR = {
    'work': {
        'Happy': -0.1, 'Strong': +0.2, 'Peaceful': -0.2,
        'Sad': +0.1, 'Angry': +0.4, 'Fearful': +0.2  # Boosted Angry from +0.3 to +0.4
    },
    'relationship': {
        'Happy': +0.2, 'Strong': -0.2, 'Peaceful': +0.1,
        'Sad': +0.3, 'Angry': +0.2, 'Fearful': +0.2
    },
    'family': {
        'Happy': +0.2, 'Strong': -0.2, 'Peaceful': +0.1,
        'Sad': +0.3, 'Angry': -0.2, 'Fearful': +0.2
    },
    'health': {
        'Happy': -0.1, 'Strong': -0.2, 'Peaceful': +0.1,
        'Sad': +0.2, 'Angry': +0.1, 'Fearful': +0.3
    },
    'money': {
        'Happy': -0.1, 'Strong': +0.1, 'Peaceful': -0.2,
        'Sad': +0.2, 'Angry': +0.2, 'Fearful': +0.3
    },
    'study': {
        'Happy': +0.1, 'Strong': +0.1, 'Peaceful': -0.2,
        'Sad': +0.2, 'Angry': +0.1, 'Fearful': +0.3
    },
    'social': {
        'Happy': +0.2, 'Strong': -0.2, 'Peaceful': +0.1,
        'Sad': +0.3, 'Angry': +0.1, 'Fearful': +0.2
    },
    'self': {
        'Happy': +0.1, 'Strong': +0.1, 'Peaceful': +0.2,
        'Sad': +0.2, 'Angry': +0.0, 'Fearful': +0.1  # FIXED: was -0.5 for Angry!
    }
}

# Control alignment (3 levels × 6 emotions)
CONTROL_ALIGN = {
    'low': {
        'Happy': -0.3, 'Strong': -0.5, 'Peaceful': -0.3,
        'Sad': +0.5, 'Angry': -0.5, 'Fearful': +1.0
    },
    'medium': {
        'Happy': +0.3, 'Strong': +0.5, 'Peaceful': +0.5,
        'Sad': +0.3, 'Angry': +0.3, 'Fearful': +0.3
    },
    'high': {
        'Happy': +0.5, 'Strong': +1.0, 'Peaceful': +0.5,
        'Sad': -0.5, 'Angry': +1.0, 'Fearful': -0.5
    }
}

# Polarity alignment (3 states × 6 emotions)
POLARITY_ALIGN = {
    'planned': {
        'Happy': +0.3, 'Strong': +0.5, 'Peaceful': +0.3,
        'Sad': +0.3, 'Angry': +0.3, 'Fearful': +1.0
    },
    'happened': {
        'Happy': +0.5, 'Strong': +0.5, 'Peaceful': +0.5,
        'Sad': +0.5, 'Angry': +0.5, 'Fearful': +0.5
    },
    'did_not_happen': {
        'Happy': -0.3, 'Strong': -0.3, 'Peaceful': +0.5,
        'Sad': +0.5, 'Angry': +0.5, 'Fearful': +0.3
    }
}

# Event valence alignment (positive events → positive emotions)
EVENT_VALENCE_ALIGN = {
    'Happy': +1.0, 'Strong': +0.8, 'Peaceful': +0.6,
    'Sad': -0.8, 'Angry': -0.6, 'Fearful': -0.5
}


def normalize_to_range(value: float, min_val: float = -1.0, max_val: float = 1.0) -> float:
    """
    Normalize value from [min_val, max_val] to [0, 1].
    """
    if max_val == min_val:
        return 0.5
    
    normalized = (value - min_val) / (max_val - min_val)
    return max(0.0, min(1.0, normalized))


def get_domain_prior(domain_primary: str, domain_secondary: Optional[str], 
                     domain_mixture: float, emotion: str) -> float:
    """
    Get domain prior with mixture support.
    
    Args:
        domain_primary: Primary domain
        domain_secondary: Secondary domain (if multi-domain)
        domain_mixture: Mixture ratio (0.5-1.0)
        emotion: Emotion to score
        
    Returns:
        Combined domain prior in [-1, 1]
    """
    primary_prior = DOMAIN_PRIOR.get(domain_primary, {}).get(emotion, 0.0)
    
    if domain_secondary is None:
        return primary_prior
    
    # Multi-domain: blend priors
    secondary_prior = DOMAIN_PRIOR.get(domain_secondary, {}).get(emotion, 0.0)
    combined = domain_mixture * primary_prior + (1 - domain_mixture) * secondary_prior
    
    return combined


def get_user_prior(user_priors: Optional[Dict], domain: str, control: str, 
                   emotion: str) -> float:
    """
    Get user-specific prior bonus.
    
    Args:
        user_priors: {(domain, control): {emotion: count}}
        domain: Current domain
        control: Current control
        emotion: Emotion to score
        
    Returns:
        Prior bonus in [-0.05, +0.05]
    """
    if user_priors is None:
        return 0.0
    
    key = (domain, control)
    if key not in user_priors:
        return 0.0
    
    emotion_counts = user_priors[key]
    total_count = sum(emotion_counts.values())
    
    # Need at least 10 samples for reliable prior
    if total_count < 10:
        return 0.0
    
    # Compute prior: deviation from uniform
    uniform_prob = 1.0 / 6  # 6 emotions
    emotion_prob = emotion_counts.get(emotion, 0) / total_count
    
    deviation = emotion_prob - uniform_prob
    # Scale to [-0.05, +0.05]
    prior_bonus = deviation * 0.3
    
    return max(-0.05, min(0.05, prior_bonus))


def compute_rerank_score(
    emotion: str,
    p_hf: float,
    similarity: float,
    domain_primary: str,
    domain_secondary: Optional[str],
    domain_mixture: float,
    control: str,
    polarity: str,
    event_valence: float,
    user_priors: Optional[Dict] = None,
    weights: Optional[Dict] = None
) -> float:
    """
    Compute rerank score for a single emotion.
    
    Args:
        emotion: Emotion to score
        p_hf: HF model probability [0, 1]
        similarity: Embedding similarity [0, 1]
        domain_primary: Primary domain
        domain_secondary: Secondary domain
        domain_mixture: Mixture ratio
        control: Control level
        polarity: Event polarity
        event_valence: Event valence [0, 1]
        user_priors: User-specific priors
        weights: Custom weights (uses DEFAULT_WEIGHTS if None)
        
    Returns:
        Rerank score [0, 1] (approximately)
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS
    
    # 1. HF probability (already in [0, 1])
    hf_term = weights['alpha'] * p_hf
    
    # 2. Similarity (already in [0, 1])
    sim_term = weights['beta'] * similarity
    
    # 3. Domain prior (normalize from [-1, 1] to [0, 1])
    domain_prior = get_domain_prior(domain_primary, domain_secondary, domain_mixture, emotion)
    domain_norm = normalize_to_range(domain_prior, -1.0, 1.0)
    domain_term = weights['gamma'] * domain_norm
    
    # 4. Control alignment (normalize from [-1, 1] to [0, 1])
    control_prior = CONTROL_ALIGN.get(control, {}).get(emotion, 0.0)
    control_norm = normalize_to_range(control_prior, -1.0, 1.0)
    control_term = weights['delta'] * control_norm
    
    # 5. Polarity alignment (normalize from [-1, 1] to [0, 1])
    polarity_prior = POLARITY_ALIGN.get(polarity, {}).get(emotion, 0.0)
    polarity_norm = normalize_to_range(polarity_prior, -1.0, 1.0)
    polarity_term = weights['epsilon'] * polarity_norm
    
    # 6. Event valence alignment
    # High event valence → boost positive emotions
    # Low event valence → boost negative emotions
    ev_align = EVENT_VALENCE_ALIGN.get(emotion, 0.0)
    # Convert to alignment score
    if ev_align > 0:
        # Positive emotion: higher event valence = higher score
        ev_score = event_valence
    else:
        # Negative emotion: lower event valence = higher score
        ev_score = 1.0 - event_valence
    
    ev_term = weights['zeta'] * ev_score
    
    # 7. User prior bonus (small adjustment)
    user_bonus = get_user_prior(user_priors, domain_primary, control, emotion)
    
    # Combine all terms
    total_score = hf_term + sim_term + domain_term + control_term + polarity_term + ev_term + user_bonus
    
    return total_score


def rerank_emotions(
    p_hf: Dict[str, float],
    similarity_scores: Dict[str, float],
    domain_primary: str,
    domain_secondary: Optional[str],
    domain_mixture: float,
    control: str,
    polarity: str,
    event_valence: float,
    user_priors: Optional[Dict] = None
) -> Tuple[str, Dict[str, float]]:
    """
    Rerank all emotions and return winner.
    
    Returns:
        (best_emotion, score_breakdown)
        score_breakdown: {emotion: final_score}
    """
    scores = {}
    
    for emotion in p_hf.keys():
        score = compute_rerank_score(
            emotion=emotion,
            p_hf=p_hf[emotion],
            similarity=similarity_scores.get(emotion, 0.0),
            domain_primary=domain_primary,
            domain_secondary=domain_secondary,
            domain_mixture=domain_mixture,
            control=control,
            polarity=polarity,
            event_valence=event_valence,
            user_priors=user_priors
        )
        scores[emotion] = score
    
    # Get best emotion
    best_emotion = max(scores, key=scores.get)
    
    return best_emotion, scores
