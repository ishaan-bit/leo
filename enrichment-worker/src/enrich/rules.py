"""
Precedence Rules Engine

Implements feature-driven rules with ordering:
1. Sarcasm Override: Positive praise + negative metaphor → shift primary
2. Fatigue Dampener: Lower arousal for tired/exhausted cues
3. Uncertainty Normalizer: Hedge toward neutral for uncertain language
4. Contrast Weighting: Already handled in clauses.py

Each rule can override or modulate downstream scoring.
"""

import os
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field

from .features import FeatureSet, has_positive_tokens, has_negative_tokens
from .dual_valence import DualValence
from .clauses import Clause


# Debug flag (set via environment variable)
DEBUG = os.getenv('ENRICH_DEBUG', 'false').lower() == 'true'


@dataclass
class RuleApplication:
    """Records what rule was applied and its effect"""
    rule_name: str
    triggered: bool
    before_value: Optional[float] = None
    after_value: Optional[float] = None
    explanation: str = ""
    

@dataclass
class RuleContext:
    """Container for all rule applications during processing"""
    applications: List[RuleApplication] = field(default_factory=list)
    
    def add(self, rule: RuleApplication):
        self.applications.append(rule)
        if DEBUG:
            if rule.triggered:
                print(f"[RULE] {rule.rule_name}: {rule.explanation}")
                if rule.before_value is not None and rule.after_value is not None:
                    print(f"       {rule.before_value:.3f} → {rule.after_value:.3f}")
    
    def get_explanation(self) -> str:
        """Get human-readable summary of all triggered rules"""
        triggered = [r for r in self.applications if r.triggered]
        if not triggered:
            return "no_rules_triggered"
        return " → ".join([f"{r.rule_name}({r.explanation})" for r in triggered])


def apply_sarcasm_override(
    primary_candidates: Dict[str, float],
    event_valence: float,
    emotion_valence: float,
    features: FeatureSet,
    rule_ctx: RuleContext
) -> Tuple[Dict[str, float], float, float]:
    """
    Sarcasm Override Rule
    
    Pattern: sarcasm_cue + (praise OR positive tokens) + negative_metaphor
    Effect: 
    - Shift primary to Sad/Angry/Overwhelmed cluster
    - Keep event_valence high (≥0.7) - the context was objectively positive
    - Lower emotion_valence (≤0.35) - but felt bad
    
    Args:
        primary_candidates: Emotion scores to modify
        event_valence: Objective outcome score
        emotion_valence: Subjective feeling score
        features: Extracted features
        rule_ctx: Context for logging
        
    Returns:
        (modified_candidates, modified_event, modified_emotion)
    """
    triggered = (
        features.sarcasm_cue and
        (features.praise or has_positive_tokens(" ".join(features.matched_tokens.get('praise', [])))) and
        features.neg_metaphor
    )
    
    if not triggered:
        rule_ctx.add(RuleApplication(
            rule_name="sarcasm_override",
            triggered=False
        ))
        return primary_candidates, event_valence, emotion_valence
    
    # Apply override
    modified_candidates = primary_candidates.copy()
    
    # Boost Sad, Angry, Overwhelmed
    modified_candidates['Sad'] = modified_candidates.get('Sad', 0.3) * 1.5
    modified_candidates['Angry'] = modified_candidates.get('Angry', 0.2) * 1.4
    # Note: 'Overwhelmed' might not be in primaries, use 'Fearful' or 'Weak' as proxy
    modified_candidates['Fearful'] = modified_candidates.get('Fearful', 0.2) * 1.3
    
    # Reduce Happy if present
    if 'Happy' in modified_candidates:
        modified_candidates['Happy'] *= 0.5
    
    # Adjust valences
    original_event = event_valence
    original_emotion = emotion_valence
    
    # Event likely positive (praise context)
    event_valence = max(event_valence, 0.70)
    
    # Emotion negative (felt bad)
    emotion_valence = min(emotion_valence, 0.35)
    
    rule_ctx.add(RuleApplication(
        rule_name="sarcasm_override",
        triggered=True,
        before_value=original_emotion,
        after_value=emotion_valence,
        explanation=f"event↑{event_valence:.2f} emotion↓{emotion_valence:.2f} primary→Sad/Angry"
    ))
    
    return modified_candidates, event_valence, emotion_valence


