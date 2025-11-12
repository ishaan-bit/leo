"""
Feature Extraction for Emotion Enrichment Pipeline

Motif-based pattern matching using regex for generalization.
Replaces brittle word-list lookups with reusable linguistic patterns.
"""

import re
from typing import Dict, List, Set
from dataclasses import dataclass


@dataclass
class FeatureSet:
    """Container for all extracted features"""
    
    # Core patterns
    fatigue: bool = False
    hedge: bool = False
    praise: bool = False
    neg_metaphor: bool = False
    contrastive: bool = False
    feels_like: bool = False
    
    # Domain signals
    work_tokens: List[str] = None
    money_tokens: List[str] = None
    ritual_tokens: List[str] = None
    
    # Emotion modifiers
    sarcasm_cue: bool = False
    physio_distress: bool = False
    uncertainty: bool = False
    
    # Agency markers
    agency_high: bool = False
    agency_low: bool = False
    
    # Temporal markers
    past_action: bool = False
    failed_attempt: bool = False
    hypothetical: bool = False
    
    # Quantitative
    fatigue_count: int = 0
    hedge_count: int = 0
    praise_count: int = 0
    neg_metaphor_count: int = 0
    
    # Matched tokens (for debugging)
    matched_tokens: Dict[str, List[str]] = None
    
    def __post_init__(self):
        if self.work_tokens is None:
            self.work_tokens = []
        if self.money_tokens is None:
            self.money_tokens = []
        if self.ritual_tokens is None:
            self.ritual_tokens = []
        if self.matched_tokens is None:
            self.matched_tokens = {}


# Regex patterns (compiled for performance)
PATTERNS = {
    'fatigue': re.compile(
        r'\b(tired|exhaust(ed|ion)?|drain(ed)?|burnt?( out)?|fog(gy)?|numb|'
        r'sleep[- ]?deprived|worn out|running on empty|can\'?t keep going)\b',
        re.IGNORECASE
    ),
    
    'hedge': re.compile(
        r'\b(i (guess|suppose|think so)|not sure|maybe|kind of|sort of|'
        r'idk|i don\'?t know|somewhat|fairly|possibly|perhaps|'
        r'i\'?m not certain|not entirely)\b',
        re.IGNORECASE
    ),
    
    'praise': re.compile(
        r'\b(great|amazing|doing (great|well)|proud of you|congrats?|'
        r'congratulations|promotion|promot(ed|ion)|progress|'
        r'well done|good job|excellent|fantastic|awesome|killing it)\b',
        re.IGNORECASE
    ),
    
    'neg_metaphor': re.compile(
        r'\b(drown(ing|ed)?|sink(ing|s)?|empty|motion sickness|hollow|'
        r'heavy|weight on|crushing|suffocating|drowning with|'
        r'hole|void|abyss|dark(ness)?|numb|frozen)\b',
        re.IGNORECASE
    ),
    
    'contrastive': re.compile(
        r'\b(but|yet|however|though|even though|although|still|'
        r'nonetheless|nevertheless|despite|in spite of)\b',
        re.IGNORECASE
    ),
    
    'feels_like': re.compile(
        r'\b(feels? like|it\'?s like|as if|seems? like|reminds me of)\b',
        re.IGNORECASE
    ),
    
    'work_tokens': re.compile(
        r'\b(deploy(ed|ing|ment)?|deadline|meeting|launch(ed|ing)?|'
        r'sprint|manager|client|presentation|project|'
        r'boss|colleague|office|work|job|team|'
        r'shipped|shipping|release|deployed)\b',
        re.IGNORECASE
    ),
    
    'money_tokens': re.compile(
        r'\b(salary|salar(y|ies)|rent|bills?|invoice|debt|savings?|'
        r'budget|cut|pay(check|day)?|finances?|money|'
        r'broke|expensive|cost|afford|price)\b',
        re.IGNORECASE
    ),
    
    'ritual_tokens': re.compile(
        r'\b(gratitude journ(al|aling)|therapy|meditat(e|ion|ing)|'
        r'breath(ing|work)?|gym|run(ning)?|workout|'
        r'yoga|journaling|self[- ]care|mindful(ness)?)\b',
        re.IGNORECASE
    ),
    
    'sarcasm_cue': re.compile(
        r'\b(apparently|fantastic|love that|great|sure|as always|'
        r'amazing|wonderful|perfect|of course|obviously|clearly)\b',
        re.IGNORECASE
    ),
    
    'physio_distress': re.compile(
        r'\b(motion sickness|nausea|headache|migraine|chest tight|'
        r'can\'?t breathe|heart racing|shaking|trembling)\b',
        re.IGNORECASE
    ),
    
    'agency_high': re.compile(
        r'\b(i can|i\'?ll (fix|handle|manage|do)|if i grind|'
        r'i\'?m gonna|i decided|i chose|i will|'
        r'gonna make|i control|up to me)\b',
        re.IGNORECASE
    ),
    
    'agency_low': re.compile(
        r'\b(nothing i (do|can do)|can\'?t change|out of my hands|'
        r'no control|helpless|powerless|stuck|trapped|'
        r'forced to|have to|no choice)\b',
        re.IGNORECASE
    ),
    
    'past_action': re.compile(
        r'\b(tried|did|ended up|went|made|felt|'
        r'happened|occurred|was|were|got)\b',
        re.IGNORECASE
    ),
    
    'failed_attempt': re.compile(
        r'\b(tried (to|but)|meant to (but|never)|'
        r'wanted to but|planned to but|didn\'?t (work|happen|go))\b',
        re.IGNORECASE
    ),
    
    'hypothetical': re.compile(
        r'\b(would|could|might|if (i|it|they)|'
        r'wish(ed)?|hope|maybe|perhaps)\b',
        re.IGNORECASE
    ),
}


