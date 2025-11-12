"""
Control and Polarity Inference

Control: User's perceived agency (low/medium/high)
Polarity: Whether event happened, didn't happen, is hypothetical, or none
"""

import re
from typing import Tuple
from dataclasses import dataclass

from .features import FeatureSet


@dataclass
class ControlInference:
    """Control classification result"""
    level: str  # 'low', 'medium', 'high'
    confidence: float
    explanation: str


@dataclass
class PolarityInference:
    """Polarity classification result"""
    polarity: str  # 'happened', 'did_not_happen', 'hypothetical', 'none'
    confidence: float
    explanation: str


def infer_control(features: FeatureSet, text: str) -> ControlInference:
    """
    Infer control level from agency markers.
    
    Rules:
    - agency_high markers ("I can", "I'll fix") → high
    - agency_low markers ("nothing I do", "can't change") → low
    - Hedges move control toward medium
    - Default: medium
    
    Args:
        features: Extracted features
        text: Original text
        
    Returns:
        ControlInference with level and confidence
    """
    score = 0.5  # Start at medium (0.5)
    explanation_parts = []
    
    # High control signals
    if features.agency_high:
        score += 0.30
        explanation_parts.append("agency_high+0.30")
    
    # Low control signals
    if features.agency_low:
        score -= 0.35
        explanation_parts.append("agency_low-0.35")
    
    # Hedges pull toward medium
    if features.hedge:
        # If currently high or low, pull toward medium
        if score > 0.6:
            score -= 0.15
            explanation_parts.append("hedge→medium(-0.15)")
        elif score < 0.4:
            score += 0.15
            explanation_parts.append("hedge→medium(+0.15)")
    
    # Clamp
    score = max(0.0, min(1.0, score))
    
    # Convert to categorical
    if score >= 0.65:
        level = 'high'
        confidence = min(0.85, score)
    elif score <= 0.35:
        level = 'low'
        confidence = min(0.85, 1.0 - score)
    else:
        level = 'medium'
        confidence = 0.6  # Medium is less certain
    
    explanation = " | ".join(explanation_parts) if explanation_parts else "default→medium"
    
    return ControlInference(
        level=level,
        confidence=confidence,
        explanation=explanation
    )


def infer_polarity(features: FeatureSet, text: str) -> PolarityInference:
    """
    Infer event polarity (happened vs didn't happen vs hypothetical).
    
    Rules:
    - Past action verbs → happened
    - Present reflection ("feels like", "it's", "today") → happened
    - "tried to but didn't" / "meant to never" → did_not_happen
    - "would / if / might" (without past action) → hypothetical
    - No temporal markers → none
    
    Args:
        features: Extracted features
        text: Original text
        
    Returns:
        PolarityInference with polarity type
    """
    # Check for failed attempt first (highest priority)
    if features.failed_attempt:
        # "tried to but..." → the attempt happened, but outcome didn't
        # We classify this as "happened" since the action occurred
        return PolarityInference(
            polarity='happened',
            confidence=0.75,
            explanation="failed_attempt (action occurred)"
        )
    
    # Check for past action
    if features.past_action:
        return PolarityInference(
            polarity='happened',
            confidence=0.65,
            explanation="past_action_verbs"
        )
    
    # Check for present reflection (ongoing experience)
    present_reflection_pattern = re.compile(
        r'\b(feels? like|it\'?s (like)?|seems? like|right now|today|this (moment|feeling)|'
        r'currently|at the moment|these days|lately|just a (normal|regular)|typical day)\b',
        re.IGNORECASE
    )
    if present_reflection_pattern.search(text):
        return PolarityInference(
            polarity='happened',
            confidence=0.60,
            explanation="present_reflection (ongoing experience)"
        )
    
    # Check for hypothetical (but only if no past/present action AND no strong hedge)
    # Hedges with "or if" construct indicate uncertainty about reality, not hypothetical future
    if features.hypothetical:
        # If hedges are present, the uncertainty is about what DID happen, not hypothetical
        if features.hedge and re.search(r'\bor if\b', text, re.IGNORECASE):
            return PolarityInference(
                polarity='none',
                confidence=0.65,
                explanation="hedge_uncertainty (ambiguous reality, not hypothetical)"
            )
        return PolarityInference(
            polarity='hypothetical',
            confidence=0.70,
            explanation="hypothetical_markers (would/if/might)"
        )
    
    # Check for explicit negation of past events
    # "never happened", "didn't happen", "didn't go"
    did_not_happen_pattern = re.compile(
        r'\b(never (happened|occurred|went)|didn\'?t (happen|occur|go|work out))\b',
        re.IGNORECASE
    )
    if did_not_happen_pattern.search(text):
        return PolarityInference(
            polarity='did_not_happen',
            confidence=0.80,
            explanation="explicit_negation (didn't happen)"
        )
    
    # Default: none (no clear temporal marker)
    return PolarityInference(
        polarity='none',
        confidence=0.50,
        explanation="no_temporal_markers"
    )


# Utility: Get control level as numeric score
def control_to_numeric(control_level: str) -> float:
    """Convert categorical control to numeric [0, 1]"""
    mapping = {
        'low': 0.2,
        'medium': 0.5,
        'high': 0.8
    }
    return mapping.get(control_level, 0.5)
