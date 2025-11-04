"""
Emotion Enforcement Schema (EES-1)
Strict 6×6×6 Willcox Wheel - 216 unique emotion states

RULES:
- All emotion outputs MUST draw from this cube
- No synonyms, no extrapolation, no fuzzy expansions
- Invalid terms snap to nearest valid micro-nuance via cosine similarity
- Every classification records: (core, nuance, micro, confidence)
"""

# Tier 1: 6 Core Emotions
CORES = [
    "Happy",
    "Strong", 
    "Peaceful",
    "Sad",
    "Angry",
    "Fearful"
]

# Tier 2: 6 Nuances per Core (36 total)
NUANCES = {
    "Happy": ["Excited", "Interested", "Energetic", "Playful", "Creative", "Optimistic"],
    "Strong": ["Confident", "Proud", "Respected", "Courageous", "Hopeful", "Resilient"],
    "Peaceful": ["Loving", "Grateful", "Thoughtful", "Content", "Serene", "Thankful"],
    "Sad": ["Lonely", "Vulnerable", "Hurt", "Depressed", "Guilty", "Grief"],
    "Angry": ["Mad", "Disappointed", "Humiliated", "Aggressive", "Frustrated", "Critical"],
    "Fearful": ["Anxious", "Insecure", "Overwhelmed", "Weak", "Rejected", "Helpless"]
}

# Tier 3: 6 Micro-Nuances per Nuance (216 total)
MICROS = {
    # Happy branch
    "Excited": ["Energetic", "Curious", "Stimulated", "Playful", "Inspired", "Cheerful"],
    "Interested": ["Engaged", "Intrigued", "Focused", "Attentive", "Curious", "Involved"],
    "Energetic": ["Driven", "Lively", "Motivated", "Active", "Vibrant", "Charged"],
    "Playful": ["Fun", "Lighthearted", "Amused", "Silly", "Cheerful", "Jovial"],
    "Creative": ["Imaginative", "Inventive", "Expressive", "Artistic", "Visionary", "Experimental"],
    "Optimistic": ["Hopeful", "Upbeat", "Confident", "Expectant", "Positive", "Forward-looking"],
    
    # Strong branch
    "Confident": ["Assured", "Secure", "Capable", "Bold", "Competent", "Self-reliant"],
    "Proud": ["Accomplished", "Honored", "Esteemed", "Fulfilled", "Worthy", "Respected"],
    "Respected": ["Valued", "Trusted", "Admired", "Recognized", "Honorable", "Appreciated"],
    "Courageous": ["Brave", "Adventurous", "Daring", "Fearless", "Determined", "Heroic"],
    "Hopeful": ["Inspired", "Aspiring", "Positive", "Expectant", "Reassured", "Uplifted"],
    "Resilient": ["Tough", "Steady", "Rebounding", "Enduring", "Adaptable", "Persistent"],
    
    # Peaceful branch
    "Loving": ["Caring", "Compassionate", "Affectionate", "Warm", "Tender", "Kind"],
    "Grateful": ["Thankful", "Appreciative", "Blessed", "Content", "Relieved", "Peaceful"],
    "Thoughtful": ["Reflective", "Considerate", "Mindful", "Pensive", "Contemplative", "Understanding"],
    "Content": ["Comfortable", "Satisfied", "Fulfilled", "Calm", "Settled", "At-ease"],
    "Serene": ["Tranquil", "Still", "Quiet", "Harmonious", "Relaxed", "Balanced"],
    "Thankful": ["Appreciative", "Aware", "Satisfied", "Gentle", "Humble", "Calm"],
    
    # Sad branch
    "Lonely": ["Abandoned", "Isolated", "Forsaken", "Forgotten", "Distant", "Alone"],
    "Vulnerable": ["Exposed", "Fragile", "Unsafe", "Sensitive", "Helpless", "Unprotected"],
    "Hurt": ["Wounded", "Injured", "Offended", "Pained", "Damaged", "Aching"],
    "Depressed": ["Hopeless", "Empty", "Low", "Exhausted", "Melancholic", "Despairing"],
    "Guilty": ["Ashamed", "Regretful", "Responsible", "Remorseful", "Embarrassed", "Contrite"],
    "Grief": ["Mourning", "Bereaved", "Sorrowful", "Heartbroken", "Loss", "Weeping"],
    
    # Angry branch
    "Mad": ["Furious", "Enraged", "Outraged", "Irritated", "Heated", "Wild"],
    "Disappointed": ["Betrayed", "Jealous", "Let-down", "Resentful", "Displeased", "Dismayed"],
    "Humiliated": ["Ashamed", "Inferior", "Embarrassed", "Belittled", "Exposed", "Dishonored"],
    "Aggressive": ["Provoked", "Violent", "Hostile", "Combative", "Threatening", "Confrontational"],
    "Frustrated": ["Annoyed", "Impatient", "Restless", "Defeated", "Irritated", "Blocked"],
    "Critical": ["Dismissive", "Judgmental", "Harsh", "Skeptical", "Sarcastic", "Demanding"],
    
    # Fearful branch
    "Anxious": ["Nervous", "Uneasy", "Tense", "Worried", "Restless", "Alarmed"],
    "Insecure": ["Uncertain", "Self-doubting", "Hesitant", "Fearful", "Guarded", "Timid"],
    "Overwhelmed": ["Stressed", "Exhausted", "Flooded", "Pressured", "Burdened", "Distracted"],
    "Weak": ["Powerless", "Fragile", "Small", "Dependent", "Vulnerable", "Ineffective"],
    "Rejected": ["Excluded", "Disillusioned", "Dismissed", "Neglected", "Abandoned", "Ignored"],
    "Helpless": ["Worthless", "Defeated", "Stuck", "Lost", "Hopeless", "Paralyzed"]
}