def extract_features(text: str) -> FeatureSet:
    """
    Extract all linguistic features from text using pattern matching.
    
    Args:
        text: Input reflection text
        
    Returns:
        FeatureSet with all detected patterns and counts
    """
    features = FeatureSet()
    text_lower = text.lower()
    
    # Boolean features with counts
    fatigue_matches = PATTERNS['fatigue'].findall(text)
    features.fatigue = len(fatigue_matches) > 0
    features.fatigue_count = len(fatigue_matches)
    features.matched_tokens['fatigue'] = [m[0] if isinstance(m, tuple) else m for m in fatigue_matches]
    
    hedge_matches = PATTERNS['hedge'].findall(text)
    features.hedge = len(hedge_matches) > 0
    features.hedge_count = len(hedge_matches)
    features.matched_tokens['hedge'] = [m[0] if isinstance(m, tuple) else m for m in hedge_matches]
    
    praise_matches = PATTERNS['praise'].findall(text)
    features.praise = len(praise_matches) > 0
    features.praise_count = len(praise_matches)
    features.matched_tokens['praise'] = [m[0] if isinstance(m, tuple) else m for m in praise_matches]
    
    neg_metaphor_matches = PATTERNS['neg_metaphor'].findall(text)
    features.neg_metaphor = len(neg_metaphor_matches) > 0
    features.neg_metaphor_count = len(neg_metaphor_matches)
    features.matched_tokens['neg_metaphor'] = [m[0] if isinstance(m, tuple) else m for m in neg_metaphor_matches]
    
    # Structural patterns
    features.contrastive = PATTERNS['contrastive'].search(text) is not None
    features.feels_like = PATTERNS['feels_like'].search(text) is not None
    
    # Domain tokens (store all matches)
    work_matches = PATTERNS['work_tokens'].findall(text)
    features.work_tokens = [m[0] if isinstance(m, tuple) else m for m in work_matches]
    features.matched_tokens['work'] = features.work_tokens
    
    money_matches = PATTERNS['money_tokens'].findall(text)
    features.money_tokens = [m[0] if isinstance(m, tuple) else m for m in money_matches]
    features.matched_tokens['money'] = features.money_tokens
    
    ritual_matches = PATTERNS['ritual_tokens'].findall(text)
    features.ritual_tokens = [m[0] if isinstance(m, tuple) else m for m in ritual_matches]
    features.matched_tokens['ritual'] = features.ritual_tokens
    
    # Emotion modifiers
    features.sarcasm_cue = PATTERNS['sarcasm_cue'].search(text) is not None
    features.physio_distress = PATTERNS['physio_distress'].search(text) is not None
    features.uncertainty = features.hedge  # Alias for clarity
    
    # Agency
    features.agency_high = PATTERNS['agency_high'].search(text) is not None
    features.agency_low = PATTERNS['agency_low'].search(text) is not None
    
    # Temporal
    features.past_action = PATTERNS['past_action'].search(text) is not None
    features.failed_attempt = PATTERNS['failed_attempt'].search(text) is not None
    features.hypothetical = PATTERNS['hypothetical'].search(text) is not None
    
    return features


def has_positive_tokens(text: str) -> bool:
    """Quick check for any positive sentiment words"""
    positive = re.compile(
        r'\b(good|great|happy|joy|love|excited|wonderful|amazing|'
        r'perfect|fantastic|awesome|excellent|success|progress)\b',
        re.IGNORECASE
    )
    return positive.search(text) is not None


def has_negative_tokens(text: str) -> bool:
    """Quick check for any negative sentiment words"""
    negative = re.compile(
        r'\b(bad|sad|upset|angry|hate|terrible|awful|failed?|'
        r'wrong|hurt|pain|difficult|hard|struggle|worry)\b',
        re.IGNORECASE
    )
    return negative.search(text) is not None


def detect_first_person(text: str) -> bool:
    """Detect first-person perspective"""
    first_person = re.compile(r'\b(i|me|my|mine|myself|i\'m|i\'ve|i\'ll)\b', re.IGNORECASE)
    return first_person.search(text) is not None


def detect_plural_third_person(text: str) -> bool:
    """Detect plural third person (everyone, they, people)"""
    plural = re.compile(r'\b(everyone|they|people|others|them|their)\b', re.IGNORECASE)
    return plural.search(text) is not None


# Utility: compute feature density
def compute_feature_density(features: FeatureSet, text: str) -> Dict[str, float]:
    """
    Compute density scores for each feature type.
    Useful for confidence weighting.
    
    Returns:
        Dict mapping feature names to density [0, 1]
    """
    word_count = len(text.split())
    if word_count == 0:
        return {}
    
    return {
        'fatigue_density': min(1.0, features.fatigue_count / max(word_count, 1)),
        'hedge_density': min(1.0, features.hedge_count / max(word_count, 1)),
        'praise_density': min(1.0, features.praise_count / max(word_count, 1)),
        'neg_metaphor_density': min(1.0, features.neg_metaphor_count / max(word_count, 1)),
        'work_density': min(1.0, len(features.work_tokens) / max(word_count, 1)),
        'money_density': min(1.0, len(features.money_tokens) / max(word_count, 1)),
        'ritual_density': min(1.0, len(features.ritual_tokens) / max(word_count, 1)),
    }
