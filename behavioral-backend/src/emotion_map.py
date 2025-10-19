"""
Emotion and valence/arousal mapping table.
Based on simplified Willcox circumplex model.
"""

# Emotion label -> (valence, arousal) coordinates
# Valence: -1 (negative) to +1 (positive)
# Arousal: 0 (calm) to 1 (activated)

EMOTION_MAP = {
    # High arousal, positive valence
    "joy": (0.8, 0.8),
    "excitement": (0.9, 0.9),
    "elation": (0.9, 0.85),
    "enthusiasm": (0.7, 0.75),
    "anticipation": (0.5, 0.7),
    "pride": (0.6, 0.5),
    
    # High arousal, negative valence
    "anger": (-0.7, 0.65),    # Lower arousal for reflective anger (was 0.9)
    "rage": (-0.9, 0.95),
    "frustration": (-0.6, 0.7),
    "anxiety": (-0.6, 0.65),  # Lower arousal for anxious reflection (was 0.8)
    "fear": (-0.8, 0.7),      # Lower arousal for fearful reflection (was 0.85)
    "panic": (-0.9, 0.95),
    "stress": (-0.5, 0.75),
    "shame": (-0.8, 0.5),
    
    # Low arousal, positive valence
    "contentment": (0.7, 0.3),
    "satisfaction": (0.6, 0.25),
    "calm": (0.5, 0.1),
    "serenity": (0.6, 0.15),
    "relief": (0.6, 0.25),    # Stronger valence for relief (was 0.5)
    "relaxed": (0.4, 0.1),
    
    # Low arousal, negative valence
    "sadness": (-0.7, 0.3),
    "depression": (-0.8, 0.2),
    "melancholy": (-0.6, 0.25),
    "disappointment": (-0.5, 0.35),
    "loneliness": (-0.7, 0.3),
    "hopelessness": (-0.9, 0.2),
    "fatigue": (-0.4, 0.15),
    "boredom": (-0.3, 0.1),
    
    # Near-neutral
    "neutral": (0.0, 0.3),
    "indifference": (0.0, 0.2),
    "contemplation": (0.0, 0.4),
}

# Risk-associated emotions (for weighting in risk detection)
RISK_EMOTIONS = {
    "hopelessness", "depression", "despair", "worthlessness"
}

# Self-harm and hopelessness detection patterns
SELF_HARM_PATTERNS = [
    "wish i were dead",
    "want to die",
    "kill myself",
    "end it all",
    "no reason to live",
    "better off dead",
    "suicide",
    "hurt myself",
    "harm myself",
    "better off gone",
    "don't want to be here",
]

HOPELESSNESS_PATTERNS = [
    "nothing matters",
    "no point",
    "nobody cares",
    "give up",
    "can't go on",
    "no hope",
    "never get better",
    "pointless",
    "worthless",
    "no future",
    "no point in living",
    "can't do this anymore",
]

WITHDRAWAL_PATTERNS = [
    "avoid everyone",
    "don't want to see anyone",
    "staying in bed all day",
    "can't leave the house",
    "isolating myself",
]

# Meta-cognitive markers (self-awareness proxy)
META_COGNITIVE_MARKERS = [
    "i think", "i feel", "i realize", "i notice", "i understand",
    "i believe", "it seems", "i wonder", "i'm aware",
    "reflecting on", "looking back", "in hindsight",
]

# Hedging/evasion markers (reduces willingness to express)
HEDGING_MARKERS = [
    "maybe", "perhaps", "kind of", "sort of", "i guess",
    "not sure", "don't know", "whatever", "doesn't matter",
]
