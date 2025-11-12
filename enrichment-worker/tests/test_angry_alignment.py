"""
Unit tests for Angry alignment rule.

Tests:
- Angry + negative event + high control → boost
- Angry + negative event + low control → no boost
- Angry + positive event → no boost
- Sad dominant → no boost (even with conditions met)
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from enrich.rules import apply_angry_alignment, RuleContext


def test_angry_alignment_trigger():
    """Test Angry alignment triggers with correct conditions"""
    print("\n" + "="*60)
    print("TEST: Angry Alignment - Trigger Conditions")
    print("="*60)
    
    # Case 1: Should trigger (Angry dominant, negative event, medium control)
    candidates1 = {'Angry': 0.6, 'Sad': 0.3, 'Happy': 0.1}
    event_val1 = 0.3  # Negative event
    control1 = 'medium'
    rule_ctx1 = RuleContext()
    
    result1 = apply_angry_alignment(candidates1, event_val1, control1, rule_ctx1)
    
    assert result1['Angry'] > candidates1['Angry'], \
        "Angry should be boosted with negative event + medium control"
    assert abs(result1['Angry'] - candidates1['Angry'] * 1.20) < 0.01, \
        f"Expected 20% boost, got {result1['Angry']} vs {candidates1['Angry']}"
    
    print(f"  ✓ Negative event (0.3) + medium control → Angry boosted")
    print(f"    Before: {candidates1['Angry']:.2f}, After: {result1['Angry']:.2f}")
    
    # Case 2: Should trigger (Angry dominant, negative event, high control)
    candidates2 = {'Angry': 0.7, 'Sad': 0.2, 'Happy': 0.1}
    event_val2 = 0.2  # Very negative event
    control2 = 'high'
    rule_ctx2 = RuleContext()
    
    result2 = apply_angry_alignment(candidates2, event_val2, control2, rule_ctx2)
    
    assert result2['Angry'] > candidates2['Angry'], \
        "Angry should be boosted with negative event + high control"
    
    print(f"  ✓ Negative event (0.2) + high control → Angry boosted")
    print(f"    Before: {candidates2['Angry']:.2f}, After: {result2['Angry']:.2f}")
    
    print("✓ PASS: Angry alignment triggers correctly")


def test_angry_alignment_no_trigger():
    """Test Angry alignment does NOT trigger when conditions not met"""
    print("\n" + "="*60)
    print("TEST: Angry Alignment - No Trigger Cases")
    print("="*60)
    
    # Case 1: Angry but positive event (should NOT trigger)
    candidates1 = {'Angry': 0.6, 'Sad': 0.3, 'Happy': 0.1}
    event_val1 = 0.8  # Positive event
    control1 = 'medium'
    rule_ctx1 = RuleContext()
    
    result1 = apply_angry_alignment(candidates1, event_val1, control1, rule_ctx1)
    
    assert result1['Angry'] == candidates1['Angry'], \
        "Angry should NOT be boosted with positive event"
    
    print(f"  ✓ Positive event (0.8) + medium control → No boost")
    print(f"    Angry remains: {result1['Angry']:.2f}")
    
    # Case 2: Angry + negative event but LOW control (should NOT trigger)
    candidates2 = {'Angry': 0.6, 'Sad': 0.3, 'Happy': 0.1}
    event_val2 = 0.3  # Negative event
    control2 = 'low'  # Low control
    rule_ctx2 = RuleContext()
    
    result2 = apply_angry_alignment(candidates2, event_val2, control2, rule_ctx2)
    
    assert result2['Angry'] == candidates2['Angry'], \
        "Angry should NOT be boosted with low control (low agency)"
    
    print(f"  ✓ Negative event (0.3) + low control → No boost")
    print(f"    Angry remains: {result2['Angry']:.2f}")
    
    # Case 3: Sad dominant (Angry not candidate) with correct conditions
    candidates3 = {'Sad': 0.8, 'Angry': 0.1, 'Happy': 0.1}
    event_val3 = 0.3  # Negative event
    control3 = 'high'
    rule_ctx3 = RuleContext()
    
    result3 = apply_angry_alignment(candidates3, event_val3, control3, rule_ctx3)
    
    assert result3['Angry'] == candidates3['Angry'], \
        "Angry should NOT be boosted when Sad is dominant"
    
    print(f"  ✓ Sad dominant (0.8) → No boost to Angry (0.1)")
    
    print("✓ PASS: Angry alignment correctly skips inappropriate cases")


def test_angry_close_candidate():
    """Test Angry alignment when Angry is close second"""
    print("\n" + "="*60)
    print("TEST: Angry Alignment - Close Candidate")
    print("="*60)
    
    # Angry within 20% of top score
    candidates = {'Sad': 0.50, 'Angry': 0.45, 'Happy': 0.05}
    event_val = 0.25  # Negative event
    control = 'medium'
    rule_ctx = RuleContext()
    
    result = apply_angry_alignment(candidates, event_val, control, rule_ctx)
    
    # Angry should be boosted (within 80% threshold)
    assert result['Angry'] > candidates['Angry'], \
        "Angry should be boosted when within 80% of top score"
    
    boosted_angry = result['Angry']
    print(f"  Sad: {candidates['Sad']:.2f}")
    print(f"  Angry before: {candidates['Angry']:.2f}")
    print(f"  Angry after: {boosted_angry:.2f}")
    print(f"  ✓ Angry boosted despite being second (within 80% threshold)")
    
    print("✓ PASS: Close candidate handling works")


def test_explanation_generation():
    """Test that explanations are generated correctly"""
    print("\n" + "="*60)
    print("TEST: Angry Alignment - Explanation Generation")
    print("="*60)
    
    candidates = {'Angry': 0.6, 'Sad': 0.3, 'Happy': 0.1}
    event_val = 0.35
    control = 'high'
    rule_ctx = RuleContext()
    
    result = apply_angry_alignment(candidates, event_val, control, rule_ctx)
    
    # Check that rule was logged
    assert len(rule_ctx.applications) == 1, "Should have 1 rule application"
    rule_app = rule_ctx.applications[0]
    
    assert rule_app.rule_name == "angry_alignment"
    assert rule_app.triggered == True
    assert "neg_event" in rule_app.explanation
    assert "agency" in rule_app.explanation
    assert "high" in rule_app.explanation
    
    print(f"  Rule Name: {rule_app.rule_name}")
    print(f"  Triggered: {rule_app.triggered}")
    print(f"  Explanation: {rule_app.explanation}")
    print(f"  Before → After: {rule_app.before_value:.2f} → {rule_app.after_value:.2f}")
    
    print("✓ PASS: Explanation generation correct")


def run_all_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("ANGRY ALIGNMENT RULE TESTS")
    print("="*60)
    
    tests = [
        test_angry_alignment_trigger,
        test_angry_alignment_no_trigger,
        test_angry_close_candidate,
        test_explanation_generation,
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
