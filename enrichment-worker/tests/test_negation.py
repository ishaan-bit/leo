"""
Unit tests for graded negation and litotes detection.

Tests:
- Negation strength detection (weak/moderate/strong)
- Litotes patterns (double negatives)
- Valence adjustment with graded flips
- Edge cases and corner cases
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from enrich.negation import (
    detect_litotes,
    detect_negation_strength,
    compute_negation_factor,
    analyze_negation,
    apply_negation_to_valence,
    get_negation_indicators,
    NegationResult
)


def test_litotes_detection():
    """Test litotes (double negative) detection"""
    print("\n" + "="*60)
    print("TEST: Litotes Detection")
    print("="*60)
    
    test_cases = [
        ("not unhappy", True, 0.30, "not_unhappy→mild_positive"),
        ("not bad", True, 0.40, "not_bad→moderate_positive"),
        ("not unsuccessful", True, 0.50, "not_unsuccessful→moderate_positive"),
        ("not unimportant", True, 0.60, "not_unimportant→strong_positive"),
        ("very happy", False, None, None),  # No litotes
        ("not good", False, None, None),  # Simple negation, not litotes
    ]
    
    for text, expected_is_litotes, expected_score, expected_explanation in test_cases:
        is_litotes, score, explanation = detect_litotes(text)
        
        assert is_litotes == expected_is_litotes, \
            f"Text: '{text}' - Expected litotes={expected_is_litotes}, got {is_litotes}"
        
        if expected_is_litotes:
            assert abs(score - expected_score) < 0.01, \
                f"Text: '{text}' - Expected score={expected_score}, got {score}"
            assert explanation == expected_explanation, \
                f"Text: '{text}' - Expected explanation='{expected_explanation}', got '{explanation}'"
        
        print(f"  '{text}' → litotes={is_litotes}, score={score}, explanation={explanation} ✓")
    
    print("✓ PASS: Litotes detection works correctly")


def test_negation_strength():
    """Test negation strength classification"""
    print("\n" + "="*60)
    print("TEST: Negation Strength Classification")
    print("="*60)
    
    test_cases = [
        ("not at all happy", "strong"),
        ("never going back", "strong"),
        ("absolutely not", "strong"),
        ("not good", "moderate"),
        ("don't like it", "moderate"),
        ("isn't great", "moderate"),
        ("barely tolerable", "weak"),
        ("hardly noticeable", "weak"),
        ("seldom works", "weak"),
        ("very happy", "none"),  # No negation
        ("I like this", "none"),
    ]
    
    for text, expected_strength in test_cases:
        strength = detect_negation_strength(text)
        
        assert strength == expected_strength, \
            f"Text: '{text}' - Expected strength='{expected_strength}', got '{strength}'"
        
        print(f"  '{text}' → {strength} ✓")
    
    print("✓ PASS: Negation strength classification correct")


def test_negation_factors():
    """Test negation flip factors"""
    print("\n" + "="*60)
    print("TEST: Negation Flip Factors")
    print("="*60)
    
    test_cases = [
        ("strong", -1.0),
        ("moderate", -0.8),
        ("weak", -0.7),
        ("none", 0.0),
    ]
    
    for strength, expected_factor in test_cases:
        factor = compute_negation_factor(strength)
        
        assert abs(factor - expected_factor) < 0.01, \
            f"Strength: '{strength}' - Expected factor={expected_factor}, got {factor}"
        
        print(f"  {strength} → {factor:.1f} ✓")
    
    print("✓ PASS: Negation factors correct")


def test_analyze_negation():
    """Test comprehensive negation analysis"""
    print("\n" + "="*60)
    print("TEST: Comprehensive Negation Analysis")
    print("="*60)
    
    test_cases = [
        # (text, expected_has_negation, expected_strength, expected_flip_factor)
        ("not bad", True, "litotes", 0.40),  # Litotes takes precedence
        ("not at all happy", True, "strong", -1.0),
        ("don't like it", True, "moderate", -0.8),
        ("barely works", True, "weak", -0.7),
        ("I love this", False, "none", 0.0),
    ]
    
    for text, expected_has, expected_strength, expected_factor in test_cases:
        result = analyze_negation(text)
        
        assert result.has_negation == expected_has, \
            f"Text: '{text}' - Expected has_negation={expected_has}, got {result.has_negation}"
        assert result.strength == expected_strength, \
            f"Text: '{text}' - Expected strength='{expected_strength}', got '{result.strength}'"
        assert abs(result.flip_factor - expected_factor) < 0.01, \
            f"Text: '{text}' - Expected factor={expected_factor}, got {result.flip_factor}"
        
        print(f"  '{text}'")
        print(f"    → has_negation={result.has_negation}, strength={result.strength}, "
              f"factor={result.flip_factor:.2f}")
        print(f"    → explanation: {result.explanation}")
    
    print("✓ PASS: Negation analysis comprehensive")


def test_valence_adjustment():
    """Test graded valence adjustments"""
    print("\n" + "="*60)
    print("TEST: Graded Valence Adjustments")
    print("="*60)
    
    test_cases = [
        # (base_valence, text, expected_adjusted, tolerance)
        
        # Moderate negation: "not good" → flip with -0.8
        # 0.8 → 0.5 + (0.8 - 0.5) * -0.8 = 0.5 + (-0.24) = 0.26
        (0.8, "not good", 0.26, 0.02),
        
        # Strong negation: "never happy" → flip with -1.0
        # 0.9 → 0.5 + (0.9 - 0.5) * -1.0 = 0.5 + (-0.4) = 0.1
        (0.9, "never happy", 0.1, 0.02),
        
        # Weak negation: "barely acceptable" → flip with -0.7
        # 0.7 → 0.5 + (0.7 - 0.5) * -0.7 = 0.5 + (-0.14) = 0.36
        (0.7, "barely acceptable", 0.36, 0.02),
        
        # Litotes: "not bad" → fixed positive score
        (0.3, "not bad", 0.40, 0.02),
        
        # No negation: unchanged
        (0.8, "I love this", 0.8, 0.01),
    ]
    
    for base_val, text, expected_adj, tolerance in test_cases:
        adjusted, explanation = apply_negation_to_valence(base_val, text)
        
        assert abs(adjusted - expected_adj) < tolerance, \
            f"Text: '{text}', base={base_val} - Expected adjusted={expected_adj}, got {adjusted}"
        
        print(f"  '{text}'")
        print(f"    base={base_val:.2f} → adjusted={adjusted:.2f}")
        print(f"    explanation: {explanation} ✓")
    
    print("✓ PASS: Valence adjustments correct")


def test_edge_cases():
    """Test edge cases"""
    print("\n" + "="*60)
    print("TEST: Edge Cases")
    print("="*60)
    
    # Empty string
    result = analyze_negation("")
    assert not result.has_negation, "Empty string should have no negation"
    print("  Empty string → no negation ✓")
    
    # Multiple negations
    text = "not never going to not happen"
    strength = detect_negation_strength(text)
    assert strength == "strong", "Should detect strongest negation"
    print(f"  Multiple negations → {strength} ✓")
    
    # Litotes with extra words
    is_litotes, score, _ = detect_litotes("it's not bad at all")
    assert is_litotes, "Should detect litotes with extra words"
    print(f"  'not bad at all' → litotes detected ✓")
    
    # Case insensitivity
    strength1 = detect_negation_strength("NOT GOOD")
    strength2 = detect_negation_strength("not good")
    assert strength1 == strength2, "Should be case insensitive"
    print(f"  Case insensitivity → {strength1} == {strength2} ✓")
    
    # Valence at neutral point
    adjusted, _ = apply_negation_to_valence(0.5, "not okay")
    assert abs(adjusted - 0.5) < 0.02, "Neutral valence should stay near neutral when negated"
    print(f"  Neutral valence (0.5) → {adjusted:.2f} ✓")
    
    # Valence clamping
    adjusted, _ = apply_negation_to_valence(1.0, "never satisfied")
    assert 0.0 <= adjusted <= 1.0, "Should clamp to [0, 1]"
    print(f"  Clamping test → {adjusted:.2f} in [0, 1] ✓")
    
    print("✓ PASS: Edge cases handled correctly")


def test_negation_indicators():
    """Test negation indicator extraction"""
    print("\n" + "="*60)
    print("TEST: Negation Indicator Extraction")
    print("="*60)
    
    test_cases = [
        # Note: "not bad" matches both litotes AND moderate negation patterns
        ("not bad", ["litotes", "moderate"]),  # Will find both
        ("never going back", ["strong"]),
        ("don't like it", ["moderate"]),
        ("barely works", ["weak"]),
        ("I love this", []),  # No negation
    ]
    
    for text, expected_types in test_cases:
        indicators = get_negation_indicators(text)
        
        # Check that expected types are present
        for expected_type in expected_types:
            assert any(expected_type in ind for ind in indicators), \
                f"Text: '{text}' - Expected type '{expected_type}' not found in {indicators}"
        
        print(f"  '{text}' → {indicators} ✓")
    
    print("✓ PASS: Negation indicators extracted correctly")


def test_practical_examples():
    """Test real-world examples"""
    print("\n" + "="*60)
    print("TEST: Practical Real-World Examples")
    print("="*60)
    
    examples = [
        {
            'text': "I'm not happy about this situation",
            'base_valence': 0.8,
            'description': "Simple negation of positive emotion"
        },
        {
            'text': "The result was not bad at all",
            'base_valence': 0.3,
            'description': "Litotes expressing mild satisfaction"
        },
        {
            'text': "Never felt so defeated",
            'base_valence': 0.2,
            'description': "Strong negation emphasizing negative state"
        },
        {
            'text': "Barely keeping it together",
            'base_valence': 0.6,
            'description': "Weak negation suggesting struggle"
        },
    ]
    
    for example in examples:
        text = example['text']
        base_val = example['base_valence']
        
        adjusted, explanation = apply_negation_to_valence(base_val, text)
        negation = analyze_negation(text)
        indicators = get_negation_indicators(text)
        
        print(f"\n  Example: {example['description']}")
        print(f"  Text: \"{text}\"")
        print(f"  Base valence: {base_val:.2f}")
        print(f"  Adjusted valence: {adjusted:.2f}")
        print(f"  Negation: {negation.strength} (factor={negation.flip_factor:.2f})")
        print(f"  Explanation: {explanation}")
        print(f"  Indicators: {indicators}")
    
    print("\n✓ PASS: Practical examples processed correctly")


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("GRADED NEGATION & LITOTES TESTS")
    print("="*60)
    
    tests = [
        test_litotes_detection,
        test_negation_strength,
        test_negation_factors,
        test_analyze_negation,
        test_valence_adjustment,
        test_edge_cases,
        test_negation_indicators,
        test_practical_examples,
    ]
    
    passed = 0
    failed = 0
    
    for test_func in tests:
        try:
            test_func()
            passed += 1
        except AssertionError as e:
            print(f"\n✗ FAILED: {test_func.__name__}")
            print(f"  Error: {e}")
            failed += 1
        except Exception as e:
            print(f"\n✗ ERROR: {test_func.__name__}")
            print(f"  Error: {e}")
            failed += 1
    
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    print(f"Total: {passed + failed}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    if failed == 0:
        print("\n🎉 All tests passed!")
    else:
        print(f"\n⚠ {failed} test(s) failed")
    
    return failed == 0


if __name__ == '__main__':
    success = run_all_tests()
    sys.exit(0 if success else 1)
