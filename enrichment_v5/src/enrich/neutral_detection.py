"""
Neutral Emotion & Event Detection Module

Implements evidence-based thresholds to classify texts as emotionally neutral
or event-neutral, addressing the "expressionless" and "routine day" cases.

Thresholds:
- TAU_EMOTION: Minimum emotion evidence density for "explicit" emotion
- TAU_EVENT: Minimum event evidence density for "specific" event

Classifications:
- emotion_presence: "none" | "subtle" | "explicit"
- event_presence: "none" | "routine" | "specific"

Enhanced Emotion Detection (FEATURE_ENHANCED_EMOTION_DETECTION):
- Lower thresholds (0.12 → 0.09)
- Expanded lexicon (relationship verbs, implicit phrases)
- Domain-aware bonuses (relationship/family)
"""

import re
from typing import Tuple, Dict
from dataclasses import dataclass

from .features import FeatureSet

# Check feature flag
try:
    from config.settings import settings
    ENHANCED_EMOTION_DETECTION = settings.FEATURE_ENHANCED_EMOTION_DETECTION
except ImportError:
    ENHANCED_EMOTION_DETECTION = True  # Default to enhanced mode


# Thresholds for neutral detection
if ENHANCED_EMOTION_DETECTION:
    TAU_EMOTION = 0.045  # Reduced by half from 0.09 to catch explicit emotions like "irritable"
    TAU_EMOTION_SUBTLE = 0.015  # Lowered from 0.045 to catch subtle emotions like "feeling better"
else:
    TAU_EMOTION = 0.06  # Reduced by half from 0.12
    TAU_EMOTION_SUBTLE = 0.06

TAU_EVENT = 0.12    # Min density for specific event (normalized by token count)

# Routine event markers (mundane, expected occurrences)
ROUTINE_EVENT_PATTERN = re.compile(
    r'\b(just a (normal|regular|typical) day|as usual|same as (always|ever)|'
    r'nothing special|like (always|usual)|another day|every day)\b',
    re.IGNORECASE
)

# Enhanced emotion detection patterns (implicit emotions)
if ENHANCED_EMOTION_DETECTION:
    # Relationship verbs (implicit emotional connection)
    RELATIONSHIP_VERBS = re.compile(
        r'\b(miss(ed|ing)?|reach(ed|ing)? out|connect(ed|ing)?|distance|drift(ed|ing)?|'
        r'avoid(ed|ing)?|ignore(d|ing)?|withdraw(n|ing)?|isolat(ed|ing)?|'
        r'cling(ing)?|need(ed|ing)?|depend(ed|ing)?|trust(ed|ing)?|'
        r'betray(ed|ing)?|hurt(s|ing)?|disappoint(ed|ing)?|let down|'
        r'lean(ed|ing)? on|rely(ing)? on|count(ed|ing)? on|there for)\b',
        re.IGNORECASE
    )
    
    # State-of-being markers (implicit emotional state)
    STATE_OF_BEING = re.compile(
        r'\b(can\'t (stop|help|shake)|keep (thinking|dwelling|ruminating)|'
        r'stuck in|trapped in|lost in|consumed by|dwelling on|'
        r'replay(ing)?|haunted by|struggling with|wrestling with|'
        r'trying to (process|understand|make sense)|'
        r'don\'t know (how|what|why)|unsure|uncertain|confused)\b',
        re.IGNORECASE
    )
    
    # Implicit emotion phrases (relationship context)
    IMPLICIT_EMOTION_PHRASES = re.compile(
        r'\b(wish (things|we|they)|if only|should have|could have|'
        r'maybe if|what if|used to|remember when|back when|'
        r'not the same|different now|changed|growing apart|'
        r'feel(s)? like|seems like|as if|like (I|we|they))\b',
        re.IGNORECASE
    )
else:
    RELATIONSHIP_VERBS = None
    STATE_OF_BEING = None
    IMPLICIT_EMOTION_PHRASES = None


@dataclass
class NeutralClassification:
    """Result of neutral detection analysis"""
    emotion_presence: str  # "none", "subtle", "explicit"
    event_presence: str    # "none", "routine", "specific"
    emotion_evidence: float  # Raw evidence score
    event_evidence: float    # Raw evidence score
    emotion_density: float   # Evidence normalized by tokens
    event_density: float     # Evidence normalized by tokens
    is_emotion_neutral: bool
    is_event_neutral: bool
    confidence_adjustment: float  # Penalty to apply to overall confidence
    explanation: str


def count_tokens(text: str) -> int:
    """Count meaningful tokens (words) in text"""
    tokens = re.findall(r'\b\w+\b', text)
    return max(len(tokens), 1)  # Avoid division by zero


