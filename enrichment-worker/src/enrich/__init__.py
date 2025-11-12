"""
Enrichment pipeline modules for emotion detection and scoring.
"""
from .pipeline import enrich, enrich_from_scratch
from .negation import apply_negation_flip, extract_negation_cues
from .sarcasm import detect_sarcasm, apply_sarcasm_heuristics
from .profanity import detect_profanity, apply_profanity_sentiment
from .event_valence import compute_event_valence, extract_event_valence_metadata
from .control import detect_control_rule_based, extract_control_metadata
from .polarity import detect_polarity_rule_based, extract_polarity_metadata
from .domain import detect_domains_rule_based, extract_domain_metadata
from .va import compute_valence_arousal
from .rerank import rerank_emotions, compute_rerank_score
from .confidence import compute_overall_confidence, get_confidence_category

__all__ = [
    # Main pipeline
    'enrich',
    'enrich_from_scratch',
    
    # Component functions
    'apply_negation_flip',
    'detect_sarcasm',
    'detect_profanity',
    'compute_event_valence',
    'detect_control_rule_based',
    'detect_polarity_rule_based',
    'detect_domains_rule_based',
    'compute_valence_arousal',
    'rerank_emotions',
    'compute_overall_confidence',
]
