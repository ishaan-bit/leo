"""
Quick test of current enrichment pipeline with 3 normal + 1 edge case
"""

import sys
sys.path.insert(0, 'src')

from enrich.full_pipeline import enrich

# Test cases: 3 normal + 1 edge case (negation)
test_cases = [
    {
        "name": "Normal - Happy work win",
        "text": "i got promoted today! feeling so good about my career progress"
    },
    {
        "name": "Normal - Sad relationship",
        "text": "my best friend stopped talking to me and i don't know why. it hurts"
    },
    {
        "name": "Normal - Angry work frustration",
        "text": "my manager took credit for my work again. this is so frustrating"
    },
    {
        "name": "Edge - Negation/sarcasm",
        "text": "great, another deadline moved up. i'm not stressed at all. totally fine."
    }
]

print("=" * 60)
print("TESTING CURRENT ENRICHMENT PIPELINE")
print("=" * 60)

for i, test in enumerate(test_cases, 1):
    print(f"\n[Test {i}] {test['name']}")
    print(f"Text: {test['text']}")
    print("-" * 60)
    
    try:
        result = enrich(test['text'])
        
        # Display key results
        print(f"Primary: {result.get('wheel', {}).get('primary', 'MISSING')}")
        print(f"Secondary: {result.get('wheel', {}).get('secondary', 'MISSING')}")
        print(f"Tertiary: {result.get('wheel', {}).get('tertiary', 'MISSING')}")
        print(f"Valence: {result.get('valence', 'MISSING'):.3f}")
        print(f"Arousal: {result.get('arousal', 'MISSING'):.3f}")
        print(f"Domain: {result.get('domain', 'MISSING')}")
        print(f"Control: {result.get('control', 'MISSING')}")
        print(f"Polarity: {result.get('polarity', 'MISSING')}")
        
        # Check for issues
        issues = []
        if result.get('wheel', {}).get('tertiary') == 'MISSING':
            issues.append("Tertiary detection failed")
        if not result.get('poems'):
            issues.append("No poems generated")
        if not result.get('tips'):
            issues.append("No tips generated")
        
        if issues:
            print(f"\nISSUES: {', '.join(issues)}")
        else:
            print("\nPOEMS:")
            for poem in result.get('poems', []):
                print(f"  - {poem}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)
