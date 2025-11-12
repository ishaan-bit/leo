"""
v2.2 Enrichment Pipeline with Tertiary Emotion Layer

Extends v2.1 with:
- Neutral emotion/event detection
- Tertiary emotion detection (197 fine-grain states)
- Enhanced output schema
"""

from typing import Dict, Optional, List
from dataclasses import dataclass, asdict

from .features import extract_features, FeatureSet
from .clauses import segment_clauses, clause_weights, Clause
from .dual_valence import compute_dual_valence, DualValence
from .domain_resolver import resolve_domain, DomainScore
from .control_polarity import infer_control, infer_polarity, ControlInference, PolarityInference
from .rules import apply_all_rules, RuleContext
from .neutral_detection import detect_neutral_states, NeutralClassification
from .tertiary_extraction import extract_tertiary_motifs, select_best_tertiary, TertiaryCandidate
from .negation import analyze_negation, apply_negation_to_valence


@dataclass
class EnrichmentResult:
    """Complete enrichment output with v2.2 features"""
    # Core emotions
    primary: str
    secondary: Optional[str]
    tertiary: Optional[str]
    
    # Valence/Arousal
    emotion_valence: float
    event_valence: float
    arousal: float
    
    # Context
    domain: str
    control: str
    polarity: str
    
    # Neutral states
    emotion_presence: str  # "none" | "subtle" | "explicit"
    event_presence: str    # "none" | "routine" | "specific"
    is_emotion_neutral: bool
    is_event_neutral: bool
    
    # Confidence
    tertiary_confidence: Optional[float]
    neutral_confidence_adjustment: float
    
    # Explanations
    tertiary_explanation: Optional[str]
    neutral_explanation: str
    rule_explanation: str
    domain_explanation: str
    control_explanation: str
    polarity_explanation: str
    
    # Flags
    flags: Dict[str, bool]
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)


