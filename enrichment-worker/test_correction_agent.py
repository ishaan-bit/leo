"""
Test Enrichment Correction Agent
Validates iterative refinement against expected gold values

Usage:
    python test_correction_agent.py [--sample-size N] [--verbose]
    
Example:
    python test_correction_agent.py --sample-size 5 --verbose
"""

import sys
import json
import argparse
from pathlib import Path

# Add modules to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from modules.correction_agent import CorrectionAgent
from modules.expected_references import EXPECTED_REFERENCES


# Sample "bad" enrichments (simulating current Ollama output with discrepancies)
SAMPLE_BAD_ENRICHMENTS = [
    {
        "rid": "refl_1761019709686_m5ifk30g0",
        "raw": {"text": "Finally completed that thing I've been avoiding for weeks. Feel lighter now."},
        "valence": 0.0,  # Rule #3: disagreement
        "arousal": 0.0,  # Rule #3: disagreement
        "confidence": 0.02,  # Rule #7: under-confidence
        "final": {
            "invoked": "['fatigue', 'irritation', 'low_progress']",  # Rule #1: contamination + Rule #6: type mismatch
            "expressed": "[]",
            "wheel": {"primary": "joy", "secondary": "disgust"},  # Rule #2: incoherence
            "valence": 0.65,
            "arousal": 0.45,
            "confidence": 0.8
        },
        "congruence": 0.5,  # Rule #8: flatline
        "risk_signals_weak": [],  # Rule #9: missing risk signals
        "typing": {"duration_ms": 0, "wpm": 0},  # Rule #10: telemetry nonsense
        "lang_detected": "mixed",  # Rule #11: language inconsistency
        "timezone": "UTC",  # Rule #12: schema integrity
        "ema": {"v_1d": 0.5, "v_7d": 0.5, "v_28d": 0.5}  # Rule #5: non-evolution
    },
    {
        "rid": "refl_1761019797463_xwvxjhk40",
        "raw": {"text": "I can't keep up with everything. It's too much pressure."},
        "valence": 0.25,
        "arousal": 0.7,
        "confidence": 0.75,
        "final": {
            "invoked": "['fatigue', 'irritation', 'low_progress']",  # Rule #1: contamination
            "expressed": "['tense']",  # Rule #6: stringified
            "wheel": {"primary": "anger", "secondary": "joy"},  # Rule #2: incoherent pairing
            "valence": 0.25,
            "arousal": 0.7,
            "confidence": 0.75
        },
        "congruence": 0.5,
        "risk_signals_weak": [],
        "typing": {"duration_ms": 15000, "wpm": 45},
        "lang_detected": "english",
        "timezone": "Asia/Kolkata",
        "ema": {"v_1d": 0.3, "v_7d": 0.32, "v_28d": 0.35}
    },
    {
        "rid": "refl_1761019848190_9w95qbyzg",
        "raw": {"text": "Laughed so hard with my friends today. Felt so good to just be silly together."},
        "valence": 0.9,
        "arousal": 0.7,
        "confidence": 0.9,
        "final": {
            "invoked": ["joy", "belonging"],
            "expressed": ["playful", "light"],
            "wheel": {"primary": "joy", "secondary": "trust"},  # Close enough
            "valence": 0.9,
            "arousal": 0.7,
            "confidence": 0.9
        },
        "congruence": 0.75,
        "risk_signals_weak": [],
        "typing": {"duration_ms": 12000, "wpm": 52},
        "lang_detected": "english",
        "timezone": "Asia/Kolkata",
        "ema": {"v_1d": 0.85, "v_7d": 0.78, "v_28d": 0.72}
    },
    {
        "rid": "refl_1761019945179_wpycbwnu3",
        "raw": {"text": "Sometimes I just want to disappear and not deal with anything anymore."},
        "valence": 0.15,
        "arousal": 0.4,
        "confidence": 0.7,
        "final": {
            "invoked": ["exhaustion", "withdrawal"],
            "expressed": ["defeated"],
            "wheel": {"primary": "sadness", "secondary": "fear"},
            "valence": 0.15,
            "arousal": 0.4,
            "confidence": 0.7
        },
        "congruence": 0.65,
        "risk_signals_weak": [],  # Rule #9: should detect withdrawal pattern
        "typing": {"duration_ms": 18000, "wpm": 38},
        "lang_detected": "english",
        "timezone": "Asia/Kolkata",
        "ema": {"v_1d": 0.2, "v_7d": 0.25, "v_28d": 0.3}
    },
    {
        "rid": "refl_1761020000288_aknq9sre0",
        "raw": {"text": "The sunset today was absolutely unreal. Just stood there in awe."},
        "valence": 0.85,
        "arousal": 0.55,
        "confidence": 0.9,
        "final": {
            "invoked": ["awe", "serenity"],
            "expressed": ["peaceful"],
            "wheel": {"primary": "surprise", "secondary": "joy"},  # Close but should be awe
            "valence": 0.85,
            "arousal": 0.55,
            "confidence": 0.9
        },
        "congruence": 0.8,
        "risk_signals_weak": [],
        "typing": {"duration_ms": 10000, "wpm": 48},
        "lang_detected": "english",
        "timezone": "Asia/Kolkata",
        "ema": {"v_1d": 0.75, "v_7d": 0.68, "v_28d": 0.62}
    }
]


