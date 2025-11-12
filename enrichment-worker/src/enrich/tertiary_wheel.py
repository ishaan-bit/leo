"""
Tertiary Emotion Layer (Fine-Grain States)

Parses wheel.txt and provides tertiary emotion detection within the 6-core hierarchy:
Primary → Secondary (Nuance) → Tertiary (Micro)

Structure:
    Happy → Excited → [Energetic, Curious, Stimulated, Playful, Inspired, Cheerful]
    Sad → Lonely → [Abandoned, Isolated, Forsaken, Forgotten, Distant, Alone]
    etc.

Provides:
- WHEEL dictionary: {primary: {secondary: [tertiaries...]}}
- Reverse lookup: tertiary → (primary, secondary)
- Motif-based tertiary detection
"""

import json
import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


# Will be populated on module load
WHEEL: Dict[str, Dict[str, List[str]]] = {}
TERTIARY_TO_SECONDARY: Dict[str, Tuple[str, str]] = {}  # tertiary → (primary, secondary)


@dataclass
class TertiaryCandidate:
    """A candidate tertiary emotion with scoring"""
    tertiary: str
    secondary: str
    primary: str
    score: float
    explanation: str


def load_wheel_structure(wheel_path: str = None) -> None:
    """
    Load wheel.txt and populate WHEEL and reverse lookup dictionaries.
    
    Args:
        wheel_path: Path to wheel.txt file. If None, uses default location.
    """
    global WHEEL, TERTIARY_TO_SECONDARY
    
    if wheel_path is None:
        # Default path (user's OneDrive Documents)
        wheel_path = r"C:\Users\Kafka\OneDrive\Documents\wheel.txt"
    
    try:
        with open(wheel_path, 'r', encoding='utf-8') as f:
            wheel_data = json.load(f)
    except FileNotFoundError:
        # Fallback: try relative to current file
        import os
        current_dir = os.path.dirname(__file__)
        wheel_path = os.path.join(current_dir, '..', '..', 'wheel.txt')
        with open(wheel_path, 'r', encoding='utf-8') as f:
            wheel_data = json.load(f)
    
    # Build WHEEL dictionary
    for core in wheel_data['cores']:
        primary = core['name']
        WHEEL[primary] = {}
        
        for nuance in core['nuances']:
            secondary = nuance['name']
            tertiaries = nuance['micro']
            WHEEL[primary][secondary] = tertiaries
            
            # Build reverse lookup
            for tertiary in tertiaries:
                TERTIARY_TO_SECONDARY[tertiary.lower()] = (primary, secondary)


def get_tertiaries_for_secondary(primary: str, secondary: str) -> List[str]:
    """
    Get all tertiary emotions for a given secondary.
    
    Args:
        primary: Primary emotion (e.g., "Sad")
        secondary: Secondary emotion (e.g., "Lonely")
        
    Returns:
        List of tertiary emotions or empty list if not found
    """
    return WHEEL.get(primary, {}).get(secondary, [])


def get_primary_and_secondary(tertiary: str) -> Optional[Tuple[str, str]]:
    """
    Reverse lookup: get primary and secondary for a tertiary.
    
    Args:
        tertiary: Tertiary emotion (e.g., "homesick")
        
    Returns:
        (primary, secondary) tuple or None if not found
    """
    return TERTIARY_TO_SECONDARY.get(tertiary.lower())


def get_all_tertiaries_for_primary(primary: str) -> List[str]:
    """Get all tertiaries across all secondaries for a primary"""
    all_tertiaries = []
    for secondary, tertiaries in WHEEL.get(primary, {}).items():
        all_tertiaries.extend(tertiaries)
    return all_tertiaries


# Initialize on module load
try:
    load_wheel_structure()
    print(f"[TertiaryWheel] Loaded {len(WHEEL)} primaries, {len(TERTIARY_TO_SECONDARY)} tertiaries")
except Exception as e:
    print(f"[TertiaryWheel] Warning: Could not load wheel.txt: {e}")
    print(f"[TertiaryWheel] Tertiary detection will be unavailable")


# Export key structures
__all__ = [
    'WHEEL',
    'TERTIARY_TO_SECONDARY',
    'load_wheel_structure',
    'get_tertiaries_for_secondary',
    'get_primary_and_secondary',
    'get_all_tertiaries_for_primary',
    'TertiaryCandidate'
]
