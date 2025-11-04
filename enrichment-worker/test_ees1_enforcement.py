"""
Test EES-1 (6×6×6 Willcox Wheel) Strict Enforcement
Validates 216-state emotion taxonomy across entire backend
"""

import json
from src.utils.emotion_schema import (
    CORES, NUANCES, MICROS,
    validate_emotion_state,
    get_all_valid_states,
    normalize_to_valid_state,
    get_full_path_from_micro
)
from src.modules.emotion_enforcer import EmotionEnforcer


def test_schema_completeness():
    """Verify 6×6×6 = 216 total states"""
    print("\n=== TEST 1: Schema Completeness ===")
    
    all_states = get_all_valid_states()
    assert len(all_states) == 216, f"Expected 216 states, got {len(all_states)}"
    
    # Verify structure
    assert len(CORES) == 6, "Must have exactly 6 cores"
    for core in CORES:
        assert len(NUANCES[core]) == 6, f"Core '{core}' must have exactly 6 nuances"
        for nuance in NUANCES[core]:
            assert len(MICROS[nuance]) == 6, f"Nuance '{nuance}' must have exactly 6 micros"
    
    print(f"✓ Schema complete: {len(CORES)} cores × 6 nuances × 6 micros = {len(all_states)} states")


def test_valid_emotion_validation():
    """Test that valid emotions pass validation"""
    print("\n=== TEST 2: Valid Emotion Validation ===")
    
    valid_cases = [
        ("Happy", "Excited", "Energetic"),
        ("Strong", "Confident", "Assured"),
        ("Peaceful", "Loving", "Caring"),
        ("Sad", "Lonely", "Abandoned"),
        ("Angry", "Mad", "Furious"),
        ("Fearful", "Anxious", "Nervous")
    ]
    
    for core, nuance, micro in valid_cases:
        is_valid, error = validate_emotion_state(core, nuance, micro)
        assert is_valid, f"Valid emotion rejected: {core}/{nuance}/{micro} - {error}"
        print(f"✓ {core}/{nuance}/{micro}")
    
    print(f"✓ All {len(valid_cases)} valid emotions passed validation")


def test_invalid_emotion_rejection():
    """Test that invalid emotions are rejected"""
    print("\n=== TEST 3: Invalid Emotion Rejection ===")
    
    invalid_cases = [
        ("InvalidCore", "Excited", "Energetic", "core"),
        ("Happy", "InvalidNuance", "Energetic", "nuance"),
        ("Happy", "Excited", "InvalidMicro", "micro"),
        ("Strong", "Excited", "Energetic", "nuance"),  # Excited belongs to Happy, not Strong
        ("Happy", "Confident", "Assured", "nuance"),   # Confident belongs to Strong, not Happy
    ]
    
    for core, nuance, micro, expected_error_type in invalid_cases:
        is_valid, error = validate_emotion_state(core, nuance, micro)
        assert not is_valid, f"Invalid emotion accepted: {core}/{nuance}/{micro}"
        assert expected_error_type in error.lower(), f"Wrong error type: {error}"
        print(f"✓ Rejected {core}/{nuance}/{micro} ({expected_error_type})")
    
    print(f"✓ All {len(invalid_cases)} invalid emotions rejected")


def test_emotion_normalization():
    """Test that invalid emotions snap to nearest valid state"""
    print("\n=== TEST 4: Emotion Normalization ===")
    
    # Test cases: (invalid_input, expected_core)
    normalization_cases = [
        ("joyful", "playful", "fun", "Happy"),       # "joyful" → "Happy"
        ("mad", "irritated", "annoyed", "Angry"),    # "mad" → "Angry"
        ("scared", "nervous", "worried", "Fearful"), # "scared" → "Fearful"
    ]
    
    for input_core, input_nuance, input_micro, expected_core in normalization_cases:
        normalized_core, normalized_nuance, normalized_micro = normalize_to_valid_state(
            input_core, input_nuance, input_micro
        )
        
        # Verify normalized state is valid
        is_valid, error = validate_emotion_state(normalized_core, normalized_nuance, normalized_micro)
        assert is_valid, f"Normalized state invalid: {normalized_core}/{normalized_nuance}/{normalized_micro}"
        
        print(f"✓ {input_core}/{input_nuance}/{input_micro} → {normalized_core}/{normalized_nuance}/{normalized_micro}")
    
    print(f"✓ All {len(normalization_cases)} normalizations successful")


def test_enforcer_integration():
    """Test EmotionEnforcer class"""
    print("\n=== TEST 5: EmotionEnforcer Integration ===")
    
    enforcer = EmotionEnforcer()
    
    # Test valid emotion
    result = enforcer.enforce("Happy", "Excited", "Energetic", confidence=0.9)
    assert result['core'] == "Happy"
    assert result['nuance'] == "Excited"
    assert result['micro'] == "Energetic"
    assert not result['was_corrected']
    assert result['confidence'] == 0.9
    print(f"✓ Valid emotion preserved: {result['core']}/{result['nuance']}/{result['micro']}")
    
    # Test invalid emotion (should normalize)
    result = enforcer.enforce("joyful", "happy", "excited", confidence=0.8)
    assert result['was_corrected'], "Invalid emotion should be corrected"
    assert result['original'] is not None
    assert result['confidence'] < 0.8  # Confidence should be penalized
    print(f"✓ Invalid emotion corrected: {result['original']['core']} → {result['core']}")
    
    # Test hybrid output enforcement
    hybrid_output = enforcer.enforce_hybrid_output({
        'primary': 'Happy',
        'secondary': 'Excited',
        'tertiary': 'Energetic',
        'confidence_scores': {'primary': 0.95, 'secondary': 0.85, 'tertiary': 0.75}
    })
    
    assert hybrid_output['correction_count'] == 0, "Valid hybrid output shouldn't need correction"
    assert hybrid_output['primary']['micro'] == 'Energetic'
    print(f"✓ Hybrid output validated: {hybrid_output['primary']['micro']}")
    
    # Test statistics
    stats = enforcer.get_stats()
    assert stats['total_validations'] > 0
    print(f"✓ Enforcer stats: {stats['total_validations']} validations, {stats['total_corrections']} corrections")
    
    print(f"✓ EmotionEnforcer fully functional")


