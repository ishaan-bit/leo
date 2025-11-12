"""
Sarcasm detection module using rule-based heuristics.
Patterns: positive word + negative context, scare quotes, discourse markers.
Enhanced v2.0+: Lexicon-based detection with duration patterns and emoji signals.
"""
import re
import json
from pathlib import Path
from typing import Dict, Tuple, List

# v2.0+: Use lexicon loader for enhanced detection
from enrich.lexicons import (
    get_sarcasm_shells,
    get_all_negative_anchors,
    get_duration_patterns,
    get_emoji_signals,
    get_meeting_lateness_phrases
)

# Load v1.0 anchors (fallback)
RULES_DIR = Path(__file__).parent.parent.parent / 'rules'
with open(RULES_DIR / 'anchors.json', 'r') as f:
    ANCHORS = json.load(f)

SARCASM_POSITIVE_TOKENS = ANCHORS['sarcasm_positive_tokens']
NEGATIVE_EVENT_ANCHORS = ANCHORS['negative_event_anchors']
DISCOURSE_MARKERS = ANCHORS['sarcasm_discourse_markers']

# v2.0+ Enhanced lexicons
SARCASM_SHELLS = get_sarcasm_shells()
EVENT_NEGATIVE_ANCHORS = get_all_negative_anchors()
DURATION_PATTERNS = get_duration_patterns()
EMOJI_SIGNALS = get_emoji_signals()
MEETING_LATENESS = get_meeting_lateness_phrases()


def detect_pattern_a_positive_with_negative_context(text: str) -> bool:
    """
    Pattern A: Positive word + negative event anchor.
    Example: "Great, another deadline" → sarcasm
    
    v2.0+: Enhanced with lexicon-based detection including:
    - Positive shells from sarcasm_positive_shells.json
    - Negative event anchors (lateness, delays, blockers, etc.)
    - Duration patterns (e.g., "45 minutes late")
    - Meeting lateness phrases
    """
    text_lower = text.lower()
    
    # Check for positive shells (v2.0+)
    has_positive_shell = any(
        phrase in text_lower for phrase in SARCASM_SHELLS.get('phrases', [])
    )
    
    # Fallback to v1.0 tokens
    has_positive_token = any(token in text_lower for token in SARCASM_POSITIVE_TOKENS)
    
    has_positive = has_positive_shell or has_positive_token
    
    if not has_positive:
        return False
    
    # Check for negative event anchors (v2.0+ enhanced)
    has_negative_anchor = any(anchor in text_lower for anchor in EVENT_NEGATIVE_ANCHORS)
    
    # Check for duration patterns (v2.0+)
    has_duration = any(pattern.search(text) for pattern in DURATION_PATTERNS)
    
    # Check for meeting lateness (v2.0+)
    has_lateness = any(phrase in text_lower for phrase in MEETING_LATENESS)
    
    # v1.0 fallback
    has_negative_v1 = any(anchor in text_lower for anchor in NEGATIVE_EVENT_ANCHORS)
    
    return has_negative_anchor or has_duration or has_lateness or has_negative_v1


def detect_pattern_b_scare_quotes(text: str) -> bool:
    """
    Pattern B: Quotation marks or emphasis around positive words.
    Example: "great" choice, 'amazing' decision → sarcasm
    
    v2.0+: Enhanced with punctuation cues from lexicons.
    """
    # Check v2.0+ punctuation cues
    punctuation_cues = SARCASM_SHELLS.get('punctuation_cues', [])
    for cue in punctuation_cues:
        if cue in text:
            # Check if near positive words
            text_lower = text.lower()
            has_positive = any(
                phrase in text_lower for phrase in SARCASM_SHELLS.get('phrases', [])
            ) or any(
                token in text_lower for token in SARCASM_POSITIVE_TOKENS
            )
            if has_positive:
                return True
    
    # Look for quoted positive tokens (v1.0)
    for token in SARCASM_POSITIVE_TOKENS:
        # Single quotes
        if f"'{token}'" in text.lower() or f'"{token}"' in text.lower():
            return True
        # Emphasis patterns
        if f"*{token}*" in text.lower() or f"_{token}_" in text.lower():
            return True
    
    return False