def score_primary_emotions_simple(
    text: str,
    features: FeatureSet,
    dual_valence: DualValence,
    neutral_classification: Optional['NeutralClassification'] = None,
    negation_result = None
) -> Dict[str, float]:
    """
    Simple lexicon-based primary emotion scoring with keyword detection.
    
    This is enhanced from placeholder to include:
    - Emotion keyword detection
    - Profanity → Angry boost
    - Litotes → Happy boost
    - Stricter neutral criteria
    
    Args:
        text: Input text
        features: Extracted features
        dual_valence: Computed valence scores
        neutral_classification: Optional neutral state detection result
        negation_result: Negation analysis result (for litotes detection)
    
    Returns:
        {primary: score} for all 6 primaries + Neutral
    """
    PRIMARIES = ['Happy', 'Sad', 'Angry', 'Fearful', 'Strong', 'Peaceful', 'Neutral']
    text_lower = text.lower()
    
    # Initialize all primaries
    scores = {p: 0.0 for p in PRIMARIES}
    
    # Emotion keyword detection (overrides valence-only scoring)
    EMOTION_KEYWORDS = {
        'Sad': ['sad', 'depressed', 'lonely', 'grief', 'heartbroken', 'disappointed', 
                'disconnected', 'hopeless', 'miserable', 'devastated'],
        'Angry': ['angry', 'frustrated', 'furious', 'annoyed', 'irritated', 'pissed',
                  'mad', 'hate', 'disgusted'],
        'Fearful': ['anxious', 'worried', 'scared', 'afraid', 'nervous', 'overwhelmed',
                    'stressed', 'panic', 'terrified', 'helpless'],
        'Happy': ['happy', 'excited', 'joy', 'glad', 'proud', 'grateful', 'blessed',
                  'thrilled', 'delighted', 'pleased'],
        'Strong': ['strong', 'confident', 'powerful', 'capable', 'determined',
                   'resilient', 'bold'],
        'Peaceful': ['peaceful', 'calm', 'relaxed', 'content', 'serene', 'tranquil']
    }
    
    # Check for emotion keywords (strong signal)
    keyword_matches = {emotion: 0 for emotion in PRIMARIES[:-1]}  # Exclude Neutral
    for emotion, keywords in EMOTION_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                keyword_matches[emotion] += 1
    
    # Profanity detection (boost Angry)
    PROFANITY = ['fuck', 'shit', 'damn', 'hell', 'ass', 'bastard', 'bitch']
    has_profanity = any(prof in text_lower for prof in PROFANITY)
    
    # Strong negative event words (not neutral)
    NEGATIVE_EVENT_WORDS = ['failed', 'rejected', 'fired', 'lost', 'missed', 'broke',
                            'cancelled', 'delay', 'setback']
    has_negative_event = any(word in text_lower for word in NEGATIVE_EVENT_WORDS)
    
    # Check if truly neutral (strict criteria)
    if neutral_classification and neutral_classification.is_emotion_neutral:
        # Only return Neutral if NO strong emotion keywords AND NO negative events
        if sum(keyword_matches.values()) == 0 and not has_negative_event and not has_profanity:
            scores['Neutral'] = 0.8
            scores['Peaceful'] = 0.15
            scores['Sad'] = 0.025
            scores['Happy'] = 0.025
            return scores
    
    # Simplified scoring based on valence
    emotion_val = dual_valence.emotion_valence
    event_val = dual_valence.event_valence
    
    # Negative valence → Sad, Angry, Fearful
    if emotion_val < 0.4:
        scores['Sad'] = 0.5 - emotion_val
        scores['Fearful'] = 0.4 - emotion_val
        scores['Angry'] = 0.3 - emotion_val
        if features.sarcasm_cue:
            scores['Angry'] += 0.3
    
    # Positive valence → Happy, Strong, Peaceful
    elif emotion_val > 0.6:
        scores['Happy'] = emotion_val - 0.4
        scores['Peaceful'] = emotion_val - 0.5
        if event_val > 0.6:
            scores['Strong'] = emotion_val - 0.3
    
    # Neutral range (0.4 - 0.6) - be cautious about returning Neutral
    else:
        # Default to subtle emotions, not Neutral
        scores['Peaceful'] = 0.3
        scores['Sad'] = 0.25
        scores['Fearful'] = 0.2
        scores['Neutral'] = 0.1  # Low baseline
    
    # Apply keyword boosts (strong signal)
    for emotion, count in keyword_matches.items():
        if count > 0:
            scores[emotion] += count * 0.4
    
    # Profanity → Angry boost
    if has_profanity:
        scores['Angry'] += 0.4
        scores['Sad'] += 0.1  # Some profanity is frustrated/sad
    
    # Litotes → Happy boost (check negation result)
    if negation_result and negation_result.strength == 'litotes':
        scores['Happy'] += 0.4
        scores['Peaceful'] += 0.2
        scores['Neutral'] -= 0.3
    
    # Negative events → Sad/Fearful boost
    if has_negative_event:
        scores['Sad'] += 0.3
        scores['Fearful'] += 0.2
        scores['Neutral'] -= 0.3
    
    # Normalize
    total = sum(scores.values())
    if total > 0:
        scores = {k: max(0, v) / total for k, v in scores.items()}
    
    return scores


def compute_base_arousal(text: str, features: FeatureSet, dual_valence: DualValence) -> float:
    """
    Compute base arousal level.
    
    Returns:
        Arousal in [0, 1]
    """
    arousal = 0.5  # Neutral baseline
    
    # Boost from sarcasm
    if features.sarcasm_cue:
        arousal += 0.15
    
    # Boost from valence deviation
    valence_deviation = abs(dual_valence.emotion_valence - 0.5)
    arousal += valence_deviation * 0.3
    
    # Cap at [0, 1]
    return min(1.0, max(0.0, arousal))


