"""
Quick test of app.py endpoint with worker-style request
"""

import sys
sys.path.insert(0, 'src')

from enrich.full_pipeline import enrich

# Test with worker format
test_data = {
    'rid': 'refl_test_123',
    'sid': 'sess_test',
    'timestamp': '2025-11-05T12:00:00Z',
    'normalized_text': 'i am so angry, all the work gone to waste',
}

print("Testing enrichment with worker-style request...")
print(f"Text: {test_data['normalized_text']}")

result = enrich(test_data['normalized_text'])

print(f"\n✅ Enrichment successful!")
print(f"Primary: {result.get('primary')}")
print(f"Valence: {result.get('valence')}")
print(f"Arousal: {result.get('arousal')}")

if result.get('poems'):
    print(f"\nPoems: {len(result['poems'])} lines")
    for i, line in enumerate(result['poems'], 1):
        print(f"  {i}. {line}")

if result.get('tips'):
    print(f"\nTips: {len(result['tips'])} windows")
    for i, tip in enumerate(result['tips'], 1):
        print(f"  {i}. {tip}")

print("\n✅ API ready for worker integration!")
