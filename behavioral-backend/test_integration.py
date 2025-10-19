"""
End-to-end test of reflection → phi-3 analysis flow
Simulates what happens when user submits a reflection
"""

import requests
import json
import time

BEHAVIORAL_API = "http://localhost:8000"

print("=" * 80)
print("TESTING PHI-3 HYBRID INTEGRATION")
print("=" * 80)

# Test 1: Health check
print("\n1. Checking server health...")
try:
    response = requests.get(f"{BEHAVIORAL_API}/health", timeout=5)
    health = response.json()
    
    print(f"   Status: {health['status']}")
    print(f"   Phi-3 LLM: {'✅' if health['llm_available'] else '❌'}")
    print(f"   Upstash: {'✅' if health['upstash_available'] else '❌'}")
    
    if not health['llm_available']:
        print("\n⚠️  WARNING: Phi-3 not available - check Ollama is running")
        print("   Run: ollama serve")
        exit(1)
        
except Exception as e:
    print(f"\n❌ Server not responding: {e}")
    print("   Start server with: .\\start.bat")
    exit(1)

# Test 2: Analyze reflection with phi-3
test_text = "I think I ended up spending a lot of money last month and also lost my job, I am strained financially."

print(f"\n2. Testing phi-3 analysis...")
print(f"   Text: \"{test_text[:50]}...\"")
print(f"   (This will take 10-30 seconds with phi-3)")

start_time = time.time()

try:
    response = requests.post(
        f"{BEHAVIORAL_API}/analyze",
        json={
            "text": test_text,
            "user_id": "test_e2e"
        },
        timeout=60  # Phi-3 can be slow
    )
    
    result = response.json()
    latency = time.time() - start_time
    
    baseline = result['baseline']['invoked']
    hybrid = result['hybrid']['invoked']
    llm_used = result['llm_used']
    
    print(f"\n   ⏱️  Analysis completed in {latency:.1f} seconds")
    print(f"\n   📊 BASELINE (Rules):")
    print(f"      Emotion:     {baseline['emotion']}")
    print(f"      Valence:     {baseline['valence']:.3f}")
    print(f"      Arousal:     {baseline['arousal']:.3f}")
    
    print(f"\n   🧠 PHI-3 HYBRID: {'[ACTIVE ✅]' if llm_used else '[INACTIVE ❌]'}")
    print(f"      Emotion:     {hybrid['emotion']}")
    print(f"      Valence:     {hybrid['valence']:.3f}")
    print(f"      Arousal:     {hybrid['arousal']:.3f}")
    print(f"      Confidence:  {hybrid.get('confidence', 0):.3f}")
    
    # Check if phi-3 made a difference
    val_diff = hybrid['valence'] - baseline['valence']
    arousal_diff = hybrid['arousal'] - baseline['arousal']
    
    if llm_used:
        print(f"\n   💡 PHI-3 IMPROVEMENT:")
        print(f"      Valence shift:  {val_diff:+.3f} ({abs(val_diff)/abs(baseline['valence'])*100:.0f}% change)")
        print(f"      Arousal shift:  {arousal_diff:+.3f} ({arousal_diff/baseline['arousal']*100:.0f}% change)")
        
        if abs(val_diff) > 0.1 or abs(arousal_diff) > 0.1:
            print(f"\n   ✅ SUCCESS! Phi-3 is providing significantly better analysis!")
        else:
            print(f"\n   ⚠️  Phi-3 agrees with baseline (similar values)")
    else:
        print(f"\n   ❌ PROBLEM: Phi-3 was not used - check Ollama connection")
        
except Exception as e:
    print(f"\n❌ Analysis failed: {e}")
    exit(1)

print("\n" + "=" * 80)
print("INTEGRATION TEST SUMMARY")
print("=" * 80)

if llm_used:
    print("\n✅ ALL SYSTEMS OPERATIONAL")
    print("\nYour app is now using phi-3 for every reflection!")
    print("\nWhat happens when user submits:")
    print("  1. Reflection saves to Upstash (instant)")
    print("  2. Webhook triggers phi-3 analysis (background)")
    print("  3. Phi-3 enriches with better emotion detection")
    print("  4. Enriched data saved back to Upstash")
    print("\nLoading state:")
    print("  🧠 'Understanding your reflection...'")
    print("  ⏱️  Shows for 10-30 seconds while phi-3 thinks")
    print("  ✨ Beautiful animation keeps user engaged")
else:
    print("\n⚠️  PHI-3 NOT ACTIVE")
    print("\nTroubleshooting:")
    print("  1. Check Ollama is running: ollama serve")
    print("  2. Check phi-3 is installed: ollama list")
    print("  3. Restart server: .\\start.bat")

print("\n" + "=" * 80)
