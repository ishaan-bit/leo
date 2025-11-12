"""
Unit Tests for Neutral Emotion & Event Detection

Tests the 4 key scenarios:
1. Expressionless text (no emotion, no event)
2. Routine day text (no emotion, routine event)
3. Explicit emotion + no event
4. Explicit event + no emotion
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from src.enrich.features import extract_features
from src.enrich.clauses import segment_clauses, clause_weights
from src.enrich.dual_valence import compute_dual_valence
from src.enrich.neutral_detection import detect_neutral_states


TEST_CASES = [
    {
        "id": "TC_EXPRESSIONLESS",
        "text": ".",
        "expect": {
            "emotion_presence": "none",
            "event_presence": "none",
            "is_emotion_neutral": True,
            "is_event_neutral": True,
            "confidence_penalty": -0.10  # Both neutral
        }
    },
    {
        "id": "TC_ROUTINE_DAY",
        "text": "Just a normal day I guess, nothing special happened.",
        "expect": {
            "emotion_presence": ["none", "subtle"],  # Allow either
            "event_presence": "routine",
            "is_emotion_neutral": True,
            "is_event_neutral": True,
            "confidence_penalty": -0.10  # Both neutral (routine counts as event-neutral)
        }
    },
    {
        "id": "TC_EMOTION_NO_EVENT",
        "text": "I'm feeling really anxious and overwhelmed but nothing actually happened.",
        "expect": {
            "emotion_presence": "explicit",
            "event_presence": ["none", "routine"],
            "is_emotion_neutral": False,
            "is_event_neutral": True,
            "confidence_penalty": -0.05  # One channel neutral
        }
    },
    {
        "id": "TC_EVENT_NO_EMOTION",
        "text": "Got promoted to senior engineer. Started Monday.",
        "expect": {
            "emotion_presence": ["none", "subtle"],
            "event_presence": "specific",
            "is_emotion_neutral": True,
            "is_event_neutral": False,
            "confidence_penalty": -0.05  # One channel neutral
        }
    },
    {
        "id": "TC_BOTH_EXPLICIT",
        "text": "I'm so excited! Finally got the promotion I've been working towards!",
        "expect": {
            "emotion_presence": "explicit",
            "event_presence": "specific",
            "is_emotion_neutral": False,
            "is_event_neutral": False,
            "confidence_penalty": 0.0  # No penalty
        }
    },
    {
        "id": "TC_AS_USUAL",
        "text": "Went to work, came home, same as always.",
        "expect": {
            "emotion_presence": ["none", "subtle"],  # Allow subtle for routine context
            "event_presence": "routine",
            "is_emotion_neutral": True,  # Routine context counts as emotion-neutral even if subtle
            "is_event_neutral": True,
            "confidence_penalty": -0.10
        }
    }
]


def run_test(test_case: dict) -> dict:
    """Run neutral detection on a test case"""
    text = test_case["text"]
    
    # Extract features
    features = extract_features(text)
    
    # Segment clauses
    clauses = segment_clauses(text)
    clauses = clause_weights(clauses)
    
    # Compute dual valence
    dual_valence = compute_dual_valence(text, features, clauses)
    
    # Detect neutral states
    neutral_result = detect_neutral_states(
        text,
        features,
        dual_valence.emotion_valence,
        dual_valence.event_valence
    )
    
    return {
        "emotion_presence": neutral_result.emotion_presence,
        "event_presence": neutral_result.event_presence,
        "is_emotion_neutral": neutral_result.is_emotion_neutral,
        "is_event_neutral": neutral_result.is_event_neutral,
        "confidence_adjustment": neutral_result.confidence_adjustment,
        "emotion_density": neutral_result.emotion_density,
        "event_density": neutral_result.event_density,
        "explanation": neutral_result.explanation
    }


def validate_test(test_case: dict, result: dict) -> tuple:
    """Validate test result against expectations"""
    failures = []
    expect = test_case["expect"]
    
    # Check emotion_presence
    expected_emotion = expect["emotion_presence"]
    if isinstance(expected_emotion, list):
        if result["emotion_presence"] not in expected_emotion:
            failures.append(f"emotion_presence: got '{result['emotion_presence']}', expected one of {expected_emotion}")
    else:
        if result["emotion_presence"] != expected_emotion:
            failures.append(f"emotion_presence: got '{result['emotion_presence']}', expected '{expected_emotion}'")
    
    # Check event_presence
    expected_event = expect["event_presence"]
    if isinstance(expected_event, list):
        if result["event_presence"] not in expected_event:
            failures.append(f"event_presence: got '{result['event_presence']}', expected one of {expected_event}")
    else:
        if result["event_presence"] != expected_event:
            failures.append(f"event_presence: got '{result['event_presence']}', expected '{expected_event}'")
    
    # Check neutral flags
    if result["is_emotion_neutral"] != expect["is_emotion_neutral"]:
        failures.append(f"is_emotion_neutral: got {result['is_emotion_neutral']}, expected {expect['is_emotion_neutral']}")
    
    if result["is_event_neutral"] != expect["is_event_neutral"]:
        failures.append(f"is_event_neutral: got {result['is_event_neutral']}, expected {expect['is_event_neutral']}")
    
    # Check confidence penalty (allow ±0.01 tolerance)
    if abs(result["confidence_adjustment"] - expect["confidence_penalty"]) > 0.01:
        failures.append(f"confidence_penalty: got {result['confidence_adjustment']:.2f}, expected {expect['confidence_penalty']:.2f}")
    
    passed = len(failures) == 0
    return passed, failures


def run_all_tests():
    """Run all neutral detection tests"""
    print("=" * 80)
    print("NEUTRAL DETECTION TESTS")
    print("=" * 80)
    print()
    
    results = []
    
    for i, test_case in enumerate(TEST_CASES, 1):
        test_id = test_case["id"]
        text = test_case["text"]
        
        print(f"[{i}/{len(TEST_CASES)}] {test_id}")
        print(f'Text: "{text}"')
        print()
        
        # Run test
        result = run_test(test_case)
        
        # Display results
        print(f"  Emotion Presence: {result['emotion_presence']}")
        print(f"  Event Presence:   {result['event_presence']}")
        print(f"  Emotion Density:  {result['emotion_density']:.3f}")
        print(f"  Event Density:    {result['event_density']:.3f}")
        print(f"  Is Emotion Neutral: {result['is_emotion_neutral']}")
        print(f"  Is Event Neutral:   {result['is_event_neutral']}")
        print(f"  Confidence Adj:     {result['confidence_adjustment']:.2f}")
        print()
        print(f"  Explanation: {result['explanation']}")
        print()
        
        # Validate
        passed, failures = validate_test(test_case, result)
        
        if passed:
            print("  ✅ PASSED")
            results.append(("PASS", test_id, None))
        else:
            print("  ❌ FAILED")
            for failure in failures:
                print(f"     - {failure}")
            results.append(("FAIL", test_id, failures))
        
        print("-" * 80)
        print()
    
    # Summary
    print("=" * 80)
    passed_count = sum(1 for r in results if r[0] == "PASS")
    print(f"SUMMARY: {passed_count}/{len(TEST_CASES)} tests passed")
    print("=" * 80)
    print()
    
    for status, test_id, failures in results:
        if status == "PASS":
            print(f"  ✅ PASS  {test_id}")
        else:
            print(f"  ❌ FAIL  {test_id}")
            for failure in failures:
                print(f"          {failure}")
    
    print()
    
    # Exit code
    exit_code = 0 if passed_count == len(TEST_CASES) else 1
    
    if passed_count == len(TEST_CASES):
        print("🎉 All neutral detection tests passed!")
    else:
        print(f"⚠️  {len(TEST_CASES) - passed_count} test(s) failed")
    
    return exit_code


if __name__ == "__main__":
    exit_code = run_all_tests()
    exit(exit_code)
