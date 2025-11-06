"""
Test enhanced negation handling with litotes and scope
3 normal negations + 1 litotes edge case
"""

import sys
sys.path.insert(0, 'src')

from enrich.full_pipeline import enrich

# Test cases: 3 normal negations + 1 litotes edge case
test_cases = [
    {
        "name": "Normal - Simple negation",
        "text": "i'm not happy about the layoffs at work",
        "expected_primary": "Sad or Angry"
    },
    {
        "name": "Normal - Negation with emotion word",
        "text": "i don't feel confident about tomorrow's presentation",
        "expected_primary": "Fearful or Sad"
    },
    {
        "name": "Normal - Strong negation",
        "text": "i'm never going to succeed at this job",
        "expected_primary": "Sad or Fearful"
    },
    {
        "name": "Edge - Litotes (double negative → positive)",
        "text": "the meeting wasn't bad at all, actually felt not unhappy about it",
        "expected_primary": "Peaceful or Happy"
    }
]

print("=" * 70)
print("TESTING ENHANCED NEGATION HANDLING")
print("=" * 70)

for i, test in enumerate(test_cases, 1):
    print(f"\n[Test {i}] {test['name']}")
    print(f"Text: {test['text']}")
    print(f"Expected: {test['expected_primary']}")
    print("-" * 70)
    
    try:
        result = enrich(test['text'])
        
        # Display key results
        primary = result.get('wheel', {}).get('primary', 'MISSING')
        secondary = result.get('wheel', {}).get('secondary', 'MISSING')
        tertiary = result.get('wheel', {}).get('tertiary', 'MISSING')
        valence = result.get('valence', 0.0)
        
        print(f"Primary: {primary}")
        print(f"Secondary: {secondary}")
        print(f"Tertiary: {tertiary}")
        print(f"Valence: {valence:.3f}")
        
        # Check negation metadata
        dialogue_meta = result.get('_dialogue_meta', {})
        negation_flag = dialogue_meta.get('negation_flag', False)
        print(f"Negation detected: {negation_flag}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
