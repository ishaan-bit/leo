"""
Dual-Channel Valence System

Separates objective event valence (what happened) from subjective emotion valence (how it felt).

Event Channel: Praise, progress, awards, rituals → objective outcome
Emotion Channel: Metaphors, affect words, hedges → subjective experience

This decoupling handles mismatches like:
- "Got promoted (event+) but feel empty (emotion-)"
- "Failed exam (event-) but staying hopeful (emotion+)"
"""

import re
from typing import Dict, List, Tuple
from dataclasses import dataclass

from .features import FeatureSet
from .clauses import Clause, get_weighted_text_spans


@dataclass
class DualValence:
    """Container for dual-channel valence scores"""
    event_valence: float  # [0, 1] - objective outcome
    emotion_valence: float  # [0, 1] - subjective feeling
    event_confidence: float  # How certain we are about event
    emotion_confidence: float  # How certain we are about emotion
    explanation: str = ""  # Human-readable reasoning


# Event Channel Patterns (Objective Outcomes)
EVENT_POSITIVE_PATTERNS = {
    'achievement': re.compile(
        r'\b(promot(ed|ion)|raise|bonus|hired|accepted|admitted|'
        r'award(ed)?|won|victory|success(ful)?|accomplished?|'
        r'completed?|finished|graduated?|passed)\b',
        re.IGNORECASE
    ),
    'progress': re.compile(
        r'\b(progress|improv(ed|ing|ement)|better|getting there|'
        r'step forward|moving forward|on track|milestone)\b',
        re.IGNORECASE
    ),
    'delivery': re.compile(
        r'\b(shipped|deployed?|launch(ed)?|released?|delivered?|'
        r'went live|pushed to prod)\b',
        re.IGNORECASE
    ),
    'recognition': re.compile(
        r'\b(praised?|recognized?|acknowledged?|appreciated?|'
        r'thanked?|validated?|seen)\b',
        re.IGNORECASE
    ),
    'ritual_completion': re.compile(
        r'\b((did|completed?|tried) .{0,20}?(meditation|yoga|workout|therapy|journal)|'
        r'practiced|exercised|ran|worked out|meditated)',
        re.IGNORECASE
    ),
}

EVENT_NEGATIVE_PATTERNS = {
    'failure': re.compile(
        r'\b(failed?|failure|rejected?|rejection|fired|laid off|'
        r'let go|terminated|lost|missed|didn\'?t (get|make it))\b',
        re.IGNORECASE
    ),
    'setback': re.compile(
        r'\b(delay(ed)?|postpon(ed)?|cancel(led)?|blocked?|'
        r'stuck|stall(ed)?|halted?|setback)\b',
        re.IGNORECASE
    ),
    'negative_outcome': re.compile(
        r'\b(broke up|breakup|accident|crash(ed)?|bug|outage|'
        r'down|offline|error|worse|ruined?|damage(d)?|fell apart)\b',
        re.IGNORECASE
    ),
}

# Emotion Channel Patterns (Subjective Affect)
EMOTION_POSITIVE_PATTERNS = {
    'joy': re.compile(
        r'\b(happy|joy(ful)?|excited?|elated|thrilled|delighted?|'
        r'cheerful|upbeat|glad)\b',
        re.IGNORECASE
    ),
    'peace': re.compile(
        r'\b(peaceful|calm|relaxed?|content(ed)?|serene|tranquil|'
        r'at ease|settled)\b',
        re.IGNORECASE
    ),
    'strength': re.compile(
        r'\b(strong|confident|proud|resilient|capable|'
        r'empowered?|determined)\b',
        re.IGNORECASE
    ),
}

EMOTION_NEGATIVE_PATTERNS = {
    'sadness': re.compile(
        r'\b(sad|depressed?|down|low|blue|gloomy|miserable|'
        r'heartbroken|grief|mourning|miss|missing|lonely|alone|empty)\b',
        re.IGNORECASE
    ),
    'anxiety': re.compile(
        r'\b(anxious|anxiety|worried|nervous|tense|stressed?|'
        r'panic(ked)?|overwhelmed?)\b',
        re.IGNORECASE
    ),
    'anger': re.compile(
        r'\b(angry|mad|furious|irritated?|annoyed?|frustrated?|'
        r'pissed( off)?|resentful)\b',
        re.IGNORECASE
    ),
    'confusion': re.compile(
        r'\b(confused?|lost|unclear|uncertain|don\'?t know|'
        r'mixed feelings?|ambivalent)\b',
        re.IGNORECASE
    ),
    'regret': re.compile(
        r'\b(regret|wish (i|it)( hadn\'?t)?|should(n\'?t)? have|'
        r'if only|didn\'?t want.*but|pretend(ing)?)\b',
        re.IGNORECASE
    ),
}