def select_secondary_for_primary(
    primary: str,
    text: str,
    features: FeatureSet,
    dual_valence: DualValence,
    control: ControlInference,
    polarity: PolarityInference
) -> Optional[str]:
    """
    Select secondary emotion within the chosen primary.
    
    This is a simplified heuristic - in production, would use
    embedding similarity or more sophisticated methods.
    
    Returns:
        Secondary emotion name or None
    """
    from .tertiary_wheel import WHEEL
    
    if primary not in WHEEL:
        return None
    
    secondaries = list(WHEEL[primary].keys())
    if not secondaries:
        return None
    
    # Simplified heuristic selection based on features
    emotion_val = dual_valence.emotion_valence
    
    if primary == "Sad":
        # Check for specific tertiary motifs to guide secondary selection
        text_lower = text.lower()
        if 'homesick' in text_lower or 'miss' in text_lower or 'alone' in text_lower:
            return "Lonely"
        elif 'heartbroken' in text_lower or 'bereaved' in text_lower:
            return "Grief"
        elif 'ashamed' in text_lower or 'regret' in text_lower or 'my fault' in text_lower:
            return "Guilty"
        elif features.hedge or control.level == "low":
            return "Vulnerable"
        elif emotion_val < 0.3:
            return "Depressed"
        elif features.past_action or len(features.ritual_tokens) > 0:
            return "Guilty"
        else:
            return "Lonely"
    
    elif primary == "Fearful":
        # Check for specific tertiary motifs
        text_lower = text.lower()
        if 'drown' in text_lower or 'overwhelm' in text_lower or 'stressed' in text_lower:
            return "Overwhelmed"
        elif 'anxious' in text_lower or 'nervous' in text_lower or 'worried' in text_lower:
            return "Anxious"
        elif 'helpless' in text_lower or 'powerless' in text_lower or 'stuck' in text_lower:
            return "Helpless"
        elif features.hedge or features.uncertainty:
            return "Anxious"
        elif control.level == "low":
            return "Helpless"
        elif features.neg_metaphor:
            return "Overwhelmed"
        else:
            return "Insecure"
    
    elif primary == "Angry":
        if features.sarcasm_cue:
            return "Critical"
        elif features.failed_attempt:
            return "Frustrated"
        else:
            return "Disappointed"
    
    elif primary == "Happy":
        if dual_valence.event_valence > 0.7:
            return "Excited"
        else:
            return "Optimistic"
    
    elif primary == "Strong":
        if dual_valence.event_valence > 0.7:
            return "Proud"
        else:
            return "Confident"
    
    elif primary == "Peaceful":
        if features.praise or len(features.ritual_tokens) > 0:
            return "Grateful"
        else:
            return "Content"
    
    # Default: return first secondary
    return secondaries[0]