def compute_emotion_evidence(
    text: str,
    features: FeatureSet,
    emotion_valence: float,
    domain: str = "self"
) -> float:
    """
    Compute evidence score for emotional content.
    
    Higher scores indicate more explicit emotion.
    
    Signals (baseline):
    - Neg metaphors: +1.0 each
    - Fatigue markers: +0.5 each
    - Hedge markers: +0.3 each (uncertainty is mild emotion)
    - Valence deviation from 0.5: +0.5 * abs(deviation)
    - Sarcasm: +0.8
    - Explicit emotion words: +1.5 each
    
    Enhanced signals (FEATURE_ENHANCED_EMOTION_DETECTION):
    - Relationship verbs: +0.8 each (miss, distance, avoid, etc.)
    - State-of-being markers: +0.7 each (can't stop, stuck in, etc.)
    - Implicit emotion phrases: +0.6 each (wish things, used to, etc.)
    - Domain bonus: +0.3 for relationship/family contexts
    
    Args:
        text: Input text
        features: Extracted features
        emotion_valence: Computed emotion valence [0, 1]
        domain: Domain context (for enhanced detection)
        
    Returns:
        Raw evidence score (unnormalized)
    """
    # Check for routine context first
    is_routine_context = bool(ROUTINE_EVENT_PATTERN.search(text))
    
    evidence = 0.0
    
    # Strong emotion signals (baseline)
    if features.neg_metaphor:
        evidence += 1.0 * len(features.matched_tokens.get('neg_metaphor', []))
    
    # Moderate emotion signals
    if features.fatigue:
        evidence += 0.5 * features.fatigue_count
    
    if features.sarcasm_cue:
        evidence += 0.8
    
    # Mild emotion signals (hedges indicate emotional uncertainty)
    if features.hedge:
        evidence += 0.3 * features.hedge_count
    
    # Valence deviation from neutral (0.5)
    # Only count if deviation is meaningful AND not in routine context
    valence_deviation = abs(emotion_valence - 0.5)
    if valence_deviation > 0.15 and not is_routine_context:  # Raised threshold from 0.1
        evidence += 0.5 * valence_deviation
    
    # Check for explicit emotion words in text
    # Use multiple simple patterns instead of complex regex with groups
    emotion_words = []
    
    # Core emotion words
    emotion_words.extend(re.findall(
        r'\b(sad|happy|angry|fear(ful)?|anxious|excited|peaceful|stressed?|'
        r'depressed?|joy(ful)?|overwhelmed?|calm|frustrated?|worried|nervous|'
        r'content|grateful|lonely|hurt|proud|ashamed|guilty|confident|'
        r'irritated?|annoyed?|pissed|fed up|mad)\b',
        text, re.IGNORECASE
    ))
    
    # Feeling phrases
    feeling_match = re.search(r'\bfeeling (really |so |very )?(good|bad|great|terrible|awful|amazing)', text, re.IGNORECASE)
    if feeling_match:
        emotion_words.append('feeling_explicit')
    
    # CRITICAL: Profanity as emotion signal
    # Check for negative frustration profanity (fucking, shit, fuck, etc.)
    profanity_pattern = re.compile(
        r'\b(fuck(ing)?|shit|bullshit|goddamn|dammit|wtf|pissed off|'
        r'piece of shit|screw this|to hell with|pathetic|beyond repair)\b',
        re.IGNORECASE
    )
    profanity_matches = profanity_pattern.findall(text)
    # Each profanity phrase is a VERY strong emotion signal
    evidence += 2.0 * len([m for m in profanity_matches if m])  # 2.0 per profanity phrase
    
    # Flatten and count (filter out empty strings from groups)
    emotion_count = sum(1 for match in emotion_words if match and (isinstance(match, str) or (isinstance(match, tuple) and match[0])))
    evidence += 1.5 * emotion_count  # Increased from 1.2 - explicit words are very strong signals
    
    # === Enhanced emotion detection ===
    if ENHANCED_EMOTION_DETECTION:
        # Relationship verbs (implicit emotional connection)
        if RELATIONSHIP_VERBS:
            rel_verbs = RELATIONSHIP_VERBS.findall(text)
            evidence += 0.8 * len(rel_verbs)
        
        # State-of-being markers (implicit emotional state)
        if STATE_OF_BEING:
            state_markers = STATE_OF_BEING.findall(text)
            evidence += 0.7 * len(state_markers)
        
        # Implicit emotion phrases (relationship context)
        if IMPLICIT_EMOTION_PHRASES:
            implicit_phrases = IMPLICIT_EMOTION_PHRASES.findall(text)
            evidence += 0.6 * len(implicit_phrases)
        
        # Domain-aware bonus (relationship/family narratives often implicit)
        if domain in ("relationship", "relationships", "family"):
            evidence += 0.3
    
    return evidence