def compute_event_valence(
    text: str,
    features: FeatureSet,
    clauses: List[Clause]
) -> Tuple[float, float, str]:
    """
    Compute objective event valence from outcome cues.
    
    Scores:
    - Achievement: +0.4 to +0.5
    - Progress: +0.2 to +0.3
    - Praise/Recognition: +0.2 to +0.3
    - Ritual completion: +0.15
    - Failure: -0.4 to -0.5
    - Setback: -0.2 to -0.3
    
    Args:
        text: Input text
        features: Extracted features
        clauses: Segmented clauses
        
    Returns:
        (event_valence, confidence, explanation)
    """
    score = 0.5  # Neutral baseline
    evidence = []
    
    # Positive events
    if EVENT_POSITIVE_PATTERNS['achievement'].search(text):
        score += 0.45
        evidence.append("achievement+0.45")
    
    if EVENT_POSITIVE_PATTERNS['progress'].search(text):
        score += 0.25
        evidence.append("progress+0.25")
    
    if EVENT_POSITIVE_PATTERNS['delivery'].search(text):
        score += 0.35
        evidence.append("delivery+0.35")
    
    if features.praise:
        score += 0.25
        evidence.append(f"praise+0.25 ({len(features.matched_tokens.get('praise', []))} tokens)")
    
    if EVENT_POSITIVE_PATTERNS['recognition'].search(text):
        score += 0.20
        evidence.append("recognition+0.20")
    
    if features.ritual_tokens:
        if EVENT_POSITIVE_PATTERNS['ritual_completion'].search(text):
            score += 0.20  # Increased from 0.15 - ritual completion is positive action
            evidence.append("ritual_completion+0.20")
    
    # Negative events
    if EVENT_NEGATIVE_PATTERNS['failure'].search(text):
        score -= 0.45
        evidence.append("failure-0.45")
    
    if EVENT_NEGATIVE_PATTERNS['setback'].search(text):
        score -= 0.25
        evidence.append("setback-0.25")
    
    if EVENT_NEGATIVE_PATTERNS['negative_outcome'].search(text):
        score -= 0.35  # Increased from 0.30 for stronger negative signal
        evidence.append("negative_outcome-0.35")
    
    # Apply soft cap at 0.95 to avoid perfect 1.0 scores (reserve for extreme cases)
    if score > 0.95:
        score = 0.95
    
    # Apply soft floor at 0.25 to avoid extreme negatives (reserve 0.0-0.2 for catastrophic events)
    if score < 0.25 and evidence:  # Only apply floor if we detected negative events
        score = max(0.25, score)
    
    # Clamp to [0, 1]
    score = max(0.0, min(1.0, score))
    
    # Confidence based on amount of evidence
    confidence = min(0.9, len(evidence) * 0.15 + 0.3) if evidence else 0.4
    
    explanation = " | ".join(evidence) if evidence else "no_event_cues"
    
    return score, confidence, explanation


