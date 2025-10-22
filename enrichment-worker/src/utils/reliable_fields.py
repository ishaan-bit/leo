"""
Reliable Fields Extractor
==========================
Extracts only validated/stable fields from hybrid enrichment result.
Used for Stage-2 post-processing to prevent hallucination on unstable fields.
"""


def pick_reliable_fields(hybrid_result: dict) -> dict:
    """
    Extract reliable fields from Stage-1 hybrid enrichment result.
    
    Args:
        hybrid_result: Full enrichment JSON from hybrid_scorer
    
    Returns:
        Dict with only reliable fields safe for LLM consumption
    """
    # Use normalized_text (cleaned), not raw_text
    normalized_text = hybrid_result.get('normalized_text', '')
    if not normalized_text:
        # Fallback to raw if normalized missing
        normalized_text = hybrid_result.get('raw_text', '') or hybrid_result.get('original_text', '')
    
    # Wheel (always present)
    wheel = hybrid_result.get('wheel', {})
    
    # Invoked - handle string format "a + b + c" or list
    invoked = hybrid_result.get('invoked', [])
    if isinstance(invoked, str):
        invoked = [x.strip() for x in invoked.split('+')]
    
    # Expressed - handle string format "a / b / c" or list
    expressed = hybrid_result.get('expressed', [])
    if isinstance(expressed, str):
        expressed = [x.strip() for x in expressed.split('/')]
    
    # Events - extract labels only (top 3)
    events_raw = hybrid_result.get('events', [])
    events = []
    if isinstance(events_raw, list):
        events = [e.get('label') if isinstance(e, dict) else str(e) 
                  for e in events_raw[:3]]
    
    # Valence/Arousal (core dimensions)
    valence = hybrid_result.get('valence', 0.5)
    arousal = hybrid_result.get('arousal', 0.5)
    
    return {
        "normalized_text": normalized_text,
        "wheel": {
            "primary": wheel.get('primary'),
            "secondary": wheel.get('secondary'),
            "tertiary": wheel.get('tertiary')
        },
        "invoked": invoked,
        "expressed": expressed,
        "valence": valence,
        "arousal": arousal,
        "events": events
    }
