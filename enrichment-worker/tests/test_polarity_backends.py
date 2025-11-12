"""
Unit tests for polarity backend abstraction.

Tests:
- Backend interface compliance
- VADER backend functionality
- TextBlob backend functionality
- Backend switching
- Factory functions
- Fallback behavior
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from enrich.polarity_backends import (
    PolarityBackend,
    VADERBackend,
    TextBlobBackend,
    get_polarity_backend,
    set_default_backend,
    get_default_backend,
    compute_polarity
)


def test_vader_backend_basic():
    """Test VADER backend basic functionality"""
    print("\n" + "="*60)
    print("TEST: VADER Backend - Basic Functionality")
    print("="*60)
    
    backend = VADERBackend()
    
    # Test positive text
    pos_score = backend.compute_polarity("I love this! It's amazing and wonderful.")
    print(f"Positive text polarity: {pos_score:.3f}")
    assert pos_score > 0.3, f"Expected positive score, got {pos_score}"
    
    # Test negative text
    neg_score = backend.compute_polarity("I hate this. It's terrible and awful.")
    print(f"Negative text polarity: {neg_score:.3f}")
    assert neg_score < -0.3, f"Expected negative score, got {neg_score}"
    
    # Test neutral text
    neutral_score = backend.compute_polarity("The sky is blue.")
    print(f"Neutral text polarity: {neutral_score:.3f}")
    assert -0.2 <= neutral_score <= 0.2, f"Expected neutral score, got {neutral_score}"
    
    print("✓ PASS: VADER backend computes polarity correctly")


def test_vader_backend_info():
    """Test VADER backend metadata"""
    print("\n" + "="*60)
    print("TEST: VADER Backend - Metadata")
    print("="*60)
    
    backend = VADERBackend()
    info = backend.get_backend_info()
    
    print(f"Backend info: {info}")
    
    assert info['name'] == 'VADER', "Backend name should be VADER"
    assert info['library'] == 'vaderSentiment', "Library should be vaderSentiment"
    assert 'version' in info, "Should include version info"
    assert 'available' in info, "Should include availability status"
    
    print("✓ PASS: VADER backend metadata correct")


def test_textblob_backend_basic():
    """Test TextBlob backend basic functionality"""
    print("\n" + "="*60)
    print("TEST: TextBlob Backend - Basic Functionality")
    print("="*60)
    
    backend = TextBlobBackend()
    
    # Test positive text
    pos_score = backend.compute_polarity("I love this! It's amazing and wonderful.")
    print(f"Positive text polarity: {pos_score:.3f}")
    # TextBlob might not be installed, so check if it falls back
    if backend._available:
        assert pos_score > 0.1, f"Expected positive score, got {pos_score}"
        print("✓ TextBlob backend available and working")
    else:
        print("⚠ TextBlob not installed, using fallback")
        # Fallback should still give reasonable results
        assert -1.0 <= pos_score <= 1.0, "Fallback score should be in range"
    
    print("✓ PASS: TextBlob backend computes polarity")


def test_backend_factory():
    """Test backend factory function"""
    print("\n" + "="*60)
    print("TEST: Backend Factory")
    print("="*60)
    
    # Get VADER backend
    vader = get_polarity_backend('vader')
    assert isinstance(vader, VADERBackend), "Should return VADERBackend instance"
    print("✓ Factory returned VADERBackend for 'vader'")
    
    # Get VADER with different case
    vader2 = get_polarity_backend('VADER')
    assert isinstance(vader2, VADERBackend), "Should be case-insensitive"
    print("✓ Factory is case-insensitive")
    
    # Get TextBlob backend
    textblob = get_polarity_backend('textblob')
    assert isinstance(textblob, TextBlobBackend), "Should return TextBlobBackend instance"
    print("✓ Factory returned TextBlobBackend for 'textblob'")
    
    # Test invalid backend name
    try:
        get_polarity_backend('nonexistent')
        assert False, "Should raise ValueError for unknown backend"
    except ValueError as e:
        print(f"✓ Factory raises ValueError for unknown backend: {e}")
    
    print("✓ PASS: Backend factory works correctly")


def test_default_backend():
    """Test default backend management"""
    print("\n" + "="*60)
    print("TEST: Default Backend Management")
    print("="*60)
    
    # Get default backend (should be VADER)
    default = get_default_backend()
    assert isinstance(default, VADERBackend), "Default should be VADERBackend"
    print("✓ Default backend is VADER")
    
    # Set custom default
    custom_backend = TextBlobBackend()
    set_default_backend(custom_backend)
    
    new_default = get_default_backend()
    assert new_default is custom_backend, "Should return the set default"
    print("✓ Custom default backend set successfully")
    
    # Reset to VADER for other tests
    set_default_backend(VADERBackend())
    
    print("✓ PASS: Default backend management works")


def test_compute_polarity_convenience():
    """Test convenience compute_polarity function"""
    print("\n" + "="*60)
    print("TEST: Convenience Function - compute_polarity")
    print("="*60)
    
    text = "This is great! I'm so happy."
    
    # Use default backend
    score1 = compute_polarity(text)
    print(f"Polarity (default backend): {score1:.3f}")
    assert score1 > 0.2, "Should be positive"
    
    # Use specific backend
    vader = VADERBackend()
    score2 = compute_polarity(text, backend=vader)
    print(f"Polarity (VADER backend): {score2:.3f}")
    assert score2 > 0.2, "Should be positive"
    
    print("✓ PASS: Convenience function works")


def test_backend_switching():
    """Test switching between backends"""
    print("\n" + "="*60)
    print("TEST: Backend Switching")
    print("="*60)
    
    text = "I'm feeling pretty good today."
    
    vader = VADERBackend()
    vader_score = vader.compute_polarity(text)
    print(f"VADER score: {vader_score:.3f}")
    
    textblob = TextBlobBackend()
    textblob_score = textblob.compute_polarity(text)
    print(f"TextBlob score: {textblob_score:.3f}")
    
    # Both should be positive (though exact values may differ)
    if vader._available:
        assert vader_score > 0, "VADER should detect positive sentiment"
    
    if textblob._available:
        assert textblob_score > 0, "TextBlob should detect positive sentiment"
    
    print("✓ PASS: Backend switching works")


def test_edge_cases():
    """Test edge cases"""
    print("\n" + "="*60)
    print("TEST: Edge Cases")
    print("="*60)
    
    backend = VADERBackend()
    
    # Empty string
    empty_score = backend.compute_polarity("")
    print(f"Empty string polarity: {empty_score:.3f}")
    assert -1.0 <= empty_score <= 1.0, "Should return valid score"
    
    # Very short text
    short_score = backend.compute_polarity("ok")
    print(f"Short text polarity: {short_score:.3f}")
    assert -1.0 <= short_score <= 1.0, "Should return valid score"
    
    # Mixed sentiment
    mixed_score = backend.compute_polarity("I love it but I also hate it.")
    print(f"Mixed sentiment polarity: {mixed_score:.3f}")
    assert -1.0 <= mixed_score <= 1.0, "Should return valid score"
    
    # Special characters
    special_score = backend.compute_polarity("!!! ??? @#$ %%%")
    print(f"Special chars polarity: {special_score:.3f}")
    assert -1.0 <= special_score <= 1.0, "Should return valid score"
    
    print("✓ PASS: Edge cases handled correctly")


def test_polarity_range():
    """Test that all backends return scores in [-1, 1]"""
    print("\n" + "="*60)
    print("TEST: Polarity Range Compliance")
    print("="*60)
    
    test_texts = [
        "I absolutely love this!",
        "This is terrible and awful.",
        "The sky is blue.",
        "Amazing! Wonderful! Perfect!",
        "Horrible. Disgusting. Worst ever.",
        ""
    ]
    
    backends = [VADERBackend(), TextBlobBackend()]
    
    for backend in backends:
        backend_name = backend.get_backend_info()['name']
        print(f"\nTesting {backend_name}:")
        
        for text in test_texts:
            score = backend.compute_polarity(text)
            assert -1.0 <= score <= 1.0, f"{backend_name} returned out-of-range score: {score}"
            print(f"  '{text[:30]}...' → {score:.3f} ✓")
    
    print("\n✓ PASS: All backends return scores in [-1, 1]")


def test_consistency():
    """Test that backend consistently scores similar texts"""
    print("\n" + "="*60)
    print("TEST: Consistency")
    print("="*60)
    
    backend = VADERBackend()
    
    # Similar positive texts should have similar scores
    pos_texts = [
        "I love this so much!",
        "I absolutely love this!",
        "I really love this!"
    ]
    
    pos_scores = [backend.compute_polarity(text) for text in pos_texts]
    print(f"Positive text scores: {[f'{s:.3f}' for s in pos_scores]}")
    
    # All should be positive
    assert all(s > 0.2 for s in pos_scores), "Similar positive texts should all be positive"
    
    # Variance should be reasonable
    max_diff = max(pos_scores) - min(pos_scores)
    print(f"Max difference: {max_diff:.3f}")
    assert max_diff < 0.5, "Similar texts should have similar scores"
    
    print("✓ PASS: Backend shows consistent scoring")


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("POLARITY BACKEND TESTS")
    print("="*60)
    
    tests = [
        test_vader_backend_basic,
        test_vader_backend_info,
        test_textblob_backend_basic,
        test_backend_factory,
        test_default_backend,
        test_compute_polarity_convenience,
        test_backend_switching,
        test_edge_cases,
        test_polarity_range,
        test_consistency
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