def compute_emotion_valence(
    text: str,
    features: FeatureSet,
    clauses: List[Clause]
) -> Tuple[float, float, str]:
    """
    Compute subjective emotion valence from affect cues.
    
    Uses clause weighting: later clauses (especially after contrast) count more.
    Incorporates feature-based signals (neg_metaphor, fatigue, hedge) alongside lexicon.
    
    Args:
        text: Input text
        features: Extracted features
        clauses: Segmented clauses with weights
        
    Returns:
        (emotion_valence, confidence, explanation)
    """
    score = 0.5  # Neutral baseline
    evidence = []
    
    # Feature-based global signals (not clause-specific)
    
    # Negative metaphors are strong negative affect indicators
    if features.neg_metaphor:
        # Physio distress metaphors (nausea, motion sickness) are less emotionally negative
        # than existential metaphors (drowning, sinking, empty)
        if features.physio_distress:
            metaphor_penalty = -0.20 * len(features.matched_tokens.get('neg_metaphor', []))  # Reduced from -0.30
        else:
            metaphor_penalty = -0.30 * len(features.matched_tokens.get('neg_metaphor', []))
        
        # Boost penalty slightly if contrastive (emphasizes the negative feeling after "but")
        if features.contrastive:
            metaphor_penalty *= 1.15  # 15% stronger
        score += metaphor_penalty
        evidence.append(f"neg_metaphor{metaphor_penalty:.2f} ({len(features.matched_tokens.get('neg_metaphor', []))} tokens)")
    
    # Fatigue dampens all emotion, tends negative
    if features.fatigue:
        score -= 0.15 * features.fatigue_count
        evidence.append(f"fatigue-{0.15 * features.fatigue_count:.2f}")
    
    # Hedge reduces certainty, pulls toward neutral (handled in rules, but also affects base)
    # Not scored here to avoid double-application with uncertainty_normalizer rule
    
    # Weighted scoring from clauses (lexicon-based)
    total_weight = sum(c.weight for c in clauses)
    if total_weight == 0:
        total_weight = 1.0
    
    for clause in clauses:
        clause_score = 0.0
        clause_evidence = []
        
        # Positive emotions
        for pattern_name, pattern in EMOTION_POSITIVE_PATTERNS.items():
            if pattern.search(clause.text):
                clause_score += 0.25
                clause_evidence.append(f"{pattern_name}+")
        
        # Negative emotions
        for pattern_name, pattern in EMOTION_NEGATIVE_PATTERNS.items():
            if pattern.search(clause.text):
                clause_score -= 0.25
                clause_evidence.append(f"{pattern_name}-")
        
        # Apply clause weight
        weighted_score = clause_score * (clause.weight / total_weight)
        score += weighted_score
        
        if clause_evidence:
            weight_label = f"[{clause.weight:.1f}×]" if clause.weight != 1.0 else ""
            evidence.append(f"{weight_label}{'|'.join(clause_evidence)}")
    
    # Apply soft floor at 0.25 for strong negative signals (avoid extreme lows < 0.2)
    # This prevents overly pessimistic scoring from metaphor stacking
    # Physio distress gets slightly higher floor (0.30) as it's uncomfortable but not devastating
    if score < 0.30 and features.physio_distress:
        score = 0.30
    elif score < 0.25 and (features.neg_metaphor or features.fatigue):
        score = 0.25
    
    # Clamp to [0, 1]
    score = max(0.0, min(1.0, score))
    
    # Confidence based on amount of evidence
    confidence = min(0.9, len(evidence) * 0.12 + 0.35) if evidence else 0.4
    
    explanation = " | ".join(evidence) if evidence else "no_emotion_cues"
    
    return score, confidence, explanation


def compute_dual_valence(
    text: str,
    features: FeatureSet,
    clauses: List[Clause]
) -> DualValence:
    """
    Compute both event and emotion valence channels.
    
    Args:
        text: Input text
        features: Extracted features
        clauses: Segmented clauses
        
    Returns:
        DualValence with both scores
    """
    event_val, event_conf, event_exp = compute_event_valence(text, features, clauses)
    emotion_val, emotion_conf, emotion_exp = compute_emotion_valence(text, features, clauses)
    
    return DualValence(
        event_valence=event_val,
        emotion_valence=emotion_val,
        event_confidence=event_conf,
        emotion_confidence=emotion_conf,
        explanation=f"EVENT: {event_exp} | EMOTION: {emotion_exp}"
    )


# Utility: Check for valence mismatch (common in complex reflections)
def has_valence_mismatch(dual: DualValence, threshold: float = 0.3) -> bool:
    """
    Detect when event and emotion valences diverge significantly.
    
    Example: "Got promoted (event=0.9) but feel empty (emotion=0.2)"
    
    Args:
        dual: DualValence object
        threshold: Minimum difference to consider mismatch
        
    Returns:
        True if mismatch detected
    """
    return abs(dual.event_valence - dual.emotion_valence) >= threshold
