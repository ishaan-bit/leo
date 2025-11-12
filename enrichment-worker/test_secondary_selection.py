"""
Test secondary selection with hierarchy validation and context awareness.
"""

from src.enrich.secondary import select_secondary
from src.enrich.wheel import WHEEL_HIERARCHY, validate_primary_secondary

def test_secondary_validation():
    """Test that secondaries always belong to their primaries"""
    
    # Mock similarity scores (all secondaries from all primaries)
    all_secondaries_sim = {
        # Happy secondaries
        'Excited': 0.7, 'Interested': 0.6, 'Energetic': 0.65, 'Playful': 0.85, 'Creative': 0.55, 'Optimistic': 0.72,
        # Strong secondaries
        'Confident': 0.68, 'Proud': 0.62, 'Respected': 0.58, 'Courageous': 0.73, 'Hopeful': 0.77, 'Resilient': 0.81,
        # Peaceful secondaries
        'Loving': 0.50, 'Grateful': 0.52, 'Thoughtful': 0.48, 'Content': 0.51, 'Serene': 0.47, 'Thankful': 0.49,
        # Sad secondaries
        'Lonely': 0.45, 'Vulnerable': 0.43, 'Hurt': 0.46, 'Depressed': 0.41, 'Guilty': 0.44, 'Grief': 0.42,
        # Angry secondaries
        'Mad': 0.38, 'Disappointed': 0.40, 'Humiliated': 0.37, 'Aggressive': 0.39, 'Frustrated': 0.41, 'Critical': 0.36,
        # Fearful secondaries
        'Anxious': 0.33, 'Insecure': 0.31, 'Overwhelmed': 0.35, 'Weak': 0.32, 'Rejected': 0.34, 'Helpless': 0.30,
    }
    
    tests = [
        # (primary, event_valence, control_level, polarity, description)
        ('Strong', 0.2, 'high', -0.1, 'Struggle without success → should pick Resilient/Courageous'),
        ('Happy', 0.95, 'medium', 0.8, 'Success → should pick Excited/Playful'),
        ('Happy', 0.25, 'medium', 0.3, 'Low event + Happy → should pick Hopeful/Optimistic, NOT Playful'),
        ('Sad', 0.3, 'low', -0.7, 'Negative polarity → should pick Hurt/Depressed'),
        ('Fearful', 0.4, 'low', -0.3, 'Low control + Fearful → should pick Helpless/Weak'),
        ('Angry', 0.5, 'high', -0.4, 'High control + Angry → should pick Critical/Frustrated'),
    ]
    
    print("=" * 80)
    print("SECONDARY SELECTION VALIDATION TESTS")
    print("=" * 80)
    print()
    
    passed = 0
    failed = 0
    
    for primary, event_val, control, polarity, description in tests:
        secondary, score = select_secondary(
            primary=primary,
            secondary_similarity=all_secondaries_sim,
            event_valence=event_val,
            control_level=control,
            polarity=polarity
        )
        
        # Validate parent-child relationship
        is_valid = validate_primary_secondary(primary, secondary, WHEEL_HIERARCHY)
        
        if is_valid:
            status = "✅ PASS"
            passed += 1
        else:
            status = "❌ FAIL"
            failed += 1
        
        print(f"{status}  Primary: {primary:10s}  Secondary: {secondary:12s}  (score: {score:.3f})")
        print(f"      Context: event={event_val:.2f}, control={control}, polarity={polarity:.2f}")
        print(f"      {description}")
        print()
    
    print("=" * 80)
    print(f"VALIDATION: {passed}/{passed+failed} passed ({100*passed/(passed+failed):.0f}%)")
    print("=" * 80)
    
    if failed > 0:
        print(f"\n⚠️  {failed} tests had invalid parent-child relationships!")
    else:
        print("\n🎉 All secondaries belong to their primaries!")
    
    return passed, failed


def test_context_boosting():
    """Test that context rules affect secondary selection"""
    
    # Create similarity scores where Joyful > Resilient
    similarity_scores = {
        'Excited': 0.65,
        'Interested': 0.60,
        'Energetic': 0.62,
        'Playful': 0.88,  # Highest for Happy
        'Creative': 0.58,
        'Optimistic': 0.70,
        'Confident': 0.72,
        'Proud': 0.68,
        'Respected': 0.65,
        'Courageous': 0.75,
        'Hopeful': 0.78,
        'Resilient': 0.80,  # Highest for Strong
    }
    
    print("\n" + "=" * 80)
    print("CONTEXT BOOSTING TESTS")
    print("=" * 80)
    print()
    
    # Test 1: Struggle context (low event, high control, Strong)
    print("Test 1: 'working hard without success' (Strong primary)")
    print("  Event valence: 0.1 (very negative)")
    print("  Control: high")
    print("  Raw highest similarity: Resilient (0.80)")
    
    sec1, score1 = select_secondary(
        primary='Strong',
        secondary_similarity=similarity_scores,
        event_valence=0.1,  # Very low
        control_level='high',
        polarity=-0.2
    )
    
    expected_struggle = ['Resilient', 'Courageous', 'Hopeful']
    if sec1 in expected_struggle:
        print(f"  ✅ Selected: {sec1} (boosted score: {score1:.3f})")
        print(f"  Result: Context boost worked! Picked struggle-related secondary.")
    else:
        print(f"  ❌ Selected: {sec1} (score: {score1:.3f})")
        print(f"  Result: Should have picked from {expected_struggle}")
    
    print()
    
    # Test 2: High success (high event, Strong)
    print("Test 2: 'got promoted' (Strong primary)")
    print("  Event valence: 0.95 (very positive)")
    print("  Control: high")
    
    sec2, score2 = select_secondary(
        primary='Strong',
        secondary_similarity=similarity_scores,
        event_valence=0.95,  # Very high
        control_level='high',
        polarity=0.8
    )
    
    expected_success = ['Confident', 'Proud', 'Respected']
    if sec2 in expected_success:
        print(f"  ✅ Selected: {sec2} (boosted score: {score2:.3f})")
        print(f"  Result: Context boost worked! Picked success-related secondary.")
    else:
        print(f"  ❌ Selected: {sec2} (score: {score2:.3f})")
        print(f"  Result: Should have picked from {expected_success}")
    
    print()
    print("=" * 80)


if __name__ == "__main__":
    test_secondary_validation()
    test_context_boosting()
