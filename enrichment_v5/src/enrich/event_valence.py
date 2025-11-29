"""
Event valence calculation module.
Computes event positivity/negativity separate from emotional response.
Uses weighted anchors and token-based negation scope.

v2.0+: Enhanced with lexicon-based anchors from event_positive_anchors.json 
and event_negative_anchors.json with category-based weights.
"""
import json
from pathlib import Path
from typing import Dict, Tuple, List
import re
from enrich.negation import tokenize, get_negation_scope
from enrich.lexicons import (
    get_event_positive_anchors,
    get_event_negative_anchors,
    get_effort_words
)

# Load event anchors
RULES_DIR = Path(__file__).parent.parent.parent / 'rules'
with open(RULES_DIR / 'anchors.json', 'r') as f:
    ANCHORS = json.load(f)

# v2.0+ Load lexicon-based anchors
EVENT_POSITIVE_LEXICON = get_event_positive_anchors()
EVENT_NEGATIVE_LEXICON = get_event_negative_anchors()
EFFORT_WORDS_LEXICON = get_effort_words()

# Build weighted anchors from lexicons with category-based weights
POSITIVE_ANCHORS = {}
CATEGORY_WEIGHTS_POSITIVE = {
    'career': 1.0,      # Promotions, raises, hiring
    'delivery': 0.9,    # Shipped, launched, completed
    'relationship': 0.85, # Shared, opened up, confessed
    'health': 0.95,     # Healed, recovered, negative test
    'education': 0.9    # Graduated, passed, accepted
}

for category, anchors in EVENT_POSITIVE_LEXICON.items():
    weight = CATEGORY_WEIGHTS_POSITIVE.get(category, 0.8)
    for anchor in anchors:
        if anchor not in POSITIVE_ANCHORS:  # Avoid duplicates
            POSITIVE_ANCHORS[anchor] = weight

# v1.0 Hardcoded anchors (keep as fallback)
POSITIVE_ANCHORS_V1 = {
    'success': 1.0,
    'progress': 0.8,
    'win': 1.0,
    'won': 1.0,
    'completed': 1.0,
    'recovered': 1.0,
    'promoted': 1.0,
    'hired': 1.0,
    'passed': 1.0,
    'achieved': 1.0,
    'bonus': 0.9,
    'appreciation': 0.7,
    'resolved': 0.8,
    'graduated': 1.0,
}

# Merge v1.0 anchors (v1.0 takes precedence if conflict)
for anchor, weight in POSITIVE_ANCHORS_V1.items():
    POSITIVE_ANCHORS[anchor] = weight

# Build negative anchors from lexicons
NEGATIVE_ANCHORS = {}
CATEGORY_WEIGHTS_NEGATIVE = {
    'lateness': 0.4,      # Mild negative (late, running late)
    'delay': 0.6,         # Medium negative (delayed, postponed)
    'cancellation': 0.7,  # Medium-high negative
    'blockers': 0.8,      # High negative (stuck, stalled)
    'outages': 0.7,       # Technical issues
    'neg_outcomes': 1.0,  # Failed, rejected, fired
    'workload': 0.5,      # Overloaded, swamped
    'commute': 0.5,       # Traffic, long commute
    'penalties': 0.9,     # Fine, penalty, citation
    'hr_events': 1.0      # Fired, laid off, demoted
}

for category, anchors in EVENT_NEGATIVE_LEXICON.items():
    weight = CATEGORY_WEIGHTS_NEGATIVE.get(category, 0.7)
    for anchor in anchors:
        if anchor not in NEGATIVE_ANCHORS:
            NEGATIVE_ANCHORS[anchor] = weight

# v1.0 Hardcoded negative anchors (merge)
NEGATIVE_ANCHORS_V1 = {
    'failed': 1.0,
    'failure': 1.0,
    'rejected': 1.0,
    'cancelled': 0.8,
    'delay': 0.6,
    'delayed': 0.6,
    'missed': 0.9,
    'fired': 1.0,
    'debt': 0.8,
    'injury': 0.9,
    'traffic': 0.5,
    'breakup': 0.9,
    'argument': 0.7,
    'hospital': 0.8,
}

for anchor, weight in NEGATIVE_ANCHORS_V1.items():
    NEGATIVE_ANCHORS[anchor] = weight

# Effort words to exclude (they indicate process, not outcome)
# Merge v1.0 and v2.0+ lexicon
EFFORT_WORDS = {'working', 'trying', 'pushing', 'attempting', 'striving', 'been'}
EFFORT_WORDS.update(EFFORT_WORDS_LEXICON)

