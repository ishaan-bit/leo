"""
Test event valence enhancements
3 clear events + 1 mixed/effort edge case
"""

import sys
sys.path.insert(0, 'src')

from enrich.full_pipeline import enrich

# Test cases: 3 clear events + 1 mixed/effort
test_cases = [
    {
        "name": "Clear positive - Promotion",
        "text": "i got promoted to senior director today at work!",
        "expected_event_valence": "≥ 0.85"
    },
    {
        "name": "Clear negative - Fired",
        "text": "got fired from my job this morning without warning",
        "expected_event_valence": "≤ 0.15"
    },
    {
        "name": "Clear neutral - Routine",
        "text": "had my usual morning coffee and went to the office",
        "expected_event_valence": "~ 0.5"
    },
    {
        "name": "Edge - Effort words (should be excluded)",
        "text": "been trying really hard to get promoted but keep getting rejected",
        "expected_event_valence": "low (rejected matters, trying doesn't)"
    }
]

print("=" * 70)
print("TESTING EVENT VALENCE ENHANCEMENTS")
print("=" * 70)

for i, test in enumerate(test_cases, 1):
    print(f"\n[Test {i}] {test['name']}")
    print(f"Text: {test['text']}")
    print(f"Expected event valence: {test['expected_event_valence']}")
    print("-" * 70)
    
    try:
        result = enrich(test['text'])
        
        # Get event valence
        event_valence = result.get('event_valence', 0.5)
        
        # Display results
        primary = result.get('wheel', {}).get('primary', 'MISSING')
        secondary = result.get('wheel', {}).get('secondary', 'MISSING')
        
        print(f"Primary: {primary}")
        print(f"Secondary: {secondary}")
        print(f"Event Valence: {event_valence:.3f}")
        
        # Check expectations
        if i == 1 and event_valence >= 0.85:
            print("✓ High positive event valence (promotion)")
        elif i == 2 and event_valence <= 0.15:
            print("✓ Low negative event valence (fired)")
        elif i == 3 and 0.4 <= event_valence <= 0.6:
            print("✓ Neutral event valence (routine)")
        elif i == 4 and event_valence < 0.4:
            print("✓ Low event valence (rejection matters, effort excluded)")
        else:
            print(f"⚠ Event valence outside expected range")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
