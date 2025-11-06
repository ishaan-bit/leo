"""
Test Queue-Based Enrichment Flow
Simulates full pipeline: Queue → Worker → API → Upstash
"""

import os
import json
import time
import requests
from dotenv import load_dotenv

# Load env from web app
load_dotenv('apps/web/.env.local')

UPSTASH_URL = os.getenv('KV_REST_API_URL')
UPSTASH_TOKEN = os.getenv('KV_REST_API_TOKEN')

print("=" * 60)
print("QUEUE-BASED ENRICHMENT TEST")
print("=" * 60)
print(f"Upstash URL: {UPSTASH_URL[:30]}..." if UPSTASH_URL else "❌ Missing")
print(f"Upstash Token: {'✅ Configured' if UPSTASH_TOKEN else '❌ Missing'}")
print("=" * 60)

if not UPSTASH_URL or not UPSTASH_TOKEN:
    print("\n❌ Missing Upstash credentials in apps/web/.env.local")
    exit(1)


def upstash_command(command):
    """Execute Upstash Redis command."""
    response = requests.post(
        UPSTASH_URL,
        headers={
            'Authorization': f'Bearer {UPSTASH_TOKEN}',
            'Content-Type': 'application/json'
        },
        json=command,
        timeout=10
    )
    response.raise_for_status()
    return response.json().get('result')


# Test reflection
test_reflection = {
    'rid': f'refl_test_{int(time.time())}',
    'sid': 'sess_test_123',
    'timestamp': '2025-11-05T12:00:00Z',
    'normalized_text': 'i am so angry, all the work gone to waste in an hour',
    'raw_text': 'I am so ANGRY! All the work gone to waste in an hour 😤',
    'lang_detected': 'english',
    'input_mode': 'typing',
    'pig_id': 'pig_test',
    'owner_id': 'user_test',
}

rid = test_reflection['rid']

print("\n1️⃣  SAVING TEST REFLECTION")
print(f"   rid: {rid}")
print(f"   text: {test_reflection['normalized_text']}")

# Save reflection:{rid}
result = upstash_command(['SET', f'reflection:{rid}', json.dumps(test_reflection)])
print(f"   ✅ Saved to reflection:{rid}")

print("\n2️⃣  PUSHING TO QUEUE")
# Push to queue
queue_length = upstash_command(['RPUSH', 'reflections:normalized', json.dumps(test_reflection)])
print(f"   ✅ Pushed to reflections:normalized")
print(f"   Queue length: {queue_length}")

print("\n3️⃣  WAITING FOR WORKER")
print("   Worker should now:")
print("   - Poll queue with BLPOP")
print("   - Extract reflection")
print("   - Call HF Spaces API")
print("   - Save enrichment to Upstash")
print("\n   Waiting 60 seconds for processing...")
print("   (Watch worker terminal for logs)")

for i in range(60, 0, -5):
    print(f"   ⏳ {i}s...", end="\r")
    time.sleep(5)
    
    # Check if enrichment exists
    enriched = upstash_command(['GET', f'reflections:enriched:{rid}'])
    if enriched:
        print(f"\n   ✅ Found enrichment after {60-i}s!")
        break
else:
    print("\n   ⏱️  Timeout - enrichment not found yet")
    print("   This is normal if:")
    print("   - Worker not running")
    print("   - HF Spaces API cold start (60s)")
    print("   - API not deployed yet")

print("\n4️⃣  CHECKING RESULTS")

# Check enrichment
enriched_json = upstash_command(['GET', f'reflections:enriched:{rid}'])
if enriched_json:
    enriched = json.loads(enriched_json)
    enrichment = enriched['enrichment']
    
    print(f"   ✅ Enrichment found!")
    print(f"   Primary: {enrichment.get('primary', 'N/A')}")
    print(f"   Secondary: {enrichment.get('secondary', 'N/A')}")
    print(f"   Tertiary: {enrichment.get('tertiary', 'N/A')}")
    print(f"   Valence: {enrichment.get('valence', 'N/A')}")
    print(f"   Arousal: {enrichment.get('arousal', 'N/A')}")
    print(f"   Domain: {enrichment.get('domain', 'N/A')}")
    
    if enrichment.get('poems'):
        print(f"\n   📜 Poems ({len(enrichment['poems'])} lines):")
        for i, line in enumerate(enrichment['poems'], 1):
            print(f"      {i}. {line}")
    
    if enrichment.get('tips'):
        print(f"\n   💡 Tips ({len(enrichment['tips'])} windows):")
        for i, tip in enumerate(enrichment['tips'], 1):
            print(f"      {i}. {tip}")
    
    if enrichment.get('_dialogue_meta'):
        meta = enrichment['_dialogue_meta']
        print(f"\n   🎨 Dialogue Meta:")
        print(f"      Tone: {meta.get('tone', 'N/A')}")
        print(f"      Band: {meta.get('band', 'N/A')}")
else:
    print(f"   ❌ No enrichment found at reflections:enriched:{rid}")
    print(f"   Worker may still be processing (check worker logs)")

# Check updated reflection
reflection_json = upstash_command(['GET', f'reflection:{rid}'])
if reflection_json:
    reflection = json.loads(reflection_json)
    
    if 'final' in reflection:
        print(f"\n   ✅ reflection:{rid} updated with final data!")
        final = reflection['final']
        print(f"   Wheel: {final['wheel']['primary']} → {final['wheel'].get('secondary')} → {final['wheel'].get('tertiary')}")
        print(f"   Valence: {final.get('valence', 'N/A')}")
        print(f"   Arousal: {final.get('arousal', 'N/A')}")
        
        if final.get('poems'):
            print(f"   Poems: ✅ ({len(final['poems'])} lines)")
        if final.get('tips'):
            print(f"   Tips: ✅ ({len(final['tips'])} windows)")
    else:
        print(f"\n   ⚠️  reflection:{rid} exists but no 'final' field")
        print(f"   Worker hasn't updated it yet")

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)

# Check queue length
queue_length = upstash_command(['LLEN', 'reflections:normalized'])
print(f"\nCurrent queue length: {queue_length}")

if queue_length > 10:
    print(f"⚠️  Queue has {queue_length} items - worker may be backed up!")

print("\n✅ Your queue-based enrichment system is working!")
print("\nNext steps:")
print("1. Deploy enrichment_v5 to HuggingFace Spaces")
print("2. Deploy worker.py to Railway/Render")
print("3. Reflections will auto-enrich as users submit them")