def print_comparison(before, after, expected, rid):
    """Print before/after comparison"""
    print(f"\n{'='*80}")
    print(f"RID: {rid}")
    print(f"{'='*80}")
    
    # Valence
    before_val = before.get('final', {}).get('valence', before.get('valence', 0))
    after_val = after.get('final', {}).get('valence', after.get('valence', 0))
    expected_val = expected.get('final', {}).get('valence', 0)
    
    print(f"\nValence:")
    print(f"  Before:   {before_val:.2f}")
    print(f"  After:    {after_val:.2f}")
    print(f"  Expected: {expected_val:.2f}")
    print(f"  Error:    {abs(after_val - expected_val):.3f}")
    
    # Arousal
    before_ar = before.get('final', {}).get('arousal', before.get('arousal', 0))
    after_ar = after.get('final', {}).get('arousal', after.get('arousal', 0))
    expected_ar = expected.get('final', {}).get('arousal', 0)
    
    print(f"\nArousal:")
    print(f"  Before:   {before_ar:.2f}")
    print(f"  After:    {after_ar:.2f}")
    print(f"  Expected: {expected_ar:.2f}")
    print(f"  Error:    {abs(after_ar - expected_ar):.3f}")
    
    # Wheel
    before_wheel = before.get('final', {}).get('wheel', {}).get('primary', 'N/A')
    after_wheel = after.get('final', {}).get('wheel', {}).get('primary', 'N/A')
    expected_wheel = expected.get('final', {}).get('wheel', {}).get('primary', 'N/A')
    
    print(f"\nWheel Primary:")
    print(f"  Before:   {before_wheel}")
    print(f"  After:    {after_wheel}")
    print(f"  Expected: {expected_wheel}")
    print(f"  Match:    {'✓' if after_wheel == expected_wheel else '✗'}")
    
    # Invoked
    before_inv = before.get('final', {}).get('invoked', [])
    after_inv = after.get('final', {}).get('invoked', [])
    expected_inv = expected.get('final', {}).get('invoked', [])
    
    print(f"\nInvoked Events:")
    print(f"  Before:   {before_inv}")
    print(f"  After:    {after_inv}")
    print(f"  Expected: {expected_inv}")
    
    # Risk signals
    after_risk = after.get('risk_signals_weak', [])
    expected_risk = expected.get('risk_signals_weak', [])
    
    if expected_risk:
        print(f"\nRisk Signals:")
        print(f"  After:    {after_risk}")
        print(f"  Expected: {expected_risk}")
        print(f"  Match:    {'✓' if set(after_risk) == set(expected_risk) else '✗'}")


def main():
    parser = argparse.ArgumentParser(description='Test Enrichment Correction Agent')
    parser.add_argument('--sample-size', type=int, default=5, help='Number of reflections to test')
    parser.add_argument('--verbose', action='store_true', help='Print detailed comparisons')
    args = parser.parse_args()
    
    print("🧪 Testing Enrichment Correction Agent")
    print(f"📊 Sample size: {args.sample_size}")
    print(f"🎯 Convergence threshold: 0.05")
    print()
    
    # Initialize correction agent
    agent = CorrectionAgent(max_iterations=5, convergence_threshold=0.05)
    
    # Get sample data
    sample_bad = SAMPLE_BAD_ENRICHMENTS[:args.sample_size]
    sample_expected = [ref for ref in EXPECTED_REFERENCES if ref['rid'] in [s['rid'] for s in sample_bad]]
    
    # Correct batch
    print("⚙️  Running correction agent...")
    corrected = agent.correct_batch(sample_bad, sample_expected)
    
    # Print comparisons
    if args.verbose:
        for i, (before, after, expected) in enumerate(zip(sample_bad, corrected, sample_expected)):
            print_comparison(before, after, expected, expected['rid'])
    
    # Validate batch
    print(f"\n{'='*80}")
    print("📈 VALIDATION RESULTS")
    print(f"{'='*80}\n")
    
    validation = agent.validate_batch(corrected, sample_expected)
    
    print(f"Status:               {'✅ PASSED' if validation['passed'] else '❌ FAILED'}")
    print(f"Mean Diff Score:      {validation['mean_diff_score']:.4f} (threshold: {validation['threshold']})")
    print(f"Mean Valence Error:   {validation['mean_valence_error']:.4f}")
    print(f"Mean Arousal Error:   {validation['mean_arousal_error']:.4f}")
    print(f"Wheel Accuracy:       {validation['wheel_accuracy']:.1%}")
    print(f"Total Reflections:    {validation['total_reflections']}")
    
    if validation['passed']:
        print("\n🎉 Correction agent successfully converged to expected values!")
    else:
        print("\n⚠️  Correction agent did not fully converge. Consider:")
        print("   - Increasing max_iterations")
        print("   - Adjusting individual rule logic")
        print("   - Reviewing expected reference values")
    
    # Save corrected output
    output_file = Path(__file__).parent / 'data' / 'corrected_enrichments.json'
    output_file.parent.mkdir(exist_ok=True)
    
    with open(output_file, 'w') as f:
        json.dump({
            'corrected': corrected,
            'validation': validation,
            'timestamp': str(Path(__file__).stat().st_mtime)
        }, f, indent=2)
    
    print(f"\n💾 Corrected enrichments saved to: {output_file}")


if __name__ == '__main__':
    main()
