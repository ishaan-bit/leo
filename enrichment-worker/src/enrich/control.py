"""
Control detection fallback module.
Rule-based control level detection with confidence scoring.

v2.0+: Enhanced with lexicon-based agency verbs and external blockers.
"""
import json
from pathlib import Path
from typing import Dict, Tuple
import re
from enrich.lexicons import get_agency_verbs, get_external_blockers

# Load control cues
RULES_DIR = Path(__file__).parent.parent.parent / 'rules'
with open(RULES_DIR / 'control_cues.json', 'r') as f:
    CONTROL_CUES = json.load(f)

LOW_CONTROL = CONTROL_CUES['low_control_cues']
HIGH_CONTROL = CONTROL_CUES['high_control_cues']
MEDIUM_CONTROL = CONTROL_CUES['medium_control_cues']

# v2.0+ Enhanced lexicons
AGENCY_VERBS_LEXICON = get_agency_verbs()
EXTERNAL_BLOCKERS_LEXICON = get_external_blockers()


def detect_passive_voice(text: str) -> bool:
    """
    Simple passive voice detection using patterns.
    """
    text_lower = text.lower()
    
    # Common passive patterns
    passive_patterns = [
        r'\bwas\s+\w+ed\b',  # "was told", "was forced"
        r'\bgot\s+\w+ed\b',  # "got fired", "got rejected"
        r'\bbeen\s+\w+ed\b', # "been denied"
        r'\bwere\s+\w+ed\b'  # "were made to"
    ]
    
    for pattern in passive_patterns:
        if re.search(pattern, text_lower):
            return True
    
    # Check explicit passive voice cues
    for cue in LOW_CONTROL['passive_voice']:
        if cue in text_lower:
            return True
    
    return False


def score_control_cues(text: str) -> Tuple[float, float, float]:
    """
    Score text for low/medium/high control cues.
    
    Returns:
        (low_score, medium_score, high_score)
    """
    text_lower = text.lower()
    
    low_score = 0.0
    medium_score = 0.0
    high_score = 0.0
    
    # Check passive voice (strong low control signal)
    if detect_passive_voice(text):
        low_score += 2.0
    
    # Low control cues
    for cue in LOW_CONTROL['helpless_markers']:
        if cue in text_lower:
            low_score += 1.0
    
    for cue in LOW_CONTROL['external_causatives']:
        if cue in text_lower:
            low_score += 1.5
    
    # High control cues
    for cue in HIGH_CONTROL['volition_verbs']:
        if cue in text_lower:
            high_score += 2.0
    
    for cue in HIGH_CONTROL['success_markers']:
        if cue in text_lower:
            high_score += 1.5
    
    for cue in HIGH_CONTROL['agency_markers']:
        if cue in text_lower:
            high_score += 1.8
    
    # Medium control cues
    for cue in MEDIUM_CONTROL['ongoing_effort']:
        if cue in text_lower:
            medium_score += 1.0
    
    for cue in MEDIUM_CONTROL['mixed_signals']:
        if cue in text_lower:
            medium_score += 1.2
    
    return low_score, medium_score, high_score


def detect_control_rule_based(text: str) -> Tuple[str, float]:
    """
    Detect control level using rule-based scoring.
    
    v2.0+: Enhanced with agency verbs vs external blockers balance.
    
    Returns:
        (control_level, confidence)
        control_level ∈ {low, medium, high}
        confidence ∈ [0, 1]
    """
    low_score, medium_score, high_score = score_control_cues(text)
    
    # v2.0+ Enhancement: Count agency verbs and external blockers
    text_lower = text.lower()
    
    agency_count = sum(1 for verb in AGENCY_VERBS_LEXICON if verb in text_lower)
    blocker_count = sum(1 for phrase in EXTERNAL_BLOCKERS_LEXICON if phrase in text_lower)
    
    # Apply agency/blocker modifiers
    if agency_count >= 2 and blocker_count == 0:
        # Strong agency → boost high control
        high_score += 2.0
    elif blocker_count >= 2:
        # Multiple blockers → boost low control
        low_score += 2.0
    elif agency_count > blocker_count:
        # Agency dominates → boost high control
        high_score += 1.0
    elif blocker_count > agency_count:
        # Blockers dominate → boost low control
        low_score += 1.0
    
    # Determine control level
    scores = {
        'low': low_score,
        'medium': medium_score,
        'high': high_score
    }
    
    # If no cues found, default to medium with low confidence
    if all(score == 0.0 for score in scores.values()):
        return 'medium', 0.3
    
    # Get highest scoring control level
    control_level = max(scores, key=scores.get)
    max_score = scores[control_level]
    
    # Calculate confidence based on score separation
    other_scores = [v for k, v in scores.items() if k != control_level]
    max_other = max(other_scores) if other_scores else 0.0
    
    if max_score == 0:
        confidence = 0.3
    elif max_other == 0:
        # Clear winner, no competing signals
        confidence = min(0.9, 0.6 + max_score * 0.1)
    else:
        # Score separation determines confidence
        separation = (max_score - max_other) / max_score
        confidence = max(0.4, min(0.85, separation))
    
    return control_level, confidence


def extract_control_metadata(text: str) -> Dict:
    """
    Extract detailed control detection metadata.
    
    Returns:
        {
            'control': str,
            'confidence': float,
            'low_score': float,
            'medium_score': float,
            'high_score': float,
            'passive_voice_detected': bool,
            'matched_cues': List[str]
        }
    """
    control, confidence = detect_control_rule_based(text)
    low_score, medium_score, high_score = score_control_cues(text)
    passive_voice = detect_passive_voice(text)
    
    # Collect matched cues
    text_lower = text.lower()
    matched_cues = []
    
    for category in [LOW_CONTROL, HIGH_CONTROL, MEDIUM_CONTROL]:
        for cue_list in category.values():
            for cue in cue_list:
                if cue in text_lower:
                    matched_cues.append(cue)
    
    return {
        'control': control,
        'confidence': confidence,
        'low_score': low_score,
        'medium_score': medium_score,
        'high_score': high_score,
        'passive_voice_detected': passive_voice,
        'matched_cues': matched_cues
    }
