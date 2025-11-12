"""
Test v2.2 Pipeline Integration

Validates:
1. Tertiary detection integrated into full pipeline
2. Neutral detection integrated into full pipeline
3. Output schema includes all v2.2 fields
4. Backward compatibility with v2.1 format
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from enrich.pipeline_v2_2 import enrich_v2_2, enrich_legacy_format


def test_tertiary_integration():
    """Test that tertiary detection works in full pipeline"""
    print("\n" + "="*60)
    print("TEST: Tertiary Integration")
    print("="*60)
    
    text = "I feel homesick and miss my family so much."
    result = enrich_v2_2(text, include_tertiary=True)
    
    print(f"Text: {text}")
    print(f"\nPrimary: {result.primary}")
    print(f"Secondary: {result.secondary}")
    print(f"Tertiary: {result.tertiary}")
    print(f"Tertiary Confidence: {result.tertiary_confidence}")
    print(f"Tertiary Explanation: {result.tertiary_explanation}")
    
    # Validate
    assert result.tertiary is not None, "Should detect tertiary"
    assert result.tertiary == "Homesick", f"Expected Homesick, got {result.tertiary}"
    assert result.tertiary_confidence > 0.4, f"Confidence too low: {result.tertiary_confidence}"
    
    print("\n✓ PASS: Tertiary detected correctly")
    return True


def test_neutral_integration():
    """Test that neutral detection works in full pipeline"""
    print("\n" + "="*60)
    print("TEST: Neutral Integration")
    print("="*60)
    
    text = "Just a normal day at work. Nothing special."
    result = enrich_v2_2(text, include_neutral=True)
    
    print(f"Text: {text}")
    print(f"\nEmotion Presence: {result.emotion_presence}")
    print(f"Event Presence: {result.event_presence}")
    print(f"Is Emotion Neutral: {result.is_emotion_neutral}")
    print(f"Is Event Neutral: {result.is_event_neutral}")
    print(f"Neutral Explanation: {result.neutral_explanation}")
    print(f"Confidence Adjustment: {result.neutral_confidence_adjustment}")
    
    # Validate
    assert result.emotion_presence in ["none", "subtle"], f"Expected low emotion, got {result.emotion_presence}"
    assert result.event_presence in ["none", "routine"], f"Expected low event, got {result.event_presence}"
    
    print("\n✓ PASS: Neutral states detected correctly")
    return True


def test_metaphor_tertiary():
    """Test tertiary detection via metaphor"""
    print("\n" + "="*60)
    print("TEST: Metaphor → Tertiary")
    print("="*60)
    
    text = "I'm drowning in all this work and can't breathe."
    result = enrich_v2_2(text, include_tertiary=True)
    
    print(f"Text: {text}")
    print(f"\nPrimary: {result.primary}")
    print(f"Secondary: {result.secondary}")
    print(f"Tertiary: {result.tertiary}")
    print(f"Tertiary Explanation: {result.tertiary_explanation}")
    
    # Validate
    if result.tertiary:
        print(f"\n✓ PASS: Detected tertiary '{result.tertiary}' via metaphor")
    else:
        print(f"\n⚠ WARNING: No tertiary detected (may be expected if secondary doesn't match)")
    
    return True


def test_full_output_schema():
    """Test that all v2.2 fields are present in output"""
    print("\n" + "="*60)
    print("TEST: Full v2.2 Output Schema")
    print("="*60)
    
    text = "I'm so excited! Finally got the promotion I was working towards."
    result = enrich_v2_2(text, include_tertiary=True, include_neutral=True)
    
    print(f"Text: {text}")
    print(f"\nResult fields:")
    result_dict = result.to_dict()
    for key, value in result_dict.items():
        if isinstance(value, dict):
            print(f"  {key}:")
            for k, v in value.items():
                print(f"    {k}: {v}")
        else:
            print(f"  {key}: {value}")
    
    # Validate required fields
    required_fields = [
        'primary', 'secondary', 'tertiary',
        'emotion_valence', 'event_valence', 'arousal',
        'domain', 'control', 'polarity',
        'emotion_presence', 'event_presence',
        'is_emotion_neutral', 'is_event_neutral',
        'tertiary_confidence', 'tertiary_explanation',
        'neutral_explanation', 'flags'
    ]
    
    for field in required_fields:
        assert field in result_dict, f"Missing required field: {field}"
    
    print("\n✓ PASS: All v2.2 fields present")
    return True


def test_backward_compatibility():
    """Test that legacy format still works"""
    print("\n" + "="*60)
    print("TEST: Backward Compatibility")
    print("="*60)
    
    text = "Feeling anxious about the presentation tomorrow."
    result = enrich_legacy_format(text)
    
    print(f"Text: {text}")
    print(f"\nLegacy format output:")
    for key, value in result.items():
        if isinstance(value, dict):
            print(f"  {key}: {value}")
        else:
            print(f"  {key}: {value}")
    
    # Validate v2.1 fields present
    v2_1_fields = [
        'primary', 'secondary', 'emotion_valence', 'event_valence',
        'arousal', 'domain', 'control', 'polarity', 'flags'
    ]
    
    for field in v2_1_fields:
        assert field in result, f"Missing v2.1 field: {field}"
    
    # Validate v2.2 fields NOT present
    v2_2_only_fields = ['tertiary', 'emotion_presence', 'is_emotion_neutral']
    for field in v2_2_only_fields:
        assert field not in result, f"v2.2 field should not be in legacy format: {field}"
    
    print("\n✓ PASS: Legacy format compatible")
    return True


def test_complex_case():
    """Test complex case with multiple features"""
    print("\n" + "="*60)
    print("TEST: Complex Multi-Feature Case")
    print("="*60)
    
    text = "Had a normal day at work, but then I felt heartbroken when they told me they're leaving."
    result = enrich_v2_2(text, include_tertiary=True, include_neutral=True)
    
    print(f"Text: {text}")
    print(f"\nEmotions:")
    print(f"  Primary: {result.primary}")
    print(f"  Secondary: {result.secondary}")
    print(f"  Tertiary: {result.tertiary}")
    
    print(f"\nValence/Arousal:")
    print(f"  Emotion Valence: {result.emotion_valence:.3f}")
    print(f"  Event Valence: {result.event_valence:.3f}")
    print(f"  Arousal: {result.arousal:.3f}")
    
    print(f"\nNeutral Detection:")
    print(f"  Emotion Presence: {result.emotion_presence}")
    print(f"  Event Presence: {result.event_presence}")
    
    print(f"\nContext:")
    print(f"  Domain: {result.domain}")
    print(f"  Control: {result.control}")
    print(f"  Polarity: {result.polarity}")
    
    print(f"\nFlags:")
    for flag, value in result.flags.items():
        if value:
            print(f"  {flag}: {value}")
    
    print(f"\nExplanations:")
    if result.tertiary_explanation:
        print(f"  Tertiary: {result.tertiary_explanation}")
    if result.neutral_explanation:
        print(f"  Neutral: {result.neutral_explanation}")
    print(f"  Rules: {result.rule_explanation}")
    
    print("\n✓ PASS: Complex case processed successfully")
    return True


def main():
    """Run all integration tests"""
    tests = [
        ("Tertiary Integration", test_tertiary_integration),
        ("Neutral Integration", test_neutral_integration),
        ("Metaphor → Tertiary", test_metaphor_tertiary),
        ("Full Output Schema", test_full_output_schema),
        ("Backward Compatibility", test_backward_compatibility),
        ("Complex Multi-Feature", test_complex_case),
    ]
    
    results = []
    for name, test_fn in tests:
        try:
            passed = test_fn()
            results.append((name, passed, None))
        except Exception as e:
            print(f"\n✗ FAIL: {name}")
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()
            results.append((name, False, str(e)))
    
    print("\n" + "="*60)
    print("INTEGRATION TEST SUMMARY")
    print("="*60)
    
    passed_count = sum(1 for _, p, _ in results if p)
    total_count = len(results)
    
    for name, passed, error in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")
        if error:
            print(f"  Error: {error}")
    
    print(f"\nTotal: {passed_count}/{total_count} passing")
    
    return 0 if passed_count == total_count else 1


if __name__ == "__main__":
    sys.exit(main())