def detect_pattern_c_discourse_markers(text: str) -> bool:
    """
    Pattern C: Discourse markers indicating sarcasm.
    Example: "yeah right", "as if", "of course"
    
    v2.0+: Enhanced with sarcasm markers from lexicons.
    """
    text_lower = text.lower()
    
    # v2.0+ sarcasm markers
    for marker in SARCASM_SHELLS.get('markers', []):
        if marker in text_lower:
            return True
    
    # v1.0 discourse markers
    for marker in DISCOURSE_MARKERS:
        if marker in text_lower:
            return True
    
    return False


def detect_pattern_d_sarcastic_emoji(text: str) -> bool:
    """
    Pattern D: Sarcastic emoji signals.
    Example: "Love this 🙃" → sarcasm
    
    v2.0+ NEW: Emoji-based sarcasm detection.
    """
    sarcastic_emoji = EMOJI_SIGNALS.get('sarcastic', [])
    
    for emoji in sarcastic_emoji:
        if emoji in text:
            return True
    
    return False


def detect_sarcasm(text: str) -> Tuple[bool, str]:
    """
    Detect sarcasm using all patterns.
    
    v2.0+: Added Pattern D (emoji detection).
    
    Returns:
        (is_sarcastic, pattern_matched)
    """
    if detect_pattern_a_positive_with_negative_context(text):
        return True, 'pattern_a_positive_negative'
    
    if detect_pattern_b_scare_quotes(text):
        return True, 'pattern_b_scare_quotes'
    
    if detect_pattern_c_discourse_markers(text):
        return True, 'pattern_c_discourse'
    
    if detect_pattern_d_sarcastic_emoji(text):
        return True, 'pattern_d_emoji'
    
    return False, ''


def apply_sarcasm_penalty(
    p_hf: Dict[str, float],
    event_valence: float
) -> Tuple[Dict[str, float], float]:
    """
    Apply sarcasm penalties to emotion probabilities.
    
    v2.0+ Enhancement:
    - Penalize Happy: ×0.7
    - Boost Angry/Strong: ×1.15
    - Reduce event valence by 0.25
    
    Args:
        p_hf: HF model probabilities
        event_valence: Event valence score [0,1]
        
    Returns:
        (modified_probs, modified_event_valence)
    """
    modified_probs = p_hf.copy()
    
    # Penalize Happy
    if 'Happy' in modified_probs:
        modified_probs['Happy'] *= 0.7
    
    # Boost Angry and Strong
    for emotion in ['Angry', 'Strong']:
        if emotion in modified_probs:
            modified_probs[emotion] *= 1.15
    
    # Renormalize
    total = sum(modified_probs.values())
    if total > 0:
        modified_probs = {k: v / total for k, v in modified_probs.items()}
    
    # Reduce event valence
    modified_ev = max(0.0, event_valence - 0.25)
    
    return modified_probs, modified_ev


def apply_sarcasm_heuristics(
    text: str, 
    p_hf: Dict[str, float], 
    event_valence: float
) -> Tuple[Dict[str, float], float, bool]:
    """
    Apply sarcasm detection and modify probabilities.
    
    v2.0+: Uses enhanced lexicon-based detection and apply_sarcasm_penalty().
    
    Args:
        text: Input text
        p_hf: HF model probabilities
        event_valence: Event valence score [0,1]
        
    Returns:
        (modified_probs, modified_event_valence, sarcasm_flag)
    """
    is_sarcastic, pattern = detect_sarcasm(text)
    
    if not is_sarcastic:
        return p_hf.copy(), event_valence, False
    
    # Apply v2.0+ sarcasm penalty
    modified_probs, modified_ev = apply_sarcasm_penalty(p_hf, event_valence)
    
    return modified_probs, modified_ev, True


def extract_sarcasm_cues(text: str) -> Dict:
    """
    Extract sarcasm metadata.
    
    v2.0+: Updated confidence map with Pattern D.
    
    Returns:
        {
            'sarcasm_flag': bool,
            'sarcasm_pattern': str,
            'confidence': float
        }
    """
    is_sarcastic, pattern = detect_sarcasm(text)
    
    # Confidence based on pattern strength
    confidence_map = {
        'pattern_a_positive_negative': 0.7,
        'pattern_b_scare_quotes': 0.8,
        'pattern_c_discourse': 0.75,
        'pattern_d_emoji': 0.8,
        '': 0.0
    }
    
    return {
        'sarcasm_flag': is_sarcastic,
        'sarcasm_pattern': pattern,
        'confidence': confidence_map.get(pattern, 0.0)
    }
