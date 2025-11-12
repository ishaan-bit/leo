"""
Golden Set Diagnostic Tool

Analyzes failures in golden set evaluation to identify systematic issues.
Prints detailed mismatches for debugging.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from test_golden_set import load_full_golden_set, evaluate_example


def diagnose_failures(max_examples: int = 10):
    """
    Print detailed diagnostics for failed examples.
    
    Args:
        max_examples: Maximum number of failures to print per category
    """
    examples = load_full_golden_set()
    
    print("=" * 80)
    print("GOLDEN SET DIAGNOSTIC REPORT")
    print("=" * 80)
    
    failures_by_type = {
        "primary": [],
        "secondary": [],
        "domain": []
    }
    
    for example in examples:
        result = evaluate_example(example)
        
        if "error" in result:
            print(f"\n❌ ERROR in {result['example_id']}: {result['error']}")
            continue
        
        # Collect failures
        if not result["correctness"]["primary"]:
            failures_by_type["primary"].append(result)
        
        if not result["correctness"]["secondary"]:
            failures_by_type["secondary"].append(result)
        
        if not result["correctness"]["domain"]:
            failures_by_type["domain"].append(result)
    
    # Print primary failures
    print(f"\n{'='*80}")
    print(f"PRIMARY EMOTION FAILURES ({len(failures_by_type['primary'])} total)")
    print("=" * 80)
    
    for i, result in enumerate(failures_by_type["primary"][:max_examples], 1):
        print(f"\n[{i}] {result['example_id']} ({result['category']})")
        print(f"Text: \"{result['text']}\"")
        print(f"Expected: {result['expected']['primary']}")
        print(f"Actual:   {result['actual']['primary']}")
        print(f"Valence:  {result['scores']['emotion_valence']:.3f}")
        print(f"Domain:   {result['actual']['domain']}")
    
    # Print secondary failures
    print(f"\n{'='*80}")
    print(f"SECONDARY EMOTION FAILURES ({len(failures_by_type['secondary'])} total)")
    print("=" * 80)
    
    for i, result in enumerate(failures_by_type["secondary"][:max_examples], 1):
        if result["expected"]["secondary"] is None:
            continue  # Skip if no secondary expected
        
        print(f"\n[{i}] {result['example_id']} ({result['category']})")
        print(f"Text: \"{result['text']}\"")
        print(f"Primary:  {result['actual']['primary']}")
        print(f"Expected Secondary: {result['expected']['secondary']}")
        print(f"Actual Secondary:   {result['actual']['secondary']}")
    
    # Print domain failures
    print(f"\n{'='*80}")
    print(f"DOMAIN FAILURES ({len(failures_by_type['domain'])} total)")
    print("=" * 80)
    
    for i, result in enumerate(failures_by_type["domain"][:max_examples], 1):
        print(f"\n[{i}] {result['example_id']} ({result['category']})")
        print(f"Text: \"{result['text']}\"")
        print(f"Expected Domain: {result['expected']['domain']}")
        print(f"Actual Domain:   {result['actual']['domain']}")
    
    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print("=" * 80)
    total = len(examples)
    print(f"Total Examples: {total}")
    print(f"Primary Failures: {len(failures_by_type['primary'])} ({len(failures_by_type['primary'])/total*100:.1f}%)")
    print(f"Secondary Failures: {len(failures_by_type['secondary'])} ({len(failures_by_type['secondary'])/total*100:.1f}%)")
    print(f"Domain Failures: {len(failures_by_type['domain'])} ({len(failures_by_type['domain'])/total*100:.1f}%)")
    
    # Category analysis
    print(f"\n{'='*80}")
    print("FAILURE PATTERNS BY CATEGORY")
    print("=" * 80)
    
    category_failures = {}
    for result in failures_by_type["primary"]:
        cat = result["category"]
        if cat not in category_failures:
            category_failures[cat] = []
        category_failures[cat].append(result)
    
    for category in sorted(category_failures.keys()):
        failures = category_failures[category]
        print(f"\n{category} ({len(failures)} failures):")
        
        # Show common patterns
        actual_emotions = {}
        for f in failures:
            actual = f["actual"]["primary"]
            actual_emotions[actual] = actual_emotions.get(actual, 0) + 1
        
        print("  Common actual emotions:")
        for emotion, count in sorted(actual_emotions.items(), key=lambda x: -x[1])[:3]:
            print(f"    - {emotion}: {count}x")


if __name__ == "__main__":
    diagnose_failures(max_examples=15)
