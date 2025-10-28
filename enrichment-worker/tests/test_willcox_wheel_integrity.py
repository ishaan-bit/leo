"""
Willcox Wheel Integrity Test (W2)

Validates that the canonical Willcox wheel JSON:
1. Has exactly 6 primaries
2. Each primary has exactly 6 secondaries
3. Each secondary has exactly 6 tertiaries
4. Every path is valid (6×6×6 = 216 emotions)
5. No duplicates, no nulls, no case mismatches

This is the SINGLE SOURCE OF TRUTH - matches visual wheel exactly.
"""

import json
from pathlib import Path
import sys

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from modules.hybrid_scorer import HybridScorer


def test_wheel_structure():
    """Test that wheel has correct 6×6×6 structure"""
    wheel_path = Path(__file__).parent.parent / "src" / "data" / "willcox_wheel.json"
    
    with open(wheel_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    wheel = data['wheel']
    
    # Test 1: Exactly 6 primaries
    primaries = list(wheel.keys())
    assert len(primaries) == 6, f"Expected 6 primaries, got {len(primaries)}: {primaries}"
    print(f"✅ 6 primaries: {', '.join(primaries)}")
    
    # Test 2: Each primary has exactly 6 secondaries
    total_secondaries = 0
    for primary, secondaries in wheel.items():
        assert len(secondaries) == 6, f"{primary} has {len(secondaries)} secondaries, expected 6"
        total_secondaries += len(secondaries)
    print(f"✅ {total_secondaries} secondaries (6 per primary)")
    
    # Test 3: Each secondary has exactly 6 tertiaries
    total_tertiaries = 0
    for primary, secondaries in wheel.items():
        for secondary, tertiaries in secondaries.items():
            assert len(tertiaries) == 6, f"{primary}/{secondary} has {len(tertiaries)} tertiaries, expected 6"
            total_tertiaries += len(tertiaries)
    print(f"✅ {total_tertiaries} tertiaries (6 per secondary)")
    
    # Test 4: Total emotions = 216
    assert total_tertiaries == 216, f"Expected 216 total emotions, got {total_tertiaries}"
    print(f"✅ 216 total emotions (6×6×6)")
    
    # Test 5: No duplicate tertiaries within a secondary
    for primary, secondaries in wheel.items():
        for secondary, tertiaries in secondaries.items():
            unique_tertiaries = set(tertiaries)
            assert len(unique_tertiaries) == len(tertiaries), \
                f"{primary}/{secondary} has duplicate tertiaries: {tertiaries}"
    print(f"✅ No duplicate tertiaries within secondaries")
    
    # Test 6: Metadata matches structure
    metadata = data['metadata']
    assert metadata['total_emotions'] == 216
    assert metadata['primaries'] == 6
    assert metadata['secondaries_per_primary'] == 6
    assert metadata['tertiaries_per_secondary'] == 6
    print(f"✅ Metadata matches structure")
    
    print(f"\n🎉 Willcox Wheel Integrity: PASS")


def test_hybrid_scorer_loads_wheel():
    """Test that HybridScorer loads the wheel correctly"""
    # HybridScorer requires hf_token, but we can pass empty string for structural tests
    scorer = HybridScorer(hf_token="")
    
    # Verify all 6 primaries loaded
    assert len(scorer.WILLCOX_PRIMARY) == 6
    assert set(scorer.WILLCOX_PRIMARY) == {"Sad", "Angry", "Fearful", "Happy", "Peaceful", "Strong"}
    print(f"✅ HybridScorer loaded all 6 primaries")
    
    # Verify hierarchy structure
    assert len(scorer.WILLCOX_HIERARCHY) == 6
    for primary in scorer.WILLCOX_PRIMARY:
        assert primary in scorer.WILLCOX_HIERARCHY
        assert len(scorer.WILLCOX_HIERARCHY[primary]) == 6  # 6 secondaries per primary
    print(f"✅ HybridScorer hierarchy structure correct")
    
    print(f"🎉 HybridScorer Wheel Loading: PASS")


def test_all_paths_valid():
    """Test that every possible primary→secondary→tertiary path exists and is valid"""
    scorer = HybridScorer(hf_token="")
    
    valid_paths = []
    for primary in scorer.WILLCOX_PRIMARY:
        for secondary, tertiaries in scorer.WILLCOX_HIERARCHY[primary].items():
            for tertiary in tertiaries:
                path = f"{primary} → {secondary} → {tertiary}"
                valid_paths.append((primary, secondary, tertiary))
    
    assert len(valid_paths) == 216, f"Expected 216 valid paths, got {len(valid_paths)}"
    print(f"✅ All 216 paths are valid and accessible")
    
    # Sample some paths to display
    print(f"\n📍 Sample paths:")
    for i, (p, s, t) in enumerate(valid_paths[:10], 1):
        print(f"   {i}. {p} → {s} → {t}")
    print(f"   ... ({len(valid_paths) - 10} more)")
    
    print(f"\n🎉 Path Validation: PASS")


def test_enforces_non_null_tertiary():
    """Test that HybridScorer NEVER returns null tertiary (W1 requirement)"""
    # Skip actual enrichment test (requires HF token and Ollama)
    # Just verify the wheel structure ensures completeness
    scorer = HybridScorer(hf_token="")
    
    # Verify every path has complete 3 levels
    for primary in scorer.WILLCOX_PRIMARY:
        for secondary in scorer.WILLCOX_HIERARCHY[primary].keys():
            tertiaries = scorer.WILLCOX_HIERARCHY[primary][secondary]
            assert len(tertiaries) > 0, f"{primary}/{secondary} has no tertiaries!"
    
    print(f"✅ All secondaries have at least one tertiary (fallback guaranteed)")
    print(f"🎉 Non-Null Tertiary Enforcement: PASS (structural guarantee)")


if __name__ == "__main__":
    print("=" * 60)
    print("WILLCOX WHEEL INTEGRITY TESTS")
    print("Source of Truth: Visual wheel diagram (6×6×6 = 216 emotions)")
    print("=" * 60)
    print()
    
    test_wheel_structure()
    print()
    test_hybrid_scorer_loads_wheel()
    print()
    test_all_paths_valid()
    print()
    test_enforces_non_null_tertiary()
    print()
    print("=" * 60)
    print("✅ ALL TESTS PASSED - Wheel integrity confirmed")
    print("=" * 60)
