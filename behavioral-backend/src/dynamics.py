"""
Temporal dynamics and recursive state updates.
Implements the core update rule:
    s_t = (1-α)·s_{t-1} + α·baseline_t + β·shock_t + γ·(intensity - ERI)·direction(invoked)
"""

import os
from typing import Dict, List, Tuple
import numpy as np


def clamp01(x: float) -> float:
    """Clamp x to [0.0, 1.0]."""
    return float(np.clip(x, 0.0, 1.0))


def clamp11(x: float) -> float:
    """Clamp x to [-1.0, 1.0]."""
    return float(np.clip(x, -1.0, 1.0))


def round3(x: float) -> float:
    """Round to 3 decimal places."""
    return float(np.round(x, 3))


def compute_baseline(recent_reflections: List[Dict]) -> Tuple[float, float]:
    """
    Compute baseline (natural feelings cycle) from recent invoked states.
    Returns (valence, arousal) averages.
    """
    if not recent_reflections:
        return (0.0, 0.3)  # Default neutral baseline
    
    valences = [r.get("invoked_valence", 0.0) for r in recent_reflections]
    arousals = [r.get("invoked_arousal", 0.3) for r in recent_reflections]
    
    baseline_valence = np.mean(valences)
    baseline_arousal = np.mean(arousals)
    
    return (float(baseline_valence), float(baseline_arousal))


def compute_shock(invoked: Dict, baseline: Tuple[float, float]) -> Tuple[float, float]:
    """
    Compute shock = invoked - baseline.
    Returns (valence_shock, arousal_shock).
    """
    valence_shock = invoked["valence"] - baseline[0]
    arousal_shock = invoked["arousal"] - baseline[1]
    
    return (valence_shock, arousal_shock)


def compute_ERI(
    invoked: Dict, 
    expressed_intensity: float, 
    willingness_to_express: float,
    sentiment_confidence: float
) -> float:
    """
    Expressed-Reality Incongruence (ERI).
    Measures mismatch between invoked emotion and expressed intensity/tone.
    
    Formula:
    - a_exp = 0.35*a_inv + 0.35*sent_conf + 0.30*intensity
    - v_exp = v_inv * (0.7 + 0.3*willingness)
    - ERI = |v_inv - v_exp| + (0.25 + 0.5*intensity) * |a_inv - a_exp|
    
    This prevents quiet texts from being over-penalized while keeping
    high ERI for genuinely incongruent expressions.
    """
    v_inv = invoked["valence"]
    a_inv = invoked["arousal"]
    
    # Expressed arousal: blend of invoked, confidence, and intensity
    # (so calm texts have non-zero expressed arousal)
    a_exp = clamp01(
        0.35 * a_inv + 0.35 * sentiment_confidence + 0.30 * expressed_intensity
    )
    
    # Expressed valence: scaled by willingness to express
    v_exp = clamp11(
        v_inv * (0.7 + 0.3 * willingness_to_express)
    )
    
    # Compute deltas
    valence_delta = abs(v_inv - v_exp)
    arousal_delta = abs(a_inv - a_exp)
    
    # Scale arousal term by intensity
    arousal_weight = 0.25 + 0.5 * expressed_intensity
    
    ERI = valence_delta + arousal_weight * arousal_delta
    
    return round3(ERI)


def update_state(
    prev_state: Dict,
    baseline: Tuple[float, float],
    shock: Tuple[float, float],
    invoked: Dict,
    expressed_intensity: float,
    ERI: float,
    alpha: float = 0.1,
    beta: float = 0.5,
    gamma: float = 0.08,
) -> Dict:
    """
    Apply the recursive state update rule.
    
    s_t = (1-α)·s_{t-1} + α·baseline + β·shock + γ·(intensity - ERI)·direction(invoked)
    
    Returns updated state {valence, arousal}.
    """
    # Previous state
    prev_v = prev_state.get("v", 0.0)
    prev_a = prev_state.get("a", 0.3)
    
    # Direction of invoked (normalized)
    # Use vector normalization instead of sign to avoid over-boosting
    v_inv = invoked["valence"]
    a_inv_centered = invoked["arousal"] - 0.5  # Center arousal at 0.5
    
    # Normalize direction vector
    magnitude = np.sqrt(v_inv**2 + a_inv_centered**2)
    if magnitude > 0:
        dir_v = v_inv / magnitude
        dir_a = a_inv_centered / magnitude
    else:
        dir_v = 0.0
        dir_a = 0.0
    
    # Expression correction term
    expr_correction_v = gamma * (expressed_intensity - ERI) * dir_v
    expr_correction_a = gamma * (expressed_intensity - ERI) * dir_a * 0.5  # Scale arousal correction
    
    # Update rule
    new_v = (
        (1 - alpha) * prev_v +
        alpha * baseline[0] +
        beta * shock[0] +
        expr_correction_v
    )
    
    new_a = (
        (1 - alpha) * prev_a +
        alpha * baseline[1] +
        beta * shock[1] +
        expr_correction_a
    )
    
    # Clamp to valid ranges
    new_v = max(-1.0, min(1.0, new_v))
    new_a = max(0.0, min(1.0, new_a))
    
    return {
        "v": round(new_v, 3),
        "a": round(new_a, 3),
    }


def process_dynamics(
    user_id: str,
    invoked: Dict,
    expressed_tone: str,
    expressed_intensity: float,
    willingness_to_express: float,
    recent_reflections: List[Dict],
    prev_state: Dict,
) -> Dict:
    """
    Main dynamics processing pipeline.
    Returns dict with baseline, shock, ERI, and updated state.
    """
    # Load parameters from env
    alpha = float(os.getenv("ALPHA", "0.1"))
    beta = float(os.getenv("BETA", "0.5"))
    gamma = float(os.getenv("GAMMA", "0.08"))
    
    # Compute baseline from recent reflections
    baseline = compute_baseline(recent_reflections)
    
    # Compute shock
    shock = compute_shock(invoked, baseline)
    
    # Compute ERI (using sentiment confidence from invoked emotion)
    sentiment_confidence = invoked.get("confidence", 0.5)
    ERI = compute_ERI(invoked, expressed_intensity, willingness_to_express, sentiment_confidence)
    
    # Update state
    new_state = update_state(
        prev_state=prev_state,
        baseline=baseline,
        shock=shock,
        invoked=invoked,
        expressed_intensity=expressed_intensity,
        ERI=ERI,
        alpha=alpha,
        beta=beta,
        gamma=gamma,
    )
    
    return {
        "baseline": {"valence": round(baseline[0], 3), "arousal": round(baseline[1], 3)},
        "shock": {"valence": round(shock[0], 3), "arousal": round(shock[1], 3)},
        "ERI": ERI,
        "state": new_state,
    }
