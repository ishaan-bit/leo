"""
Emotion wheel hierarchy loader.
Loads primary-secondary-micro mappings from wheel.txt.
"""
import json
from pathlib import Path
from typing import Dict, List

# Load wheel.txt
WHEEL_PATH = Path(__file__).parent.parent.parent / 'wheel.txt'

def load_wheel_hierarchy() -> Dict[str, List[str]]:
    """
    Load primary → [secondaries] mapping from wheel.txt.
    
    Returns:
        Dict mapping primary names to lists of valid secondary names.
        Example: {'Happy': ['Excited', 'Interested', ...], ...}
    """
    with open(WHEEL_PATH, 'r', encoding='utf-8') as f:
        wheel = json.load(f)
    
    hierarchy = {}
    for core in wheel['cores']:
        primary_name = core['name']
        secondaries = [nuance['name'] for nuance in core['nuances']]
        hierarchy[primary_name] = secondaries
    
    return hierarchy


def load_full_wheel() -> Dict:
    """
    Load complete wheel structure with micro-emotions.
    
    Returns:
        Full wheel dictionary with cores, nuances, and micro emotions.
    """
    with open(WHEEL_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def validate_primary_secondary(primary: str, secondary: str, hierarchy: Dict[str, List[str]] = None) -> bool:
    """
    Validate that a secondary belongs to the given primary.
    
    Args:
        primary: Primary emotion name
        secondary: Secondary emotion name
        hierarchy: Optional pre-loaded hierarchy (for performance)
        
    Returns:
        True if valid parent-child relationship, False otherwise
    """
    if hierarchy is None:
        hierarchy = load_wheel_hierarchy()
    
    valid_secondaries = hierarchy.get(primary, [])
    return secondary in valid_secondaries


def get_valid_secondaries(primary: str, hierarchy: Dict[str, List[str]] = None) -> List[str]:
    """
    Get list of valid secondaries for a primary.
    
    Args:
        primary: Primary emotion name
        hierarchy: Optional pre-loaded hierarchy
        
    Returns:
        List of valid secondary names
    """
    if hierarchy is None:
        hierarchy = load_wheel_hierarchy()
    
    return hierarchy.get(primary, [])


# Load hierarchy once at module import
WHEEL_HIERARCHY = load_wheel_hierarchy()

# Export for easy access
__all__ = [
    'WHEEL_HIERARCHY',
    'load_wheel_hierarchy',
    'load_full_wheel',
    'validate_primary_secondary',
    'get_valid_secondaries'
]
