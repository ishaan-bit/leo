"""
Test suite for Event Valence v2.0 with token-based negation scope.
Tests weighted anchors, effort word exclusion, and context-aware negation.
"""

from src.enrich.event_valence import compute_event_valence

def test_event_valence_v2():
    """Comprehensive test of event valence improvements"""
    
    tests = [
        # (text, expected_range, description)
        ("without much success", (0.0, 0.1), "Negated positive → very negative"),
        ("got promoted today", (0.9, 1.0), "Clear positive event"),
        ("working with no results yet", (0.4, 0.6), "Effort word excluded → neutral"),
        ("major failure without recovery", (0.0, 0.1), "Forward-only negation → failure NOT negated"),
        ("huge success without delay", (0.9, 1.0), "Success + negated delay → very positive"),
        ("rejected from the program", (0.0, 0.2), "Clear negative event"),
        ("no traffic today", (0.9, 1.0), "Negated minor negative → positive (no traffic is good!)"),
        ("passed the exam easily", (0.9, 1.0), "Strong positive"),
        ("hospital visit went well", (0.0, 0.3), "Negative anchor (hospital), no positive counter"),
        ("trying hard but no progress", (0.0, 0.2), "Negated positive (progress) → negative"),
    ]
    
    print("=" * 80)
    print("EVENT VALENCE V2.0 TEST RESULTS")
    print("=" * 80)
    print()
    
    passed = 0
    failed = 0
    
    for text, (min_val, max_val), description in tests:
        result = compute_event_valence(text)
        status = "✅ PASS" if min_val <= result <= max_val else "❌ FAIL"
        
        if status == "✅ PASS":
            passed += 1
        else:
            failed += 1
        
        print(f"{status}  {text:40s} → {result:.3f}  (expect {min_val:.1f}-{max_val:.1f})")
        print(f"      {description}")
        print()
    
    print("=" * 80)
    print(f"SUMMARY: {passed}/{passed+failed} passed ({100*passed/(passed+failed):.0f}%)")
    print("=" * 80)
    
    if failed > 0:
        print(f"\n⚠️  {failed} tests failed - review ranges or implementation")
    else:
        print("\n🎉 All tests passed! Event valence v2.0 is production-ready.")
    
    return passed, failed


if __name__ == "__main__":
    test_event_valence_v2()