def apply_fatigue_dampener(
    arousal: float,
    features: FeatureSet,
    rule_ctx: RuleContext
) -> float:
    """
    Fatigue Arousal Dampener Rule
    
    Pattern: fatigue cues (tired, exhausted, drained, etc.)
    Effect:
    - Reduce arousal by 0.15-0.25
    - Minimum arousal: 0.1
    - If fatigue + anxiety: cap arousal at 0.65
    
    Args:
        arousal: Current arousal score
        features: Extracted features
        rule_ctx: Context for logging
        
    Returns:
        Modified arousal
    """
    if not features.fatigue:
        rule_ctx.add(RuleApplication(
            rule_name="fatigue_dampener",
            triggered=False
        ))
        return arousal
    
    original_arousal = arousal
    
    # Base reduction: -0.20
    reduction = 0.20
    
    # Stronger reduction if multiple fatigue cues
    if features.fatigue_count >= 2:
        reduction = 0.25
    
    arousal -= reduction
    
    # Floor at 0.1
    arousal = max(0.1, arousal)
    
    # If fatigue + anxiety, cap at 0.65 (tired but wired)
    anxiety_present = any(term in " ".join(features.matched_tokens.get('neg_metaphor', [])).lower() 
                          for term in ['anxious', 'anxiety', 'worried', 'nervous'])
    if anxiety_present:
        arousal = min(0.65, arousal)
        explanation = f"fatigue-{reduction:.2f} (capped at 0.65 due to anxiety)"
    else:
        explanation = f"fatigue-{reduction:.2f} (floor 0.1)"
    
    rule_ctx.add(RuleApplication(
        rule_name="fatigue_dampener",
        triggered=True,
        before_value=original_arousal,
        after_value=arousal,
        explanation=explanation
    ))
    
    return arousal


def apply_physio_distress_boost(
    arousal: float,
    features: FeatureSet,
    rule_ctx: RuleContext
) -> float:
    """
    Physiological Distress Arousal Boost
    
    Pattern: physical distress metaphors (motion sickness, nausea, etc.) WITHOUT fatigue
    Effect: Raise arousal by +0.1 (physiological activation)
    
    Args:
        arousal: Current arousal score
        features: Extracted features
        rule_ctx: Context for logging
        
    Returns:
        Modified arousal
    """
    triggered = features.physio_distress and not features.fatigue
    
    if not triggered:
        rule_ctx.add(RuleApplication(
            rule_name="physio_distress_boost",
            triggered=False
        ))
        return arousal
    
    original_arousal = arousal
    arousal += 0.10
    arousal = min(0.9, arousal)  # Cap at 0.9
    
    rule_ctx.add(RuleApplication(
        rule_name="physio_distress_boost",
        triggered=True,
        before_value=original_arousal,
        after_value=arousal,
        explanation="physio_distress+0.10"
    ))
    
    return arousal


def apply_uncertainty_normalizer(
    emotion_valence: float,
    features: FeatureSet,
    rule_ctx: RuleContext
) -> float:
    """
    Uncertainty Normalizer Rule
    
    Pattern: hedging language (I guess, not sure, maybe, kind of, etc.)
    Effect:
    - Pull emotion_valence toward 0.5 (neutral) by 15-25%
    - Prevents false "high positive neutral" or "high negative neutral"
    
    Args:
        emotion_valence: Current subjective feeling score
        features: Extracted features
        rule_ctx: Context for logging
        
    Returns:
        Modified emotion_valence
    """
    if not features.hedge:
        rule_ctx.add(RuleApplication(
            rule_name="uncertainty_normalizer",
            triggered=False
        ))
        return emotion_valence
    
    original_valence = emotion_valence
    
    # Strength of pull based on hedge count
    pull_factor = 0.15  # Base: 15%
    if features.hedge_count >= 2:
        pull_factor = 0.20  # More hedges: 20%
    if features.hedge_count >= 3:
        pull_factor = 0.25  # Very hedged: 25%
    
    # Pull toward 0.5
    emotion_valence = emotion_valence + (0.5 - emotion_valence) * pull_factor
    
    # Also prevent extreme values
    if emotion_valence > 0.7:
        emotion_valence = min(emotion_valence, 0.70)
    elif emotion_valence < 0.3:
        emotion_valence = max(emotion_valence, 0.30)
    
    rule_ctx.add(RuleApplication(
        rule_name="uncertainty_normalizer",
        triggered=True,
        before_value=original_valence,
        after_value=emotion_valence,
        explanation=f"hedge_pull→0.5 ({pull_factor*100:.0f}%, {features.hedge_count} hedges)"
    ))
    
    return emotion_valence


