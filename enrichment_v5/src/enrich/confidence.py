"""
Confidence scoring based on signal agreement across all components.
"""
from typing import Dict, List, Tuple
import math


def compute_hf_confidence(p_hf: Dict[str, float], winner: str) -> float:
    """
    Confidence from HF model probability distribution.
    
    High confidence: winner has high probability, others are low.
    Low confidence: probabilities are similar (uncertain).
    """
    winner_prob = p_hf.get(winner, 0.0)
    
    # Entropy-based confidence
    entropy = 0.0
    for prob in p_hf.values():
        if prob > 0:
            entropy -= prob * math.log2(prob)
    
    # Max entropy for 6 emotions = log2(6) ≈ 2.58
    max_entropy = math.log2(6)
    normalized_entropy = entropy / max_entropy
    
    # Low entropy = high confidence
    entropy_confidence = 1.0 - normalized_entropy
    
    # Also consider absolute winner probability
    prob_confidence = winner_prob
    
    # Combine (60% entropy, 40% probability)
    return 0.6 * entropy_confidence + 0.4 * prob_confidence


def compute_rerank_agreement(p_hf: Dict[str, float], rerank_scores: Dict[str, float],
                             winner: str) -> float:
    """
    Check if HF model and rerank agree on winner.
    
    Returns:
        Agreement score [0, 1]
    """
    hf_winner = max(p_hf, key=p_hf.get)
    
    if hf_winner == winner:
        # Perfect agreement
        return 1.0
    else:
        # Partial agreement: check if they're close
        hf_rank = sorted(p_hf.items(), key=lambda x: x[1], reverse=True)
        hf_ranks_dict = {emotion: rank for rank, (emotion, _) in enumerate(hf_rank)}
        
        winner_rank = hf_ranks_dict.get(winner, 5)
        
        # Top 2: 0.7, Top 3: 0.5, else: 0.3
        if winner_rank == 1:
            return 0.7
        elif winner_rank == 2:
            return 0.5
        else:
            return 0.3


def compute_negation_consistency(negation_flag: bool, winner: str, 
                                negated_emotions: List[str]) -> float:
    """
    Check if negation handling is consistent.
    
    Returns:
        Consistency score [0, 1]
    """
    if not negation_flag:
        # No negation: perfect consistency
        return 1.0
    
    # Negation detected: winner should NOT be in negated_emotions
    if winner in negated_emotions:
        # Inconsistent: negated emotion won (low confidence)
        return 0.4
    else:
        # Consistent: non-negated emotion won
        return 0.9


def compute_sarcasm_consistency(sarcasm_flag: bool, winner: str) -> float:
    """
    Check if sarcasm detection is consistent with winner.
    
    Returns:
        Consistency score [0, 1]
    """
    if not sarcasm_flag:
        # No sarcasm: perfect consistency
        return 1.0
    
    # Sarcasm detected: negative emotions should win
    if winner in ['Sad', 'Angry', 'Fearful']:
        # Consistent
        return 0.85
    else:
        # Inconsistent: positive emotion won despite sarcasm
        return 0.5


def compute_control_confidence(control_confidence: float) -> float:
    """
    Use control detection confidence directly.
    """
    return control_confidence


def compute_polarity_confidence(polarity_confidence: float) -> float:
    """
    Use polarity detection confidence directly.
    """
    return polarity_confidence


def compute_domain_confidence(domain_confidence: float) -> float:
    """
    Use domain detection confidence directly.
    """
    return domain_confidence


def compute_secondary_confidence(similarity_score: float) -> float:
    """
    Confidence from secondary emotion similarity.
    
    High similarity = high confidence.
    """
    # Similarity already in [0, 1]
    # Threshold: >0.7 = high confidence
    if similarity_score > 0.7:
        return 0.9
    elif similarity_score > 0.5:
        return 0.7
    elif similarity_score > 0.3:
        return 0.5
    else:
        return 0.4


def compute_overall_confidence(
    p_hf: Dict[str, float],
    rerank_scores: Dict[str, float],
    winner: str,
    negation_cues: Dict,
    sarcasm_cues: Dict,
    control_confidence: float,
    polarity_confidence: float,
    domain_confidence: float,
    secondary_similarity: float
) -> Tuple[float, Dict[str, float]]:
    """
    Compute overall confidence from all signals.
    
    Returns:
        (overall_confidence, component_breakdown)
    """
    # Component confidences
    components = {}
    
    components['hf_confidence'] = compute_hf_confidence(p_hf, winner)
    components['rerank_agreement'] = compute_rerank_agreement(p_hf, rerank_scores, winner)
    components['negation_consistency'] = compute_negation_consistency(
        negation_cues.get('negation_flag', False),
        winner,
        negation_cues.get('negated_emotions', [])
    )
    components['sarcasm_consistency'] = compute_sarcasm_consistency(
        sarcasm_cues.get('sarcasm_flag', False),
        winner
    )
    components['control_confidence'] = control_confidence
    components['polarity_confidence'] = polarity_confidence
    components['domain_confidence'] = domain_confidence
    components['secondary_confidence'] = compute_secondary_confidence(secondary_similarity)
    
    # Weighted average
    weights = {
        'hf_confidence': 0.20,
        'rerank_agreement': 0.20,
        'negation_consistency': 0.12,
        'sarcasm_consistency': 0.08,
        'control_confidence': 0.15,
        'polarity_confidence': 0.08,
        'domain_confidence': 0.10,
        'secondary_confidence': 0.07
    }
    
    overall = sum(components[k] * weights[k] for k in components.keys())
    
    return overall, components


def get_confidence_category(confidence: float) -> str:
    """
    Categorize confidence level.
    
    Returns:
        'high', 'medium', 'low', or 'uncertain'
    """
    if confidence >= 0.75:
        return 'high'
    elif confidence >= 0.60:
        return 'medium'
    elif confidence >= 0.45:
        return 'low'
    else:
        return 'uncertain'
