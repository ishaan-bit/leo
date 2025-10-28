"""
Emotion Validator - Strict enforcement of Willcox Emotion Wheel

This module provides validation and normalization utilities for the canonical 
Gloria Willcox Feelings Wheel (6×6×6 hierarchy = 216 emotions).

STRICT ENFORCEMENT RULES:
1. Load WILLCOX_WHEEL exactly as defined in canonical JSON
2. Treat emotion references as case-sensitive lookups
3. validateEmotion() returns true ONLY if all 3 levels match exactly
4. Invalid inputs → normalize to closest valid parent (never create new term)
5. Log every emotion write: { ok, primary, secondary, tertiary }
6. Never invent, interpolate, or rename beyond canonical dataset
7. Updates only via explicit migration scripts
"""

import json
import os
from pathlib import Path
from typing import Dict, Tuple, Optional, List
import logging

logger = logging.getLogger(__name__)

class EmotionValidator:
    """Validates emotions against canonical Willcox Wheel"""
    
    def __init__(self, wheel_path: Optional[str] = None):
        """
        Initialize validator with canonical Willcox Wheel
        
        Args:
            wheel_path: Path to willcox_wheel.json (defaults to src/data/willcox_wheel.json)
        """
        if wheel_path is None:
            # Default to src/data/willcox_wheel.json relative to this file
            current_dir = Path(__file__).parent.parent
            wheel_path = current_dir / "data" / "willcox_wheel.json"
        
        with open(wheel_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.wheel = data['wheel']
            self.metadata = data['metadata']
            self.validation_rules = data['validation_rules']
        
        logger.info(f"Loaded Willcox Wheel v{self.metadata['version']} with {self.metadata['total_emotions']} emotions")
    
    def get_primaries(self) -> List[str]:
        """Get all primary emotion names"""
        return list(self.wheel.keys())
    
    def get_secondaries(self, primary: str) -> List[str]:
        """Get all secondary emotion names for a primary"""
        if primary not in self.wheel:
            return []
        return list(self.wheel[primary].keys())
    
    def get_tertiaries(self, primary: str, secondary: str) -> List[str]:
        """Get all tertiary emotion names for a secondary"""
        if primary not in self.wheel:
            return []
        if secondary not in self.wheel[primary]:
            return []
        return self.wheel[primary][secondary]
    
    def validate_emotion(self, primary: str, secondary: str, tertiary: str) -> bool:
        """
        Validate that emotion triplet exists in canonical wheel
        
        Args:
            primary: Primary emotion (e.g., "Sad")
            secondary: Secondary emotion (e.g., "lonely")
            tertiary: Tertiary emotion (e.g., "isolated")
        
        Returns:
            True if all 3 levels match exactly (case-sensitive), False otherwise
        """
        # Case-sensitive exact match required
        if primary not in self.wheel:
            return False
        
        if secondary not in self.wheel[primary]:
            return False
        
        if tertiary not in self.wheel[primary][secondary]:
            return False
        
        return True
    
    def normalize_emotion(
        self, 
        primary: str, 
        secondary: Optional[str] = None, 
        tertiary: Optional[str] = None
    ) -> Tuple[bool, str, Optional[str], Optional[str]]:
        """
        Normalize invalid emotion to closest valid parent
        
        Args:
            primary: Primary emotion
            secondary: Secondary emotion (optional)
            tertiary: Tertiary emotion (optional)
        
        Returns:
            Tuple of (is_valid, normalized_primary, normalized_secondary, normalized_tertiary)
            - is_valid: True if original was valid, False if normalized
            - normalized_*: Closest valid emotion at each level (None if not provided)
        
        Normalization rules:
        - Invalid tertiary with valid primary+secondary → use secondary, set tertiary=None
        - Invalid secondary with valid primary → use primary, set secondary=None, tertiary=None
        - Invalid primary → use None for all (cannot normalize)
        """
        # Check if fully valid
        if secondary and tertiary:
            if self.validate_emotion(primary, secondary, tertiary):
                return (True, primary, secondary, tertiary)
        
        # Try primary + secondary (without tertiary)
        if primary in self.wheel and secondary:
            if secondary in self.wheel[primary]:
                # Valid primary+secondary, but tertiary was invalid or missing
                logger.warning(f"Normalized tertiary '{tertiary}' to None (invalid for {primary}/{secondary})")
                return (False, primary, secondary, None)
        
        # Try just primary
        if primary in self.wheel:
            # Valid primary, but secondary was invalid
            logger.warning(f"Normalized secondary '{secondary}' and tertiary '{tertiary}' to None (invalid for {primary})")
            return (False, primary, None, None)
        
        # Invalid primary - cannot normalize
        logger.error(f"Cannot normalize invalid primary '{primary}' (not in canonical wheel)")
        return (False, None, None, None)
    
    def log_validation(
        self, 
        primary: str, 
        secondary: Optional[str], 
        tertiary: Optional[str],
        is_valid: bool,
        context: str = ""
    ) -> None:
        """
        Log emotion validation result
        
        Args:
            primary: Primary emotion
            secondary: Secondary emotion
            tertiary: Tertiary emotion
            is_valid: Whether validation passed
            context: Optional context (e.g., reflection_id)
        """
        log_entry = {
            "ok": is_valid,
            "primary": primary,
            "secondary": secondary,
            "tertiary": tertiary
        }
        
        if context:
            log_entry["context"] = context
        
        if is_valid:
            logger.info(f"Emotion validation PASSED: {log_entry}")
        else:
            logger.warning(f"Emotion validation FAILED: {log_entry}")
    
    def get_wheel_hierarchy(self) -> Dict:
        """
        Get complete wheel hierarchy as dict
        
        Returns:
            Full wheel structure { primary: { secondary: [tertiaries] } }
        """
        return self.wheel
    
    def get_flat_emotions(self) -> List[Tuple[str, str, str]]:
        """
        Get flattened list of all valid (primary, secondary, tertiary) triplets
        
        Returns:
            List of 216 emotion triplets
        """
        emotions = []
        for primary, secondaries in self.wheel.items():
            for secondary, tertiaries in secondaries.items():
                for tertiary in tertiaries:
                    emotions.append((primary, secondary, tertiary))
        return emotions


# Singleton instance for easy import
_validator = None

def get_validator() -> EmotionValidator:
    """Get singleton EmotionValidator instance"""
    global _validator
    if _validator is None:
        _validator = EmotionValidator()
    return _validator


# Convenience functions for direct import
def validate_emotion(primary: str, secondary: str, tertiary: str) -> bool:
    """Validate emotion triplet (convenience wrapper)"""
    return get_validator().validate_emotion(primary, secondary, tertiary)


def normalize_emotion(
    primary: str, 
    secondary: Optional[str] = None, 
    tertiary: Optional[str] = None
) -> Tuple[bool, str, Optional[str], Optional[str]]:
    """Normalize emotion (convenience wrapper)"""
    return get_validator().normalize_emotion(primary, secondary, tertiary)


def log_validation(
    primary: str, 
    secondary: Optional[str], 
    tertiary: Optional[str],
    is_valid: bool,
    context: str = ""
) -> None:
    """Log validation result (convenience wrapper)"""
    return get_validator().log_validation(primary, secondary, tertiary, is_valid, context)


if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)
    
    validator = EmotionValidator()
    
    print(f"\n✅ Loaded {validator.metadata['total_emotions']} emotions")
    print(f"Primaries: {validator.get_primaries()}\n")
    
    # Test valid emotion
    valid = validator.validate_emotion("Sad", "lonely", "isolated")
    print(f"✅ Valid: Sad → lonely → isolated = {valid}")
    validator.log_validation("Sad", "lonely", "isolated", valid, "test_case_1")
    
    # Test invalid tertiary
    invalid = validator.validate_emotion("Sad", "lonely", "fake_emotion")
    print(f"❌ Invalid: Sad → lonely → fake_emotion = {invalid}")
    
    # Test normalization
    is_valid, p, s, t = validator.normalize_emotion("Sad", "lonely", "fake_emotion")
    print(f"🔄 Normalized to: {p} → {s} → {t} (is_valid={is_valid})")
    validator.log_validation(p, s, t, is_valid, "test_case_2")
    
    # Test invalid primary
    is_valid, p, s, t = validator.normalize_emotion("FakeEmotion", "something", "else")
    print(f"🔄 Invalid primary normalized to: {p} → {s} → {t} (is_valid={is_valid})\n")
    
    print(f"Total flat emotions: {len(validator.get_flat_emotions())}")