def compute_event_evidence(
    text: str,
    features: FeatureSet,
    event_valence: float
) -> float:
    """
    Compute evidence score for event content.
    
    Higher scores indicate more specific events.
    
    Signals:
    - Praise tokens: +0.6 each
    - Work tokens: +0.7 each
    - Money tokens: +0.7 each
    - Ritual tokens: +0.5 each
    - Event valence deviation from 0.5: +0.6 * abs(deviation)
    - Failed attempt: +0.9
    - Past action markers: +0.4
    
    Args:
        text: Input text
        features: Extracted features
        event_valence: Computed event valence [0, 1]
        
    Returns:
        Raw evidence score (unnormalized)
    """
    evidence = 0.0
    
    # Specific event signals
    if features.praise:
        evidence += 0.6 * len(features.matched_tokens.get('praise', []))
    
    # Work/money tokens only count if NOT in routine context
    is_routine_context = bool(ROUTINE_EVENT_PATTERN.search(text))
    
    if features.work_tokens and not is_routine_context:
        evidence += 0.7 * len(features.work_tokens)
    
    if features.money_tokens and not is_routine_context:
        evidence += 0.7 * len(features.money_tokens)
    
    if features.ritual_tokens:
        evidence += 0.5 * len(features.ritual_tokens)
    
    if features.failed_attempt:
        evidence += 0.9  # Attempts are concrete events
    
    if features.past_action:
        evidence += 0.4  # Past actions suggest specific events
    
    # Event valence deviation from neutral (0.5)
    valence_deviation = abs(event_valence - 0.5)
    if valence_deviation > 0.1:
        evidence += 0.6 * valence_deviation
    
    # Check for specific event markers
    specific_event_pattern = re.compile(
        r'\b(promoted?|promotion|fired|hired|completed?|finished|failed?|won|lost|'
        r'shipped|deployed?|met with|talked to|called|texted|fought|argued|'
        r'broke up|married|divorced|moved|traveled|bought|sold|working towards?)\b',
        re.IGNORECASE
    )
    event_words = specific_event_pattern.findall(text)
    evidence += 1.0 * len(event_words)  # Increased from 0.8
    
    return evidence


def classify_emotion_presence(density: float) -> str:
    """
    Classify emotion presence based on evidence density.
    
    Args:
        density: Evidence per token
        
    Returns:
        "none", "subtle", or "explicit"
    """
    if density < TAU_EMOTION_SUBTLE:
        return "none"
    elif density < TAU_EMOTION:
        return "subtle"
    else:
        return "explicit"


def classify_event_presence(density: float, is_routine: bool) -> str:
    """
    Classify event presence based on evidence density and routine markers.
    
    Args:
        density: Evidence per token
        is_routine: Whether routine event markers detected
        
    Returns:
        "none", "routine", or "specific"
    """
    if is_routine:
        return "routine"
    elif density < TAU_EVENT * 0.5:
        return "none"
    elif density < TAU_EVENT:
        return "routine"  # Low-signal events treated as routine
    else:
        return "specific"


def detect_neutral_states(
    text: str,
    features: FeatureSet,
    emotion_valence: float,
    event_valence: float,
    domain: str = "self"
) -> NeutralClassification:
    """
    Detect neutral emotion and/or neutral event states.
    
    Returns classification with confidence adjustments.
    
    Args:
        text: Input text
        features: Extracted features
        emotion_valence: Computed emotion valence
        event_valence: Computed event valence
        domain: Domain context for enhanced detection
        
    Returns:
        NeutralClassification with presence categories and adjustments
    """
    token_count = count_tokens(text)
    
    # Compute raw evidence (pass domain for enhanced detection)
    emotion_evidence = compute_emotion_evidence(text, features, emotion_valence, domain)
    event_evidence = compute_event_evidence(text, features, event_valence)
    
    # Normalize by token count
    emotion_density = emotion_evidence / token_count
    event_density = event_evidence / token_count
    
    # Check for routine event markers
    is_routine = bool(ROUTINE_EVENT_PATTERN.search(text))
    
    # Classify presence
    emotion_presence = classify_emotion_presence(emotion_density)
    event_presence = classify_event_presence(event_density, is_routine)
    
    # Determine neutrality flags
    # Routine context: treat "subtle" emotion as neutral (mundane activities have weak valence)
    is_emotion_neutral = (emotion_presence == "none") or (is_routine and emotion_presence == "subtle")
    is_event_neutral = event_presence in ["none", "routine"]
    
    # Compute confidence adjustment
    # Penalize confidence when signals are weak
    confidence_adjustment = 0.0
    if is_emotion_neutral or is_event_neutral:
        confidence_adjustment -= 0.05
    if is_emotion_neutral and is_event_neutral:
        confidence_adjustment -= 0.05  # Additional penalty for both neutral
    
    # Build explanation
    parts = []
    parts.append(f"emotion_presence={emotion_presence} (density={emotion_density:.3f}, tau={TAU_EMOTION})")
    parts.append(f"event_presence={event_presence} (density={event_density:.3f}, tau={TAU_EVENT})")
    if is_routine:
        parts.append("routine_markers_detected")
    explanation = " | ".join(parts)
    
    return NeutralClassification(
        emotion_presence=emotion_presence,
        event_presence=event_presence,
        emotion_evidence=emotion_evidence,
        event_evidence=event_evidence,
        emotion_density=emotion_density,
        event_density=event_density,
        is_emotion_neutral=is_emotion_neutral,
        is_event_neutral=is_event_neutral,
        confidence_adjustment=confidence_adjustment,
        explanation=explanation
    )
