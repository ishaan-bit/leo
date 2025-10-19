#!/usr/bin/env python3
"""
Test script for behavioral backend.
Runs all acceptance criteria test cases.
"""

import subprocess
import json
import sys


def run_test(name, user, text, expectations):
    """Run a single test case and validate expectations."""
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print(f"{'='*60}")
    print(f"Input: {text}\n")
    
    # Run CLI command
    result = subprocess.run(
        ["python", "cli.py", "analyze", "--user", user, "--text", text],
        capture_output=True,
        text=True
    )
    
    if result.returncode != 0:
        print(f"❌ FAILED: Command returned non-zero exit code")
        print(f"stderr: {result.stderr}")
        return False
    
    # Parse JSON output
    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError as e:
        print(f"❌ FAILED: Invalid JSON output")
        print(f"stdout: {result.stdout}")
        return False
    
    # Validate expectations
    passed = True
    for key, condition in expectations.items():
        if key == "emotion":
            actual = output["invoked"]["emotion"]
            if not condition(actual):
                print(f"❌ emotion: expected {condition.__name__}, got {actual}")
                passed = False
            else:
                print(f"✓ emotion: {actual}")
        
        elif key == "valence":
            actual = output["invoked"]["valence"]
            if not condition(actual):
                print(f"❌ valence: expected {condition.__name__}, got {actual}")
                passed = False
            else:
                print(f"✓ valence: {actual}")
        
        elif key == "arousal":
            actual = output["invoked"]["arousal"]
            if not condition(actual):
                print(f"❌ arousal: expected {condition.__name__}, got {actual}")
                passed = False
            else:
                print(f"✓ arousal: {actual}")
        
        elif key == "tone":
            actual = output["expressed"]["tone"]
            if not condition(actual):
                print(f"❌ tone: expected {condition.__name__}, got {actual}")
                passed = False
            else:
                print(f"✓ tone: {actual}")
        
        elif key == "risk_flags":
            actual = output["risk_flags"]
            if not condition(actual):
                print(f"❌ risk_flags: expected {condition.__name__}, got {actual}")
                passed = False
            else:
                print(f"✓ risk_flags: {actual}")
        
        elif key == "event_keywords":
            actual = output["event_keywords"]
            if not condition(actual):
                print(f"❌ event_keywords: expected {condition.__name__}, got {actual}")
                passed = False
            else:
                print(f"✓ event_keywords: {actual}")
        
        elif key == "state_positive":
            actual = output["state"]["valence"]
            if not condition(actual):
                print(f"❌ state.valence: expected {condition.__name__}, got {actual}")
                passed = False
            else:
                print(f"✓ state.valence: {actual} (increased)")
    
    # Print full output for inspection
    print(f"\nFull output:")
    print(json.dumps(output, indent=2))
    
    return passed


def main():
    """Run all test cases."""
    print("\n" + "="*60)
    print("BEHAVIORAL BACKEND - ACCEPTANCE TESTS")
    print("="*60)
    
    all_passed = True
    
    # Test 1: Positive social event
    all_passed &= run_test(
        name="Positive Social Event",
        user="test_user_1",
        text="Met my friends after many days; felt great and lighter.",
        expectations={
            "emotion": lambda e: e in ["joy", "contentment", "excitement"],
            "valence": lambda v: v > 0.5,
            "tone": lambda t: t == "positive",
            "risk_flags": lambda r: len(r) == 0,
        }
    )
    
    # Test 2: Work stress
    all_passed &= run_test(
        name="Work Stress",
        user="test_user_2",
        text="Boss rebuked me. I went home early and slept.",
        expectations={
            "valence": lambda v: v < 0,
            "tone": lambda t: t == "negative",
        }
    )
    
    # Test 3: Neutral routine
    all_passed &= run_test(
        name="Neutral Routine",
        user="test_user_3",
        text="Had lunch at my desk, lots of work to finish by evening.",
        expectations={
            "emotion": lambda e: e in ["neutral", "contentment"],
            "arousal": lambda a: a < 0.5,
            "event_keywords": lambda k: any(word in ["lunch", "desk", "work"] for word in k),
        }
    )
    
    # Test 4: Risk detection
    all_passed &= run_test(
        name="Risk Detection",
        user="test_user_4",
        text="I wish I were dead. Nothing matters.",
        expectations={
            "risk_flags": lambda r: len(r) > 0 and ("self_harm" in r or "hopelessness" in r),
            "valence": lambda v: v < -0.3,
        }
    )
    
    # Summary
    print("\n" + "="*60)
    if all_passed:
        print("✅ ALL TESTS PASSED")
        print("="*60)
        sys.exit(0)
    else:
        print("❌ SOME TESTS FAILED")
        print("="*60)
        sys.exit(1)


if __name__ == "__main__":
    main()
