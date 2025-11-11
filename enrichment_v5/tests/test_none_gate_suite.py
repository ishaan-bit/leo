#!/usr/bin/env python3
"""
Test suite for None gate disabled mode (use_none_gate=False).

Tests:
- Work/Aggressive emotion detection
- Sarcasm + work context
- Low-signal routines → Peaceful/Serene (not None)
- Control cases (positive work outcomes)

Expected behavior with None gate OFF:
- Zero None returns (all low-signal → Peaceful/Serene/soft)
- Work + aggressive language → Angry ≥90% recall
- Sarcasm preserved through detection
"""

import json
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from enrich.full_pipeline import enrich


def load_test_cases(jsonl_path):
    """Load test cases from JSONL file."""
    cases = []
    with open(jsonl_path, 'r') as f:
        for line in f:
            if line.strip():
                cases.append(json.loads(line))
    return cases


def run_test_suite(test_file, use_none_gate=False):
    """
    Run test suite with specified None gate setting.
    
    Args:
        test_file: Path to JSONL test file
        use_none_gate: Feature flag value (False to test fallback)
    """
    print("="*80)
    print(f"TEST SUITE: None Gate OFF (use_none_gate={use_none_gate})")
    print("="*80)
    print()
    
    cases = load_test_cases(test_file)
    
    results = {
        'total': len(cases),
        'passed': 0,
        'failed': 0,
        'none_count': 0,
        'work_aggressive_correct': 0,
        'work_aggressive_total': 0,
        'failures': []
    }
    
    for i, case in enumerate(cases, 1):
        text = case['text']
        expected_primary = case['expected_primary']
        expected_domain = case.get('expected_domain')
        category = case.get('category', 'unknown')
        description = case.get('description', '')
        
        print(f"\n[{i}/{len(cases)}] {category}")
        print(f"Text: {text[:80]}...")
        print(f"Expected: {expected_primary} | Domain: {expected_domain}")
        
        # Run enrichment with None gate OFF
        result = enrich(text, use_none_gate=use_none_gate)
        
        actual_primary = result['wheel']['primary']
        actual_domain = result.get('domain', {}).get('primary', 'unknown')
        emotion_presence = result.get('emotion_presence')
        
        print(f"Actual:   {actual_primary} | Domain: {actual_domain} | Emotion presence: {emotion_presence}")
        
        # Check for None returns (should be ZERO with gate off)
        if actual_primary is None or actual_primary == 'None':
            results['none_count'] += 1
            print("❌ FAIL: Returned None (gate should prevent this!)")
            results['failures'].append({
                'case': i,
                'text': text[:60],
                'reason': 'Returned None with gate OFF',
                'expected': expected_primary,
                'actual': actual_primary
            })
            results['failed'] += 1
            continue
        
        # Track work/aggressive cases
        if 'work_aggressive' in category:
            results['work_aggressive_total'] += 1
            if actual_primary == expected_primary:
                results['work_aggressive_correct'] += 1
        
        # Check primary emotion match
        primary_match = actual_primary == expected_primary
        
        # Allow some flexibility for near-positive cases
        if 'near_positive' in category:
            # Accept Angry, Sad, or Strong as reasonable
            if actual_primary in ['Angry', 'Sad', 'Strong']:
                primary_match = True
        
        # Check domain match (if specified)
        domain_match = True
        if expected_domain:
            domain_match = actual_domain == expected_domain
        
        if primary_match and domain_match:
            print("✅ PASS")
            results['passed'] += 1
        else:
            print(f"❌ FAIL: Expected {expected_primary}/{expected_domain}, got {actual_primary}/{actual_domain}")
            results['failures'].append({
                'case': i,
                'text': text[:60],
                'category': category,
                'expected': f"{expected_primary}/{expected_domain}",
                'actual': f"{actual_primary}/{actual_domain}",
                'description': description
            })
            results['failed'] += 1
    
    # Print summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total:  {results['total']}")
    print(f"Passed: {results['passed']} ({results['passed']/results['total']*100:.1f}%)")
    print(f"Failed: {results['failed']} ({results['failed']/results['total']*100:.1f}%)")
    print()
    print(f"None returns: {results['none_count']} (should be 0 with gate OFF)")
    print()
    
    if results['work_aggressive_total'] > 0:
        work_recall = results['work_aggressive_correct'] / results['work_aggressive_total'] * 100
        print(f"Work/Aggressive recall: {results['work_aggressive_correct']}/{results['work_aggressive_total']} ({work_recall:.1f}%)")
        print(f"Target: ≥90% recall")
        if work_recall >= 90:
            print("✅ Work/Aggressive recall TARGET MET")
        else:
            print("❌ Work/Aggressive recall BELOW TARGET")
    print()
    
    # Print failures
    if results['failures']:
        print("\nFAILURES:")
        print("-"*80)
        for fail in results['failures']:
            print(f"[{fail['case']}] {fail.get('category', 'N/A')}")
            print(f"  Text: {fail['text']}...")
            print(f"  Expected: {fail['expected']}")
            print(f"  Actual:   {fail['actual']}")
            if 'description' in fail:
                print(f"  Note: {fail['description']}")
            print()
    
    # Overall assessment
    print("="*80)
    none_pass = results['none_count'] == 0
    work_pass = (results['work_aggressive_total'] == 0 or 
                 results['work_aggressive_correct'] / results['work_aggressive_total'] >= 0.9)
    overall_pass = results['passed'] / results['total'] >= 0.75  # 75% threshold
    
    if none_pass and work_pass and overall_pass:
        print("✅ TEST SUITE PASSED")
        return 0
    else:
        print("❌ TEST SUITE FAILED")
        if not none_pass:
            print(f"   - None gate failed: {results['none_count']} None returns")
        if not work_pass:
            print(f"   - Work/Aggressive recall below 90%")
        if not overall_pass:
            print(f"   - Overall accuracy below 75%")
        return 1


if __name__ == '__main__':
    test_file = Path(__file__).parent / 'test_none_gate_off.jsonl'
    
    if not test_file.exists():
        print(f"Error: Test file not found: {test_file}")
        sys.exit(1)
    
    exit_code = run_test_suite(test_file, use_none_gate=False)
    sys.exit(exit_code)