def test_micro_to_full_path():
    """Test deriving full path from micro-nuance alone"""
    print("\n=== TEST 6: Micro-Nuance Lookup ===")
    
    test_micros = [
        ("Energetic", "Happy", "Excited"),
        ("Assured", "Strong", "Confident"),
        ("Caring", "Peaceful", "Loving"),
        ("Abandoned", "Sad", "Lonely"),
        ("Furious", "Angry", "Mad"),
        ("Nervous", "Fearful", "Anxious")
    ]
    
    for micro, expected_core, expected_nuance in test_micros:
        path = get_full_path_from_micro(micro)
        assert path is not None, f"Could not find path for micro '{micro}'"
        core, nuance, found_micro = path
        assert core == expected_core, f"Expected core '{expected_core}', got '{core}'"
        assert nuance == expected_nuance, f"Expected nuance '{expected_nuance}', got '{nuance}'"
        assert found_micro == micro
        print(f"✓ {micro} → {core}/{nuance}/{micro}")
    
    print(f"✓ All {len(test_micros)} micro-nuance lookups successful")


def test_all_216_states():
    """Validate all 216 states are unique and valid"""
    print("\n=== TEST 7: All 216 States Validation ===")
    
    all_states = get_all_valid_states()
    
    # Check uniqueness
    state_strs = [f"{c}/{n}/{m}" for c, n, m in all_states]
    assert len(state_strs) == len(set(state_strs)), "Duplicate states detected!"
    
    # Validate each state
    for core, nuance, micro in all_states:
        is_valid, error = validate_emotion_state(core, nuance, micro)
        assert is_valid, f"State {core}/{nuance}/{micro} failed validation: {error}"
    
    # Print sample states from each core
    cores_sampled = {}
    for core, nuance, micro in all_states:
        if core not in cores_sampled:
            cores_sampled[core] = f"{core}/{nuance}/{micro}"
    
    print("\nSample states (one per core):")
    for core, sample in cores_sampled.items():
        print(f"  {sample}")
    
    print(f"\n✓ All 216 states are unique and valid")


def test_format_for_output():
    """Test output formatting for API contracts"""
    print("\n=== TEST 8: Output Formatting ===")
    
    enforcer = EmotionEnforcer()
    
    enforced = enforcer.enforce_hybrid_output({
        'primary': 'Happy',
        'secondary': 'Excited',
        'tertiary': 'Energetic',
        'confidence_scores': {'primary': 0.95, 'secondary': 0.85, 'tertiary': 0.75}
    })
    
    formatted = enforcer.format_for_output(enforced)
    
    # Verify required keys
    assert 'primary' in formatted
    assert 'secondary' in formatted
    assert 'tertiary' in formatted
    assert 'primary_full' in formatted
    assert 'emotion_cube' in formatted
    assert 'schema_version' in formatted
    
    # Verify schema version
    assert formatted['schema_version'] == 'EES-1'
    
    # Verify emotion_cube structure
    assert len(formatted['emotion_cube']) == 3
    for emotion in formatted['emotion_cube']:
        assert 'rank' in emotion
        assert 'core' in emotion
        assert 'nuance' in emotion
        assert 'micro' in emotion
        assert 'confidence' in emotion
    
    print(f"✓ Primary: {formatted['primary']} ({formatted['primary_full']})")
    print(f"✓ Secondary: {formatted['secondary']} ({formatted['secondary_full']})")
    print(f"✓ Tertiary: {formatted['tertiary']} ({formatted['tertiary_full']})")
    print(f"✓ Schema: {formatted['schema_version']}")
    print(f"✓ Output formatting validated")


def run_all_tests():
    """Run complete EES-1 test suite"""
    print("\n" + "="*70)
    print("EES-1 (6×6×6 Willcox Wheel) Strict Enforcement Test Suite")
    print("="*70)
    
    tests = [
        test_schema_completeness,
        test_valid_emotion_validation,
        test_invalid_emotion_rejection,
        test_emotion_normalization,
        test_enforcer_integration,
        test_micro_to_full_path,
        test_all_216_states,
        test_format_for_output
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"\n❌ TEST FAILED: {test.__name__}")
            print(f"   Error: {e}")
            failed += 1
        except Exception as e:
            print(f"\n❌ TEST ERROR: {test.__name__}")
            print(f"   Exception: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "="*70)
    print(f"TEST SUMMARY: {passed} passed, {failed} failed")
    print("="*70)
    
    if failed == 0:
        print("\n✅ ALL TESTS PASSED - EES-1 enforcement fully operational")
    else:
        print(f"\n❌ {failed} TESTS FAILED - Review errors above")
    
    return failed == 0


if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(__file__ + "/../.."))
    
    success = run_all_tests()
    sys.exit(0 if success else 1)
