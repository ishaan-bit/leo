"""Quick test of hybrid analyzer with phi-3"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from hybrid_analyzer import HybridAnalyzer

print("=" * 80)
print("TESTING PHI-3 HYBRID ANALYZER")
print("=" * 80)

# Initialize
analyzer = HybridAnalyzer(use_llm=True, enable_temporal=False)

if not analyzer.use_llm:
    print("\n⚠️  LLM not available, test will fallback to baseline\n")
else:
    print("\n✓ Phi-3 LLM ready for testing\n")

# Simple test
test_text = "I feel anxious about work deadlines"
print(f"Test text: \"{test_text}\"\n")
print("Analyzing... (phi-3 may take 10-30 seconds)\n")

result = analyzer.analyze_reflection(test_text, "test_user")

print("=" * 80)
print("RESULTS:")
print("=" * 80)

baseline = result['baseline']['invoked']
hybrid = result['hybrid']['invoked']
llm_used = result['llm_used']

print(f"\n📊 BASELINE (Rules):")
print(f"  Emotion:     {baseline['emotion']}")
print(f"  Valence:     {baseline['valence']:.3f}")
print(f"  Arousal:     {baseline['arousal']:.3f}")
print(f"  Confidence:  {baseline.get('confidence', 0.5):.3f}")

print(f"\n🧠 HYBRID (Phi-3): {'[ACTIVE]' if llm_used else '[FALLBACK]'}")
print(f"  Emotion:     {hybrid['emotion']}")
print(f"  Valence:     {hybrid['valence']:.3f}")
print(f"  Arousal:     {hybrid['arousal']:.3f}")
print(f"  Confidence:  {hybrid.get('confidence', 0.5):.3f}")

if llm_used:
    val_diff = hybrid['valence'] - baseline['valence']
    arousal_diff = hybrid['arousal'] - baseline['arousal']
    
    print(f"\n💡 DIFFERENCES:")
    print(f"  Valence:  {val_diff:+.3f}")
    print(f"  Arousal:  {arousal_diff:+.3f}")
    
    if abs(val_diff) > 0.05 or abs(arousal_diff) > 0.05:
        print(f"\n✅ SUCCESS! Phi-3 is providing different (better) values!")
    else:
        print(f"\n⚠️  Values are similar - phi-3 agrees with baseline")
else:
    print(f"\n⚠️  LLM was not used - check Ollama connection")

print("\n" + "=" * 80)
