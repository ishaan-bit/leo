"""
Expected Reference Table
Gold standard values for 12 test reflections
Used to validate enrichment correction agent convergence

Reference: Enrichment Refinement Spec (Oct 21, 2025)
"""

EXPECTED_REFERENCES = [
    {
        "rid": "refl_1761019709686_m5ifk30g0",
        "raw_text_summary": "completed something avoided",
        "final": {
            "wheel": {
                "primary": "relief",
                "secondary": "anticipation"
            },
            "valence": 0.65,
            "arousal": 0.45,
            "invoked": ["relief", "progress"],
            "expressed": ["content"],
            "confidence": 0.8
        },
        "willingness_to_express": 0.45,
        "comparator_note": "positive deviation from fatigue baseline",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761019797463_xwvxjhk40",
        "raw_text_summary": "can't keep up",
        "final": {
            "wheel": {
                "primary": "overwhelm",
                "secondary": "fatigue"
            },
            "valence": 0.25,
            "arousal": 0.7,
            "invoked": ["overwhelm", "pressure"],
            "expressed": ["tense"],
            "confidence": 0.75
        },
        "willingness_to_express": 0.35,
        "comparator_note": "below baseline valence, higher arousal",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761019848190_9w95qbyzg",
        "raw_text_summary": "laughed with friends",
        "final": {
            "wheel": {
                "primary": "joy",
                "secondary": "connection"
            },
            "valence": 0.9,
            "arousal": 0.7,
            "invoked": ["joy", "belonging"],
            "expressed": ["playful", "light"],
            "confidence": 0.9
        },
        "willingness_to_express": 0.6,
        "comparator_note": "sharp positive deviation",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761019884239_9f2bzs030",
        "raw_text_summary": "miss old times",
        "final": {
            "wheel": {
                "primary": "nostalgia",
                "secondary": "affection"
            },
            "valence": 0.35,
            "arousal": 0.4,
            "invoked": ["longing", "loss"],
            "expressed": ["wistful"],
            "confidence": 0.8
        },
        "willingness_to_express": 0.4,
        "comparator_note": "slightly lower valence, calm arousal",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761019913789_rdlfhurc9",
        "raw_text_summary": "spoke up despite fear",
        "final": {
            "wheel": {
                "primary": "courage",
                "secondary": "pride"
            },
            "valence": 0.6,
            "arousal": 0.8,
            "invoked": ["fear", "self_assertion"],
            "expressed": ["proud", "shaky"],
            "confidence": 0.8
        },
        "willingness_to_express": 0.5,
        "comparator_note": "arousal↑ valence↑ vs baseline",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761019945179_wpycbwnu3",
        "raw_text_summary": "want to disappear",
        "final": {
            "wheel": {
                "primary": "withdrawal",
                "secondary": "sadness"
            },
            "valence": 0.15,
            "arousal": 0.4,
            "invoked": ["exhaustion", "withdrawal"],
            "expressed": ["defeated"],
            "confidence": 0.7
        },
        "willingness_to_express": 0.25,
        "comparator_note": "valence low, risk weak",
        "risk_signals_weak": ["withdrawal_intent_low"]
    },
    {
        "rid": "refl_1761019972767_vrwrufx47",
        "raw_text_summary": "stung by words",
        "final": {
            "wheel": {
                "primary": "hurt",
                "secondary": "shame"
            },
            "valence": 0.35,
            "arousal": 0.65,
            "invoked": ["hurt", "irritation"],
            "expressed": ["guarded"],
            "confidence": 0.75
        },
        "willingness_to_express": 0.35,
        "comparator_note": "valence drop, high arousal",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761020000288_aknq9sre0",
        "raw_text_summary": "sunset unreal",
        "final": {
            "wheel": {
                "primary": "awe",
                "secondary": "gratitude"
            },
            "valence": 0.85,
            "arousal": 0.55,
            "invoked": ["awe", "serenity"],
            "expressed": ["peaceful"],
            "confidence": 0.9
        },
        "willingness_to_express": 0.55,
        "comparator_note": "strong positive, moderate arousal",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761020117692_zjbe2lpzr",
        "raw_text_summary": "repeating mistakes",
        "final": {
            "wheel": {
                "primary": "frustration",
                "secondary": "determination"
            },
            "valence": 0.4,
            "arousal": 0.7,
            "invoked": ["frustration", "learning"],
            "expressed": ["irritated", "tired"],
            "confidence": 0.75
        },
        "willingness_to_express": 0.35,
        "comparator_note": "small negative deviation",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761020163521_ki08lka6k",
        "raw_text_summary": "shifting slowly",
        "final": {
            "wheel": {
                "primary": "acceptance",
                "secondary": "hope"
            },
            "valence": 0.6,
            "arousal": 0.55,
            "invoked": ["change", "renewal"],
            "expressed": ["reflective"],
            "confidence": 0.8
        },
        "willingness_to_express": 0.5,
        "comparator_note": "neutral-positive trend",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761020194806_38gjxf28i",
        "raw_text_summary": "weird mix",
        "final": {
            "wheel": {
                "primary": "confusion",
                "secondary": "curiosity"
            },
            "valence": 0.45,
            "arousal": 0.55,
            "invoked": ["uncertainty", "complexity"],
            "expressed": ["confused"],
            "confidence": 0.75
        },
        "willingness_to_express": 0.4,
        "comparator_note": "near baseline, arousal mild",
        "risk_signals_weak": []
    },
    {
        "rid": "refl_1761020223673_me13m8z7a",
        "raw_text_summary": "proud of progress unseen",
        "final": {
            "wheel": {
                "primary": "pride",
                "secondary": "calm"
            },
            "valence": 0.8,
            "arousal": 0.55,
            "invoked": ["pride", "contentment"],
            "expressed": ["proud"],
            "confidence": 0.85
        },
        "willingness_to_express": 0.55,
        "comparator_note": "positive deviation, low tension",
        "risk_signals_weak": []
    }
]


def get_expected_by_rid(rid: str):
    """Get expected reference by RID"""
    for ref in EXPECTED_REFERENCES:
        if ref['rid'] == rid:
            return ref
    return None


def get_all_expected():
    """Get all expected references"""
    return EXPECTED_REFERENCES
