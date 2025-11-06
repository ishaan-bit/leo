"""Test emotion_presence and event_presence detection with various examples."""
import sys
sys.path.insert(0, 'src')

from enrich.full_pipeline import enrich

test_cases = [
    # Explicit emotion, explicit event
    "i am so angry, all the work gone to waste in an hour",
    
    # Subtle emotion, explicit event
    "kind of annoyed the meeting ran late again",
    
    # Explicit emotion, subtle event
    "feeling really sad today, just in a mood i guess",
    
    # Null emotion, null event
    "went to the store",
    
    # Explicit emotion, null event (pure emotion expression)
    "i feel absolutely devastated and heartbroken",
]

print("=" * 70)
print("EMOTION_PRESENCE & EVENT_PRESENCE TEST")
print("=" * 70)

for i, text in enumerate(test_cases, 1):
    print(f"\n[{i}] {text}")
    print("-" * 70)
    
    result = enrich(text)
    
    print(f"Primary: {result['primary']}")
    print(f"Emotion Presence: {result['emotion_presence']}")
    print(f"Event Presence: {result['event_presence']}")
    print(f"Event Valence: {result['event_valence']}")
    print(f"Is Neutral: {result['is_neutral']}")
