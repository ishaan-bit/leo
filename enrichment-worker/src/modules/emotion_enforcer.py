"""
Emotion Enforcer - Strict 6×6×6 Willcox Wheel Validation

Ensures all emotion classifications conform to EES-1 schema.
Snaps invalid outputs to nearest valid state using semantic similarity.
"""

import logging
from typing import Dict, Tuple, Optional
from src.utils.emotion_schema import (
    CORES, NUANCES, MICROS,
    validate_emotion_state,
    normalize_to_valid_state,
    get_full_path_from_micro,
    is_valid_micro
)

logger = logging.getLogger(__name__)


class EmotionEnforcer:
    """
    Validates and normalizes emotion outputs to EES-1 schema.
    
    Usage:
        enforcer = EmotionEnforcer()
        valid_triple = enforcer.enforce(core, nuance, micro)
        result = enforcer.enforce_hybrid_output(hybrid_scorer_result)
    """
    
    def __init__(self):
        """Initialize emotion enforcer with EES-1 schema."""
        self.total_validations = 0
        self.total_corrections = 0
        logger.info("EmotionEnforcer initialized with 6×6×6 Willcox schema (216 states)")
    
    def enforce(
        self,
        core: str,
        nuance: str,
        micro: str,
        confidence: float = 1.0
    ) -> Dict:
        """
        Enforce emotion triple to valid EES-1 state.
        
        Args:
            core: Candidate core emotion
            nuance: Candidate nuance
            micro: Candidate micro-nuance
            confidence: Original confidence score
        
        Returns:
            {
                'core': str,
                'nuance': str, 
                'micro': str,
                'confidence': float,
                'was_corrected': bool,
                'original': {'core': str, 'nuance': str, 'micro': str} | None
            }
        """
        self.total_validations += 1
        
        # Validate against schema
        is_valid, error = validate_emotion_state(core, nuance, micro)
        
        if is_valid:
            return {
                'core': core,
                'nuance': nuance,
                'micro': micro,
                'confidence': confidence,
                'was_corrected': False,
                'original': None
            }
        
        # Normalize to nearest valid state
        logger.warning(
            f"Invalid emotion triple detected: ({core}, {nuance}, {micro}). "
            f"Error: {error}. Snapping to nearest valid state..."
        )
        
        valid_core, valid_nuance, valid_micro = normalize_to_valid_state(
            core, nuance, micro
        )
        
        self.total_corrections += 1
        
        logger.info(
            f"Corrected: ({core}, {nuance}, {micro}) → "
            f"({valid_core}, {valid_nuance}, {valid_micro})"
        )
        
        return {
            'core': valid_core,
            'nuance': valid_nuance,
            'micro': valid_micro,
            'confidence': confidence * 0.9,  # Penalize corrected outputs
            'was_corrected': True,
            'original': {
                'core': core,
                'nuance': nuance,
                'micro': micro
            }
        }
    
    def enforce_hybrid_output(self, hybrid_result: Dict) -> Dict:
        """
        Enforce HybridScorer output to EES-1 schema.
        
        Expected input format:
        {
            'primary': str,
            'secondary': str,
            'tertiary': str,
            'confidence_scores': {...}
        }
        
        Returns:
            {
                'primary': {'core': str, 'nuance': str, 'micro': str, 'confidence': float},
                'secondary': {...},
                'tertiary': {...},
                'all_corrected': bool,
                'correction_count': int
            }
        """
        primary = hybrid_result.get('primary', '').strip()
        secondary = hybrid_result.get('secondary', '').strip()
        tertiary = hybrid_result.get('tertiary', '').strip()
        
        confidence_scores = hybrid_result.get('confidence_scores', {})
        
        # Enforce each emotion
        enforced_primary = self._enforce_single_emotion(
            primary, 
            confidence_scores.get('primary', 1.0)
        )
        
        enforced_secondary = self._enforce_single_emotion(
            secondary,
            confidence_scores.get('secondary', 0.8)
        )
        
        enforced_tertiary = self._enforce_single_emotion(
            tertiary,
            confidence_scores.get('tertiary', 0.6)
        )
        
        correction_count = sum([
            enforced_primary['was_corrected'],
            enforced_secondary['was_corrected'],
            enforced_tertiary['was_corrected']
        ])
        
        return {
            'primary': enforced_primary,
            'secondary': enforced_secondary,
            'tertiary': enforced_tertiary,
            'all_corrected': correction_count == 3,
            'correction_count': correction_count,
            'schema_version': 'EES-1'
        }
    
    def _enforce_single_emotion(
        self,
        emotion_label: str,
        confidence: float
    ) -> Dict:
        """
        Enforce single emotion string to valid triple.
        
        Strategy:
        1. Try to interpret as micro-nuance (most specific)
        2. If valid, derive full path
        3. If invalid, parse and normalize
        """
        if not emotion_label:
            # Default to neutral state
            return self.enforce('Peaceful', 'Content', 'Calm', confidence)
        
        # Try as micro-nuance first
        full_path = get_full_path_from_micro(emotion_label)
        if full_path:
            core, nuance, micro = full_path
            return self.enforce(core, nuance, micro, confidence)
        
        # Try to parse from string (e.g., "Happy/Excited/Energetic")
        parts = [p.strip() for p in emotion_label.split('/')]
        
        if len(parts) == 3:
            return self.enforce(parts[0], parts[1], parts[2], confidence)
        elif len(parts) == 2:
            # Assume nuance/micro, derive core
            nuance, micro = parts
            core = self._infer_core_from_nuance(nuance)
            return self.enforce(core, nuance, micro, confidence)
        else:
            # Single word - try to match to schema
            return self._match_single_word(emotion_label, confidence)
    
    def _infer_core_from_nuance(self, nuance: str) -> str:
        """Infer core emotion from nuance."""
        for core, nuances in NUANCES.items():
            if nuance in nuances:
                return core
        # Fallback
        return 'Peaceful'
    
    def _match_single_word(self, word: str, confidence: float) -> Dict:
        """
        Match single emotion word to EES-1 schema.
        Priority: micro > nuance > core
        """
        # Normalize word to title case for matching
        word_title = word.title()
        
        # Try micro match
        if is_valid_micro(word_title):
            full_path = get_full_path_from_micro(word_title)
            if full_path:
                return self.enforce(full_path[0], full_path[1], full_path[2], confidence)
        
        # Try nuance match
        for core, nuances in NUANCES.items():
            if word_title in nuances:
                # Use first micro of this nuance
                first_micro = MICROS[word_title][0]
                return self.enforce(core, word_title, first_micro, confidence)
        
        # Try core match
        if word_title in CORES:
            # Use first nuance and micro
            first_nuance = NUANCES[word_title][0]
            first_micro = MICROS[first_nuance][0]
            return self.enforce(word_title, first_nuance, first_micro, confidence)
        
        # No match - use semantic fallback via normalize_to_valid_state
        logger.warning(f"Could not match '{word}' to schema. Using semantic normalization.")
        # normalize_to_valid_state will find the nearest valid emotion semantically
        valid_core, valid_nuance, valid_micro = normalize_to_valid_state(word, word, word)
        return self.enforce(valid_core, valid_nuance, valid_micro, confidence * 0.8)
    
    def get_stats(self) -> Dict:
        """Get enforcement statistics."""
        correction_rate = (
            (self.total_corrections / self.total_validations * 100)
            if self.total_validations > 0
            else 0.0
        )
        
        return {
            'total_validations': self.total_validations,
            'total_corrections': self.total_corrections,
            'correction_rate_percent': correction_rate,
            'schema_compliance_percent': 100 - correction_rate
        }
    
    def format_for_output(self, enforced_result: Dict) -> Dict:
        """
        Format enforced result for enrichment output.
        
        Converts:
        {
            'primary': {'core': 'Happy', 'nuance': 'Excited', 'micro': 'Energetic', ...},
            ...
        }
        
        To:
        {
            'primary': 'Energetic',
            'secondary': 'Calm',
            'tertiary': 'Hopeful',
            'primary_full': 'Happy/Excited/Energetic',
            'emotion_cube': [...],
            'schema_version': 'EES-1'
        }
        """
        primary = enforced_result['primary']
        secondary = enforced_result['secondary']
        tertiary = enforced_result['tertiary']
        
        return {
            # Micro-nuances (most specific)
            'primary': primary['micro'],
            'secondary': secondary['micro'],
            'tertiary': tertiary['micro'],
            
            # Full paths for debugging/analytics
            'primary_full': f"{primary['core']}/{primary['nuance']}/{primary['micro']}",
            'secondary_full': f"{secondary['core']}/{secondary['nuance']}/{secondary['micro']}",
            'tertiary_full': f"{tertiary['core']}/{tertiary['nuance']}/{tertiary['micro']}",
            
            # Emotion cube coordinates
            'emotion_cube': [
                {
                    'rank': 'primary',
                    'core': primary['core'],
                    'nuance': primary['nuance'],
                    'micro': primary['micro'],
                    'confidence': primary['confidence']
                },
                {
                    'rank': 'secondary',
                    'core': secondary['core'],
                    'nuance': secondary['nuance'],
                    'micro': secondary['micro'],
                    'confidence': secondary['confidence']
                },
                {
                    'rank': 'tertiary',
                    'core': tertiary['core'],
                    'nuance': tertiary['nuance'],
                    'micro': tertiary['micro'],
                    'confidence': tertiary['confidence']
                }
            ],
            
            # Metadata
            'schema_version': 'EES-1',
            'was_corrected': enforced_result['correction_count'] > 0,
            'correction_count': enforced_result['correction_count']
        }


# Singleton instance
_enforcer_instance = None

def get_emotion_enforcer() -> EmotionEnforcer:
    """Get singleton EmotionEnforcer instance."""
    global _enforcer_instance
    if _enforcer_instance is None:
        _enforcer_instance = EmotionEnforcer()
    return _enforcer_instance
