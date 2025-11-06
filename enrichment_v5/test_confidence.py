"""
Test confidence scoring system
3 clear texts + 1 ambiguous edge case
"""

import sys
sys.path.insert(0, 'src')

from enrich.full_pipeline import enrich

# Test cases: 3 clear + 1 ambiguous
test_cases = [
    {
        "name": "Clear - Strong positive work win",
        "text": "i got promoted to senior director today! this is exactly what i've been working towards for years. feeling absolutely amazing about my career",
        "expected_confidence": "high"
    },
    {
        "name": "Clear - Strong negative loss",
        "text": "my best friend of 10 years completely cut me off without any explanation. i'm devastated and have been crying all day",
        "expected_confidence": "high"
    },
    {
        "name": "Clear - Obvious anger",
        "text": "my manager stole my project presentation and presented it as his own work to the executives. i'm furious and feel completely disrespected",
        "expected_confidence": "high"
    },
    {
        "name": "Edge - Ambiguous mixed emotion",
        "text": "got the job but it's not what i expected. feel kind of okay i guess",
        "expected_confidence": "low or medium"
    }
]

print("=" * 70)
print("TESTING CONFIDENCE SCORING SYSTEM")
print("=" * 70)

for i, test in enumerate(test_cases, 1):
    print(f"\n[Test {i}] {test['name']}")
    print(f"Text: {test['text']}")
    print(f"Expected confidence: {test['expected_confidence']}")
    print("-" * 70)
    
    try:
        result = enrich(test['text'])
        
        # Get confidence
        confidence = result.get('confidence', 0.0)
        
        # Categorize
        if confidence >= 0.75:
            category = 'high'
        elif confidence >= 0.60:
            category = 'medium'
        elif confidence >= 0.45:
            category = 'low'
        else:
            category = 'uncertain'
        
        # Display results
        primary = result.get('wheel', {}).get('primary', 'MISSING')
        secondary = result.get('wheel', {}).get('secondary', 'MISSING')
        
        print(f"Primary: {primary}")
        print(f"Secondary: {secondary}")
        print(f"Confidence: {confidence:.3f} ({category})")
        
        # Check if matches expectation
        if category in test['expected_confidence']:
            print("✓ Confidence matches expectation")
        else:
            print(f"⚠ Expected {test['expected_confidence']}, got {category}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

print("\n" + "=" * 70)
print("TEST COMPLETE")
print("=" * 70)