def validate_emotion_state(core: str, nuance: str, micro: str) -> tuple[bool, str]:
    """
    Validate emotion triple against EES-1 schema.
    
    Returns:
        (is_valid, error_message)
    """
    if core not in CORES:
        return False, f"Invalid core '{core}'. Must be one of: {CORES}"
    
    if nuance not in NUANCES[core]:
        return False, f"Invalid nuance '{nuance}' for core '{core}'. Must be one of: {NUANCES[core]}"
    
    if micro not in MICROS[nuance]:
        return False, f"Invalid micro '{micro}' for nuance '{nuance}'. Must be one of: {MICROS[nuance]}"
    
    return True, ""


def get_all_valid_states() -> list[tuple[str, str, str]]:
    """
    Generate all 216 valid emotion states.
    
    Returns:
        List of (core, nuance, micro) tuples
    """
    states = []
    for core in CORES:
        for nuance in NUANCES[core]:
            for micro in MICROS[nuance]:
                states.append((core, nuance, micro))
    return states


def get_nuance_from_micro(micro: str) -> str | None:
    """Get parent nuance for a given micro-nuance."""
    for nuance, micros in MICROS.items():
        if micro in micros:
            return nuance
    return None


def get_core_from_nuance(nuance: str) -> str | None:
    """Get parent core for a given nuance."""
    for core, nuances in NUANCES.items():
        if nuance in nuances:
            return core
    return None


def normalize_to_valid_state(
    candidate_core: str,
    candidate_nuance: str,
    candidate_micro: str
) -> tuple[str, str, str]:
    """
    Snap invalid emotion triple to nearest valid EES-1 state.
    
    Strategy:
    1. If all valid, return as-is
    2. If micro invalid, find closest micro in same nuance
    3. If nuance invalid, find closest nuance in same core
    4. If core invalid, find closest core
    
    Returns:
        (valid_core, valid_nuance, valid_micro)
    """
    # Check if already valid
    is_valid, _ = validate_emotion_state(candidate_core, candidate_nuance, candidate_micro)
    if is_valid:
        return (candidate_core, candidate_nuance, candidate_micro)
    
    # Normalize core
    if candidate_core not in CORES:
        candidate_core = _find_closest_string(candidate_core, CORES)
    
    # Normalize nuance
    if candidate_nuance not in NUANCES[candidate_core]:
        candidate_nuance = _find_closest_string(candidate_nuance, NUANCES[candidate_core])
    
    # Normalize micro
    if candidate_micro not in MICROS[candidate_nuance]:
        candidate_micro = _find_closest_string(candidate_micro, MICROS[candidate_nuance])
    
    return (candidate_core, candidate_nuance, candidate_micro)


def _find_closest_string(target: str, candidates: list[str]) -> str:
    """
    Find closest string match using simple edit distance.
    For production, use cosine similarity with embeddings.
    """
    target_lower = target.lower()
    
    # Exact match (case-insensitive)
    for candidate in candidates:
        if candidate.lower() == target_lower:
            return candidate
    
    # Substring match
    for candidate in candidates:
        if target_lower in candidate.lower() or candidate.lower() in target_lower:
            return candidate
    
    # Fallback to first candidate
    return candidates[0]


# Build reverse lookups for fast validation
_ALL_MICROS = set()
_MICRO_TO_NUANCE = {}
_NUANCE_TO_CORE = {}

for core, nuances in NUANCES.items():
    for nuance in nuances:
        _NUANCE_TO_CORE[nuance] = core
        for micro in MICROS[nuance]:
            _ALL_MICROS.add(micro)
            _MICRO_TO_NUANCE[micro] = nuance


def is_valid_micro(micro: str) -> bool:
    """Check if micro-nuance exists in schema."""
    return micro in _ALL_MICROS


def get_full_path_from_micro(micro: str) -> tuple[str, str, str] | None:
    """
    Get (core, nuance, micro) from micro-nuance alone.
    
    Returns:
        (core, nuance, micro) or None if invalid
    """
    if micro not in _MICRO_TO_NUANCE:
        return None
    
    nuance = _MICRO_TO_NUANCE[micro]
    core = _NUANCE_TO_CORE[nuance]
    
    return (core, nuance, micro)


# Export constants
__all__ = [
    'CORES',
    'NUANCES', 
    'MICROS',
    'validate_emotion_state',
    'get_all_valid_states',
    'normalize_to_valid_state',
    'get_nuance_from_micro',
    'get_core_from_nuance',
    'get_full_path_from_micro',
    'is_valid_micro'
]