# Negation tokens (imported from negation module, but define for backward compat)
NEGATION_TOKENS = ["not", "n't", "no", "never", "none", "neither", "nor", "nothing", "nowhere", "nobody", "without", "hardly", "barely"]


def detect_event_anchors(text: str) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    Detect positive and negative event anchors in text with weights.
    EXCLUDES negation words from being counted as anchors (they affect scope, not events).
    
    Returns:
        (positive_matches_dict, negative_matches_dict)
    """
    text_lower = text.lower()
    tokens = [t[0] for t in tokenize(text)]
    
    positive_matches = {}
    negative_matches = {}
    
    # Filter out effort words AND negation words
    for anchor, weight in POSITIVE_ANCHORS.items():
        if anchor in text_lower and anchor not in EFFORT_WORDS and anchor not in NEGATION_TOKENS:
            positive_matches[anchor] = weight
            
    for anchor, weight in NEGATIVE_ANCHORS.items():
        # CRITICAL: Skip negation words (they set scope, not events)
        if anchor in NEGATION_TOKENS:
            continue
        if anchor in text_lower and anchor not in EFFORT_WORDS:
            negative_matches[anchor] = weight
    
    return positive_matches, negative_matches


def compute_event_valence(text: str, negation_cues: Dict = None) -> float:
    """
    Compute event valence from weighted anchors with negation-aware scoring.
    
    Args:
        text: Input text
        negation_cues: Optional negation metadata from negation module
        
    Returns:
        Event valence in [0, 1]
    """
    tokens = tokenize(text)
    negation_scope = get_negation_scope(tokens)
    token_list = [t[0] for t in tokens]
    
    positive_matches, negative_matches = detect_event_anchors(text)
    
    # Apply negation-aware weighted scoring
    positive_sum = 0.0
    negative_sum = 0.0
    
    for anchor, weight in positive_matches.items():
        # Find anchor token position
        anchor_negated = False
        for idx, token in enumerate(token_list):
            if anchor in token:
                if negation_scope.get(idx, False):
                    anchor_negated = True
                break
        
        if anchor_negated:
            # Negated positive → treat as negative
            negative_sum += weight
        else:
            positive_sum += weight
    
    for anchor, weight in negative_matches.items():
        # Find anchor token position
        anchor_negated = False
        for idx, token in enumerate(token_list):
            if anchor in token:
                if negation_scope.get(idx, False):
                    anchor_negated = True
                break
        
        if anchor_negated:
            # Negated negative → treat as positive
            positive_sum += weight
        else:
            negative_sum += weight
    
    # Compute raw valence
    epsilon = 0.01  # Prevent division by zero
    if positive_sum == 0 and negative_sum == 0:
        # No anchors found: neutral
        raw_valence = 0.0
    else:
        # Normalize to [-1, 1]
        raw_valence = (positive_sum - negative_sum) / (positive_sum + negative_sum + epsilon)
    
    # Rescale to [0, 1]
    event_valence = (raw_valence + 1.0) / 2.0
    
    return max(0.0, min(1.0, event_valence))


def extract_event_valence_metadata(text: str) -> Dict:
    """
    Extract detailed event valence metadata.
    
    Returns:
        {
            'event_valence': float,
            'positive_anchors': List[str],
            'negative_anchors': List[str],
            'negated_positive': List[str],
            'negated_negative': List[str],
            'confidence': float
        }
    """
    tokens = tokenize(text)
    negation_scope = get_negation_scope(tokens)
    token_list = [t[0] for t in tokens]
    
    positive_matches, negative_matches = detect_event_anchors(text)
    
    # Determine which anchors are negated using token-based scope
    negated_positive = []
    negated_negative = []
    
    for anchor in positive_matches:
        for idx, token in enumerate(token_list):
            if anchor in token and negation_scope.get(idx, False):
                negated_positive.append(anchor)
                break
    
    for anchor in negative_matches:
        for idx, token in enumerate(token_list):
            if anchor in token and negation_scope.get(idx, False):
                negated_negative.append(anchor)
                break
    
    event_valence = compute_event_valence(text)
    
    # Confidence based on anchor count
    total_anchors = len(positive_matches) + len(negative_matches)
    if total_anchors == 0:
        confidence = 0.3  # Low confidence (neutral default)
    elif total_anchors == 1:
        confidence = 0.6  # Medium confidence
    else:
        confidence = min(0.9, 0.6 + (total_anchors - 1) * 0.1)  # High confidence
    
    return {
        'event_valence': event_valence,
        'positive_anchors': [a for a in positive_matches if a not in negated_positive],
        'negative_anchors': [a for a in negative_matches if a not in negated_negative],
        'negated_positive': negated_positive,
        'negated_negative': negated_negative,
        'confidence': confidence
    }
