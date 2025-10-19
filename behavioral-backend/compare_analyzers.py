"""
Compare rule-based vs phi-3 hybrid emotion analysis

Run this after installing Ollama to see the quality difference.
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from analyzer import analyze_reflection as baseline_analyze
from hybrid_analyzer import HybridAnalyzer

# Test cases showing where hybrid should excel
test_cases = [
    {
        "text": "I'm not angry, just disappointed",
        "expected_hybrid": "disappointment (understands negation)",
        "expected_baseline": "anger (keyword match)"
    },
    {
        "text": "Everything feels hopeless. I can't do this anymore.",
        "expected_hybrid": "hopelessness (strong negative valence)",
        "expected_baseline": "neutral or low valence (misses intensity)"
    },
    {
        "text": "I think I ended up spending a lot of money last month and also lost my job, I am strained financially.",
        "expected_hybrid": "anxiety (deeper understanding of severity)",
        "expected_baseline": "anxiety (keyword match only)"
    },
    {
        "text": "Great. Just great. Another day ruined.",
        "expected_hybrid": "anger/frustration (detects sarcasm)",
        "expected_baseline": "joy (detects 'great' keyword)"
    },
    {
        "text": "I never cry, but yesterday I did",
        "expected_hybrid": "sadness (understands suppression)",
        "expected_baseline": "neutral or weak signal"
    }
]

print("=" * 80)
print("RULE-BASED vs PHI-3 HYBRID COMPARISON")
print("=" * 80)

# Initialize hybrid analyzer
print("\nInitializing hybrid analyzer...")
analyzer = HybridAnalyzer(use_llm=True, enable_temporal=False)

if not analyzer.use_llm:
    print("\n⚠️  WARNING: Ollama not connected - hybrid will match baseline")
    print("Install Ollama and run: ollama serve")
    print("Then: ollama pull phi3")
    print("\nContinuing with comparison anyway...\n")
else:
    print("✓ Ollama connected - phi-3 ready\n")

for i, case in enumerate(test_cases, 1):
    print(f"\n{'=' * 80}")
    print(f"TEST CASE {i}/{len(test_cases)}")
    print(f"{'=' * 80}")
    print(f"\nText: \"{case['text']}\"")
    print(f"\nExpected:")
    print(f"  Baseline: {case['expected_baseline']}")
    print(f"  Hybrid:   {case['expected_hybrid']}")
    
    # Run baseline
    baseline_result = baseline_analyze(case['text'])
    
    # Run hybrid
    hybrid_result = analyzer.analyze_reflection(case['text'], "test_user")
    
    baseline_data = baseline_result['invoked']
    hybrid_data = hybrid_result['hybrid']['invoked']
    llm_used = hybrid_result['llm_used']
    
    print(f"\n{'-' * 80}")
    print("ACTUAL RESULTS:")
    print(f"{'-' * 80}")
    
    print(f"\n📊 BASELINE (Rule-Based):")
    print(f"  Emotion:     {baseline_data['emotion']}")
    print(f"  Valence:     {baseline_data['valence']:.3f}  (-1=negative, +1=positive)")
    print(f"  Arousal:     {baseline_data['arousal']:.3f}  (0=calm, 1=intense)")
    print(f"  Confidence:  {baseline_data.get('confidence', 0.5):.3f}")
    
    print(f"\n🧠 HYBRID (Phi-3 Enhanced): {'[LLM ACTIVE]' if llm_used else '[LLM FALLBACK]'}")
    print(f"  Emotion:     {hybrid_data['emotion']}")
    print(f"  Valence:     {hybrid_data['valence']:.3f}  ", end="")
    
    # Show difference
    val_diff = hybrid_data['valence'] - baseline_data['valence']
    if abs(val_diff) > 0.05:
        if val_diff > 0:
            print(f"(↑ +{val_diff:.3f} more positive)")
        else:
            print(f"(↓ {val_diff:.3f} more negative)")
    else:
        print("(same as baseline)")
    
    print(f"  Arousal:     {hybrid_data['arousal']:.3f}  ", end="")
    
    arousal_diff = hybrid_data['arousal'] - baseline_data['arousal']
    if abs(arousal_diff) > 0.05:
        if arousal_diff > 0:
            print(f"(↑ +{arousal_diff:.3f} more intense)")
        else:
            print(f"(↓ {arousal_diff:.3f} calmer)")
    else:
        print("(same as baseline)")
    
    print(f"  Confidence:  {hybrid_data.get('confidence', 0.5):.3f}")
    
    # Analysis
    print(f"\n💡 ANALYSIS:")
    if hybrid_data['emotion'] != baseline_data['emotion']:
        print(f"  ✓ Emotion changed: {baseline_data['emotion']} → {hybrid_data['emotion']}")
        if llm_used:
            print(f"    Phi-3 detected nuance that rules missed")
        else:
            print(f"    (Note: LLM not active, this is still rule-based)")
    else:
        print(f"  → Emotion same: {baseline_data['emotion']}")
    
    if abs(val_diff) > 0.1:
        print(f"  ✓ Valence significantly different ({val_diff:+.3f})")
        if llm_used:
            print(f"    Phi-3 has better contextual understanding")
    elif abs(val_diff) > 0.05:
        print(f"  ~ Valence slightly different ({val_diff:+.3f})")
    else:
        print(f"  → Valence similar (Δ {val_diff:+.3f})")
    
    if not llm_used:
        print(f"\n  ⚠️  LLM was not used - install Ollama to see true hybrid performance")

print(f"\n{'=' * 80}")
print("SUMMARY")
print(f"{'=' * 80}\n")

if analyzer.use_llm:
    print("✅ Phi-3 hybrid is ACTIVE")
    print("\nYou should see differences in:")
    print("  • Emotion labels (better context understanding)")
    print("  • Valence scores (more accurate sentiment)")
    print("  • Arousal levels (better intensity detection)")
    print("\nThe hybrid analyzer excels at:")
    print("  ✓ Detecting sarcasm and negation")
    print("  ✓ Understanding implicit emotions")
    print("  ✓ Contextual interpretation")
    print("  ✓ Severity/intensity calibration")
else:
    print("⚠️  Phi-3 hybrid is NOT ACTIVE (Ollama not running)")
    print("\nTo enable phi-3:")
    print("  1. Install Ollama: https://ollama.ai/download")
    print("  2. Run: ollama serve")
    print("  3. Run: ollama pull phi3")
    print("  4. Re-run this script")
    print("\nWithout LLM, hybrid = baseline (same values)")

print(f"\n{'=' * 80}\n")