def enrich_v2_2(
    text: str,
    include_tertiary: bool = True,
    include_neutral: bool = True
) -> EnrichmentResult:
    """
    Main v2.2 enrichment pipeline with tertiary and neutral detection.
    
    Args:
        text: Input text (reflection)
        include_tertiary: Whether to detect tertiary emotions
        include_neutral: Whether to detect neutral states
        
    Returns:
        EnrichmentResult with all v2.2 features
    """
    # 1. Extract features
    features = extract_features(text)
    
    # 2. Segment clauses with weighting
    clauses = segment_clauses(text)
    
    # 3. Compute dual valence
    dual_valence = compute_dual_valence(text, features, clauses)
    
    # 3.5. Apply negation detection and adjustment
    negation_result = analyze_negation(text)
    negation_detected = negation_result.has_negation
    
    if negation_detected and negation_result.strength != 'none':
        # Adjust emotion valence based on negation
        adjusted_emotion_valence, negation_explanation = apply_negation_to_valence(
            dual_valence.emotion_valence,
            text,
            neutral_point=0.5
        )
        # Update dual_valence with adjusted emotion valence
        dual_valence = DualValence(
            emotion_valence=adjusted_emotion_valence,
            event_valence=dual_valence.event_valence,
            emotion_confidence=dual_valence.emotion_confidence,
            event_confidence=dual_valence.event_confidence,
            explanation=dual_valence.explanation + " | " + negation_explanation
        )
    else:
        negation_explanation = "No negation detected"
    
    # 4. Detect neutral states (if enabled)
    neutral: Optional[NeutralClassification] = None
    if include_neutral:
        neutral = detect_neutral_states(
            text=text,
            features=features,
            emotion_valence=dual_valence.emotion_valence,
            event_valence=dual_valence.event_valence
        )
    
    # 5. Resolve domain
    domain_score = resolve_domain(features, text)
    
    # 6. Infer control and polarity
    control = infer_control(features, text)
    polarity = infer_polarity(features, text)
    
    # 7. Score primary emotions (pass neutral classification and negation result)
    primary_candidates = score_primary_emotions_simple(
        text, features, dual_valence, neutral, negation_result
    )
    
    # 8. Compute base arousal
    base_arousal = compute_base_arousal(text, features, dual_valence)
    
    # 9. Apply rules (sarcasm, fatigue, angry_alignment, uncertainty, physio_distress)
    modified_primaries, event_val, emotion_val, arousal, rule_ctx = apply_all_rules(
        primary_candidates,
        dual_valence,
        base_arousal,
        features,
        control_level=control.level  # Pass control level for Angry alignment
    )
    
    # 10. Get winning primary
    primary = max(modified_primaries, key=modified_primaries.get)
    
    # 11. Select secondary
    secondary = select_secondary_for_primary(
        primary=primary,
        text=text,
        features=features,
        dual_valence=dual_valence,
        control=control,
        polarity=polarity
    )
    
    # 12. Extract tertiary (if enabled and secondary exists)
    tertiary: Optional[str] = None
    tertiary_confidence: Optional[float] = None
    tertiary_explanation: Optional[str] = None
    
    if include_tertiary and secondary:
        # Extract tertiary candidates
        candidates = extract_tertiary_motifs(text, features, clauses)
        
        # Select best within chosen secondary
        best_candidate = select_best_tertiary(
            candidates=candidates,
            primary=primary,
            secondary=secondary,
            threshold=0.6
        )
        
        if best_candidate:
            tertiary = best_candidate.tertiary
            # Convert raw score to confidence [0, 1]
            # Max score ~2.0 (motif + metaphor + appraisal)
            tertiary_confidence = min(1.0, best_candidate.score / 2.0)
            tertiary_explanation = best_candidate.explanation
    
    # 13. Build result
    result = EnrichmentResult(
        # Core emotions
        primary=primary,
        secondary=secondary,
        tertiary=tertiary,
        
        # Valence/Arousal
        emotion_valence=emotion_val,
        event_valence=event_val,
        arousal=arousal,
        
        # Context
        domain=domain_score.primary,
        control=control.level,
        polarity=polarity.polarity,
        
        # Neutral states
        emotion_presence=neutral.emotion_presence if neutral else "explicit",
        event_presence=neutral.event_presence if neutral else "specific",
        is_emotion_neutral=neutral.is_emotion_neutral if neutral else False,
        is_event_neutral=neutral.is_event_neutral if neutral else False,
        
        # Confidence
        tertiary_confidence=tertiary_confidence,
        neutral_confidence_adjustment=neutral.confidence_adjustment if neutral else 0.0,
        
        # Explanations
        tertiary_explanation=tertiary_explanation,
        neutral_explanation=neutral.explanation if neutral else "",
        rule_explanation=rule_ctx.get_explanation(),
        domain_explanation=domain_score.explanation,
        control_explanation=control.explanation,
        polarity_explanation=polarity.explanation,
        
        # Flags
        flags={
            'negation': negation_detected,
            'sarcasm': any(r.rule_name == 'sarcasm_override' and r.triggered 
                          for r in rule_ctx.applications),
            'fatigue': features.fatigue,
            'hedge': features.hedge,
            'physio_distress': features.physio_distress,
            'sarcasm_cue': features.sarcasm_cue
        }
    )
    
    return result


# Convenience function for backward compatibility
def enrich_legacy_format(text: str) -> Dict:
    """
    Legacy format output (without tertiary/neutral)
    
    Returns:
        Dict matching v2.1 format
    """
    result = enrich_v2_2(text, include_tertiary=False, include_neutral=False)
    
    return {
        'primary': result.primary,
        'secondary': result.secondary,
        'emotion_valence': result.emotion_valence,
        'event_valence': result.event_valence,
        'arousal': result.arousal,
        'domain': result.domain,
        'control': result.control,
        'polarity': result.polarity,
        'flags': result.flags,
        'rule_explanation': result.rule_explanation,
        'domain_explanation': result.domain_explanation,
        'control_explanation': result.control_explanation,
        'polarity_explanation': result.polarity_explanation
    }


__all__ = [
    'enrich_v2_2',
    'enrich_legacy_format',
    'EnrichmentResult'
]
