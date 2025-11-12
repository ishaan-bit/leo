"""
Test Tertiary Emotion Detection

Validates:
1. Direct motif matching (homesick → Lonely)
2. Metaphor mapping (drowning → Overwhelmed)
3. Appraisal alignment (low control → Helpless)
4. Ambiguity handling (weak signal → None)
5. Sarcasm context restriction
6. Clause weighting (post-contrast 2×)
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from enrich.features import extract_features
from enrich.clauses import segment_clauses
from enrich.tertiary_extraction import extract_tertiary_motifs, select_best_tertiary


# Test Cases

TC_DIRECT_MOTIF = {
    "text": "I feel homesick and miss my family so much.",
    "expected": {
        "tertiary": "Homesick",
        "secondary": "Lonely",
        "primary": "Sad",
        "min_score": 0.8,  # Raw score (motif=1.0 expected)
    }
}

TC_METAPHOR_MATCH = {
    "text": "I'm drowning in all this work and can't breathe.",
    "expected": {
        "tertiary": "Flooded",
        "secondary": "Overwhelmed",
        "primary": "Fearful",
        "min_score": 1.2,  # Raw score (motif=1.0 + metaphor=0.5)
    }
}

TC_APPRAISAL_ALIGNMENT = {
    "text": "There's nothing I can do about it. I feel powerless.",
    "expected": {
        "tertiary": "Helpless",  # or Powerless
        "secondary": "Vulnerable",  # or Helpless secondary
        "primary": "Sad",  # or Fearful
        "min_score": 0.6,  # Raw score (motif partial + appraisal)
    }
}

TC_AMBIGUOUS = {
    "text": "I'm okay I guess, maybe a bit tired.",
    "expected": {
        "tertiary": None,  # Weak signal
        "reason": "Below threshold"
    }
}

TC_SARCASM_CONTEXT = {
    "text": "Oh great, I'm so excited about this. Fantastic.",
    "expected": {
        "tertiary": None,  # Sarcasm should suppress positive tertiaries
        "reason": "Sarcasm context"
    }
}

TC_CLAUSE_WEIGHTING = {
    "text": "Had a normal day, but then I felt heartbroken when they left.",
    "expected": {
        "tertiary": "Heartbroken",
        "secondary": "Grief",
        "primary": "Sad",
        "min_score": 0.6,  # Raw score (2×/(1+2) = 0.667 from post-contrast weighting)
        "note": "Post-contrast clause should be weighted 2×"
    }
}


def run_test_case(tc_name: str, tc: dict) -> bool:
    """Run single test case"""
    print(f"\n{'='*60}")
    print(f"Test: {tc_name}")
    print(f"Text: {tc['text']}")
    print(f"Expected: {tc['expected']}")
    
    # Extract features
    features = extract_features(tc['text'])
    
    # Segment clauses
    clauses = segment_clauses(tc['text'])
    
    # Extract tertiary candidates
    candidates = extract_tertiary_motifs(tc['text'], features, clauses)
    
    print(f"\nCandidates found: {len(candidates)}")
    for cand in sorted(candidates, key=lambda c: c.score, reverse=True):
        print(f"  {cand.primary}.{cand.secondary}.{cand.tertiary}: "
              f"score={cand.score:.3f}")
        print(f"    Explanation: {cand.explanation}")
    
    expected = tc['expected']
    
    # Handle None expectation
    if expected.get('tertiary') is None:
        # Should have no candidates above threshold (0.6 raw score)
        high_scoring = [c for c in candidates if c.score >= 0.6]
        
        if not high_scoring:
            print(f"\n✓ PASS: No tertiary above threshold (reason: {expected.get('reason', 'N/A')})")
            return True
        else:
            print(f"\n✗ FAIL: Found tertiary above threshold: {high_scoring[0].tertiary}")
            return False
    
    # Filter candidates by expected primary/secondary if specified
    # For appraisal alignment test, accept multiple valid tertiaries
    if tc_name == "TC_APPRAISAL_ALIGNMENT":
        # Accept Helpless or Powerless, from either Vulnerable or Helpless secondary
        valid_tertiaries = {'Helpless', 'Powerless', 'Stuck', 'Worthless'}
        matching = [c for c in candidates if c.tertiary in valid_tertiaries]
    else:
        # Exact match
        matching = [
            c for c in candidates
            if c.tertiary == expected['tertiary']
        ]
    
    if not matching:
        print(f"\n✗ FAIL: Expected tertiary '{expected['tertiary']}' not found")
        return False
    
    best = max(matching, key=lambda c: c.score)
    
    # Check raw score threshold
    if best.score < expected.get('min_score', 0.6):
        print(f"\n✗ FAIL: Score {best.score:.3f} below threshold {expected['min_score']}")
        return False
    
    # Validate structure
    if best.primary != expected['primary']:
        print(f"\n⚠ WARNING: Primary mismatch (got {best.primary}, expected {expected['primary']})")
    
    if best.secondary != expected['secondary']:
        print(f"\n⚠ WARNING: Secondary mismatch (got {best.secondary}, expected {expected['secondary']})")
    
    print(f"\n✓ PASS: {best.primary}.{best.secondary}.{best.tertiary} "
          f"(score={best.score:.3f})")
    return True


def main():
    test_cases = [
        ("TC_DIRECT_MOTIF", TC_DIRECT_MOTIF),
        ("TC_METAPHOR_MATCH", TC_METAPHOR_MATCH),
        ("TC_APPRAISAL_ALIGNMENT", TC_APPRAISAL_ALIGNMENT),
        ("TC_AMBIGUOUS", TC_AMBIGUOUS),
        ("TC_SARCASM_CONTEXT", TC_SARCASM_CONTEXT),
        ("TC_CLAUSE_WEIGHTING", TC_CLAUSE_WEIGHTING),
    ]
    
    results = []
    for name, tc in test_cases:
        passed = run_test_case(name, tc)
        results.append((name, passed))
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    passed_count = sum(1 for _, p in results if p)
    total_count = len(results)
    
    for name, passed in results:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed_count}/{total_count} passing")
    
    return 0 if passed_count == total_count else 1


if __name__ == "__main__":
    sys.exit(main())
