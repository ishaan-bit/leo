"""
Lexicon loader for enrichment pipeline v2.0+.
Centralized loading of all rule-based lexicons from JSON config files.
"""
import json
from pathlib import Path
from typing import Dict, List, Any
import re

# Lexicon directory
LEXICON_DIR = Path(__file__).parent.parent.parent / 'config' / 'lexicons'


class LexiconLoader:
    """Singleton loader for all lexicons"""
    
    _instance = None
    _lexicons = {}
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_all()
        return cls._instance
    
    def _load_all(self):
        """Load all lexicon files on initialization"""
        self._lexicons = {
            'sarcasm_positive_shells': self._load('sarcasm_positive_shells.json'),
            'event_negative_anchors': self._load('event_negative_anchors.json'),
            'event_positive_anchors': self._load('event_positive_anchors.json'),
            'agency_verbs': self._load('agency_verbs.json'),
            'effort_words': self._load('effort_words.json'),
            'external_blockers': self._load('external_blockers.json'),
            'hedges_and_downtoners': self._load('hedges_and_downtoners.json'),
            'intensifiers': self._load('intensifiers.json'),
            'negations': self._load('negations.json'),
            'emotion_term_sets': self._load('emotion_term_sets.json'),
            'concession_markers': self._load('concession_markers.json'),
            'temporal_hedges': self._load('temporal_hedges.json'),
            'domain_keywords': self._load('domain_keywords.json'),
            'profanity': self._load('profanity.json'),
            'emoji_signals': self._load('emoji_signals.json'),
            'duration_patterns': self._load('duration_patterns.json'),
            'meeting_lateness_phrases': self._load('meeting_lateness_phrases.json')
        }
        
        # Compile regex patterns
        self._compiled_regexes = {
            'duration': [re.compile(pattern, re.IGNORECASE) 
                        for pattern in self._lexicons['duration_patterns']['regexes']]
        }
    
    def _load(self, filename: str) -> Dict:
        """Load a single lexicon file"""
        filepath = LEXICON_DIR / filename
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def get(self, name: str) -> Dict:
        """Get a lexicon by name"""
        return self._lexicons.get(name, {})
    
    def get_regex(self, name: str) -> List[re.Pattern]:
        """Get compiled regex patterns"""
        return self._compiled_regexes.get(name, [])
    
    def flatten_categories(self, lexicon_name: str) -> List[str]:
        """
        Flatten categorized lexicons into a single list.
        Example: event_negative_anchors has {lateness: [...], delay: [...]}
        Returns: combined list of all values
        """
        lexicon = self.get(lexicon_name)
        if not lexicon:
            return []
        
        # Check if it's categorized (dict of lists) or flat (list/dict)
        if isinstance(lexicon, dict):
            # Check first value
            first_val = next(iter(lexicon.values()), None)
            if isinstance(first_val, list):
                # Categorized: flatten all category lists
                result = []
                for category_items in lexicon.values():
                    result.extend(category_items)
                return result
            else:
                # Flat dict: return keys or values depending on structure
                if 'phrases' in lexicon or 'words' in lexicon or 'markers' in lexicon:
                    # Single key with list of items
                    return next(iter(lexicon.values()))
                return list(lexicon.keys())
        
        return lexicon if isinstance(lexicon, list) else []


# Global instance
LEXICONS = LexiconLoader()


# Convenience functions
def get_sarcasm_shells() -> Dict:
    """Get sarcasm positive shell phrases and markers"""
    return LEXICONS.get('sarcasm_positive_shells')


def get_event_negative_anchors() -> Dict[str, List[str]]:
    """Get categorized negative event anchors"""
    return LEXICONS.get('event_negative_anchors')


def get_event_positive_anchors() -> Dict[str, List[str]]:
    """Get categorized positive event anchors"""
    return LEXICONS.get('event_positive_anchors')


def get_all_negative_anchors() -> List[str]:
    """Get flattened list of all negative event anchors"""
    return LEXICONS.flatten_categories('event_negative_anchors')


def get_all_positive_anchors() -> List[str]:
    """Get flattened list of all positive event anchors"""
    return LEXICONS.flatten_categories('event_positive_anchors')


def get_agency_verbs() -> List[str]:
    """Get agency/control verbs"""
    lex = LEXICONS.get('agency_verbs')
    return lex.get('verbs', [])


def get_effort_words() -> List[str]:
    """Get effort words (excluded from event valence)"""
    lex = LEXICONS.get('effort_words')
    return lex.get('words', [])


def get_external_blockers() -> List[str]:
    """Get external blocker phrases"""
    lex = LEXICONS.get('external_blockers')
    return lex.get('phrases', [])


def get_hedges() -> List[str]:
    """Get hedges and downtoners"""
    lex = LEXICONS.get('hedges_and_downtoners')
    return lex.get('hedges', [])


def get_intensifiers() -> List[str]:
    """Get intensifier words"""
    lex = LEXICONS.get('intensifiers')
    return lex.get('intensifiers', [])


def get_negations() -> Dict:
    """Get negation configuration"""
    return LEXICONS.get('negations')


def get_emotion_terms(emotion: str) -> List[str]:
    """
    Get emotion-specific terms.
    emotion: 'joy', 'fear', 'anger', 'sad', 'peace'
    """
    lex = LEXICONS.get('emotion_term_sets')
    return lex.get(f'{emotion}_terms', [])


def get_concession_markers() -> List[str]:
    """Get concession markers (but, though, yet, however)"""
    lex = LEXICONS.get('concession_markers')
    return lex.get('markers', [])


def get_temporal_hedges() -> List[str]:
    """Get temporal hedges (yet, for now, so far)"""
    lex = LEXICONS.get('temporal_hedges')
    return lex.get('markers', [])


def get_domain_keywords(domain: str = None) -> Dict[str, List[str]]:
    """
    Get domain keywords.
    If domain specified, returns list for that domain.
    Otherwise returns full dict.
    """
    lex = LEXICONS.get('domain_keywords')
    if domain:
        return lex.get(domain, [])
    return lex


def get_profanity_lexicon() -> Dict:
    """Get profanity configuration"""
    return LEXICONS.get('profanity')


def get_emoji_signals() -> Dict[str, List[str]]:
    """Get emoji signal categories"""
    return LEXICONS.get('emoji_signals')


def get_duration_patterns() -> List[re.Pattern]:
    """Get compiled duration regex patterns"""
    return LEXICONS.get_regex('duration')


def get_meeting_lateness_phrases() -> List[str]:
    """Get meeting lateness phrases"""
    lex = LEXICONS.get('meeting_lateness_phrases')
    return lex.get('phrases', [])


__all__ = [
    'LEXICONS',
    'get_sarcasm_shells',
    'get_event_negative_anchors',
    'get_event_positive_anchors',
    'get_all_negative_anchors',
    'get_all_positive_anchors',
    'get_agency_verbs',
    'get_effort_words',
    'get_external_blockers',
    'get_hedges',
    'get_intensifiers',
    'get_negations',
    'get_emotion_terms',
    'get_concession_markers',
    'get_temporal_hedges',
    'get_domain_keywords',
    'get_profanity_lexicon',
    'get_emoji_signals',
    'get_duration_patterns',
    'get_meeting_lateness_phrases'
]
