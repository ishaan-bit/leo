"""
Test null emotion handling - when emotion_presence is None, all emotions should be None.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from enrich import full_pipeline

def test_null_emotion_cases():
    """Test texts that should have no emotion presence."""
    
    print("=" * 60)
    print("Testing Null Emotion Detection")
    print("=" * 60)
    
    # Test cases that should trigger emotion_presence = None
    test_cases = [
        "I went to the store and bought milk.",
        "The meeting is scheduled for 3pm tomorrow.",
        "Weather forecast shows 72 degrees.",
        "Traffic on I-95 is moderate today.",
    ]
    
    for i, text in enumerate(test_cases, 1):
        print(f"\n[Test {i}] Text: {text}")
        result = full_pipeline.enrich(text)
        
        emotion_presence = result.get('emotion_presence')
        primary = result['wheel']['primary']
        secondary = result['wheel']['secondary']
        tertiary = result['wheel']['tertiary']
        
        print(f"  emotion_presence: {emotion_presence}")
        print(f"  primary: {primary}")
        print(f"  secondary: {secondary}")
        print(f"  tertiary: {tertiary}")
        
        # Check expectations
        if emotion_presence is None:
            if primary is None and secondary is None and tertiary is None:
                print(f"  ✅ PASS - All emotions correctly set to None")
            else:
                print(f"  ❌ FAIL - emotion_presence is None but emotions not None!")
        else:
            print(f"  ℹ️  INFO - Emotion detected (not null): {emotion_presence}")

if __name__ == '__main__':
    test_null_emotion_cases()