def apply_angry_alignment(
    primary_candidates: Dict[str, float],
    event_valence: float,
    control_level: str,
    rule_ctx: RuleContext
) -> Dict[str, float]:
    """
    Angry Alignment Rule
    
    Pattern: Primary=Angry + event_valence<0.45 + control∈{medium, high}
    Rationale:
    - Anger typically paired with negative outcomes AND sense of agency
    - "I failed (negative event) but I can fix this (high control)" → Angry
    - Different from Sad (low control, helplessness)
    
    Effect:
    - Boost Angry score by 20% if conditions met
    - Helps distinguish Angry (active, empowered) from Sad (passive, defeated)
    
    Args:
        primary_candidates: Emotion scores to modify
        event_valence: Objective outcome score [0, 1]
        control_level: "low", "medium", or "high"
        rule_ctx: Context for logging
        
    Returns:
        Modified primary_candidates
    """
    # Check if Angry is already primary or strong candidate
    angry_score = primary_candidates.get('Angry', 0.0)
    max_score = max(primary_candidates.values()) if primary_candidates else 0.0
    
    # Trigger conditions:
    # 1. Angry is either top or within 20% of top
    # 2. Event valence < 0.45 (negative outcome)
    # 3. Control level is medium or high (has agency)
    is_angry_candidate = angry_score >= max_score * 0.8
    has_negative_event = event_valence < 0.45
    has_agency = control_level in ['medium', 'high']
    
    triggered = is_angry_candidate and has_negative_event and has_agency
    
    if not triggered:
        rule_ctx.add(RuleApplication(
            rule_name="angry_alignment",
            triggered=False
        ))
        return primary_candidates
    
    # Apply boost
    modified_candidates = primary_candidates.copy()
    original_angry = modified_candidates.get('Angry', 0.0)
    modified_candidates['Angry'] = original_angry * 1.20  # +20% boost
    
    rule_ctx.add(RuleApplication(
        rule_name="angry_alignment",
        triggered=True,
        before_value=original_angry,
        after_value=modified_candidates['Angry'],
        explanation=f"neg_event(ev={event_valence:.2f}) + agency({control_level}) → boost_angry+20%"
    ))
    
    return modified_candidates


def toward(value: float, target: float, factor: float) -> float:
    """
    Utility: pull value toward target by factor.
    
    Args:
        value: Current value
        target: Target value
        factor: Pull strength [0, 1]
        
    Returns:
        Interpolated value
    """
    return value + (target - value) * factor


def clamp(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    """Utility: clamp value to range"""
    return max(min_val, min(max_val, value))


def apply_all_rules(
    primary_candidates: Dict[str, float],
    dual_valence: DualValence,
    arousal: float,
    features: FeatureSet,
    control_level: str = 'medium'  # NEW: control level for Angry alignment
) -> Tuple[Dict[str, float], float, float, float, RuleContext]:
    """
    Apply all precedence rules in order.
    
    Order:
    1. Sarcasm override (affects primary, event, emotion)
    2. Fatigue dampener (affects arousal)
    3. Physio distress boost (affects arousal)
    4. Angry alignment (affects primary) - NEW v2.2
    5. Uncertainty normalizer (affects emotion_valence)
    
    Args:
        primary_candidates: Initial emotion scores
        dual_valence: Event and emotion valences
        arousal: Base arousal score
        features: Extracted features
        control_level: Control level ('low', 'medium', 'high') for Angry alignment
        
    Returns:
        (modified_primaries, modified_event, modified_emotion, modified_arousal, rule_context)
    """
    rule_ctx = RuleContext()
    
    event_val = dual_valence.event_valence
    emotion_val = dual_valence.emotion_valence
    
    # Rule 1: Sarcasm override
    primary_candidates, event_val, emotion_val = apply_sarcasm_override(
        primary_candidates, event_val, emotion_val, features, rule_ctx
    )
    
    # Rule 2: Fatigue dampener
    arousal = apply_fatigue_dampener(arousal, features, rule_ctx)
    
    # Rule 3: Physio distress boost
    arousal = apply_physio_distress_boost(arousal, features, rule_ctx)
    
    # Rule 4: Angry alignment (NEW v2.2)
    primary_candidates = apply_angry_alignment(
        primary_candidates, event_val, control_level, rule_ctx
    )
    
    # Rule 5: Uncertainty normalizer
    emotion_val = apply_uncertainty_normalizer(emotion_val, features, rule_ctx)
    
    # Final clamping
    event_val = clamp(event_val)
    emotion_val = clamp(emotion_val)
    arousal = clamp(arousal, 0.1, 0.9)
    
    return primary_candidates, event_val, emotion_val, arousal, rule_ctx
