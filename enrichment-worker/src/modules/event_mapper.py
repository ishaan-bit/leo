"""
Event Mapper
Maps generic or vague event labels to specific, clinically useful event classes
"""

from typing import List, Dict


def map_generic_events(events_raw: List[str], normalized_text: str, valence: float, arousal: float) -> List[Dict]:
    """
    Map generic events to specific event classes with confidences
    
    Args:
        events_raw: Raw event labels from Ollama
        normalized_text: The reflection text
        valence: Valence score
        arousal: Arousal score
    
    Returns:
        List of {label, confidence} dicts
    """
    text_lower = normalized_text.lower()
    
    mapped_events = []
    
    for event in events_raw:
        event_lower = event.lower()
        
        # Map generic "work-related" to specific events
        if 'work' in event_lower or 'activities' in event_lower:
            # Analyze text for specific signals
            confidence_base = 0.75
            
            # Check for fatigue signals
            if any(word in text_lower for word in ['tired', 'exhausted', 'fatigue', 'drained', 'energy']):
                mapped_events.append({
                    'label': 'fatigue',
                    'confidence': min(0.95, confidence_base + 0.15)
                })
            
            # Check for irritation signals
            if any(word in text_lower for word in ['irritated', 'annoyed', 'frustrated', 'angry']):
                mapped_events.append({
                    'label': 'irritation',
                    'confidence': min(0.95, confidence_base + 0.15)
                })
            
            # Check for progress signals
            if any(word in text_lower for word in ['progress', 'stuck', 'behind', 'slow', 'unproductive']):
                mapped_events.append({
                    'label': 'low_progress',
                    'confidence': min(0.90, confidence_base + 0.10)
                })
            
            # If no specific signals, keep generic but lower confidence
            if not mapped_events:
                mapped_events.append({
                    'label': 'work_stress',
                    'confidence': 0.60
                })
        
        # Map "daily reflection" to actual events
        elif 'daily' in event_lower and 'reflection' in event_lower:
            # This is a meta-label, extract actual events from text
            if valence < 0.4:
                if arousal > 0.55:
                    mapped_events.append({'label': 'irritation', 'confidence': 0.75})
                else:
                    mapped_events.append({'label': 'fatigue', 'confidence': 0.75})
            elif valence > 0.6:
                if arousal > 0.6:
                    mapped_events.append({'label': 'excitement', 'confidence': 0.70})
                else:
                    mapped_events.append({'label': 'contentment', 'confidence': 0.70})
        
        # Pass through specific events
        elif event_lower in [
            'fatigue', 'irritation', 'low_progress', 'disappointment',
            'anxiety', 'contentment', 'excitement', 'gratitude',
            'loneliness', 'confusion', 'accomplishment', 'connection',
            'grief', 'anger', 'joy', 'fear', 'surprise', 'disgust',
            'sadness', 'trust', 'anticipation'
        ]:
            mapped_events.append({
                'label': event_lower,
                'confidence': 0.85
            })
        
        # Unknown events get lower confidence
        else:
            mapped_events.append({
                'label': event,
                'confidence': 0.60
            })
    
    # Remove duplicates (keep highest confidence)
    unique_events = {}
    for evt in mapped_events:
        label = evt['label']
        if label not in unique_events or evt['confidence'] > unique_events[label]['confidence']:
            unique_events[label] = evt
    
    return list(unique_events.values())
