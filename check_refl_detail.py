import os
import json
from dotenv import load_dotenv
from upstash_redis import Redis

# Load environment
load_dotenv('apps/web/.env.local')

# Get credentials
url = os.getenv('UPSTASH_REDIS_REST_URL') or os.getenv('KV_REST_API_URL')
token = os.getenv('UPSTASH_REDIS_REST_TOKEN') or os.getenv('KV_REST_API_TOKEN')

if not url or not token:
    print("❌ Missing Upstash credentials")
    exit(1)

redis = Redis(url=url, token=token)

rid = "refl_1763126158662_gmn62asms"
key = f"reflection:{rid}"

print(f"🔍 Checking reflection: {rid}")
print(f"📌 Key: {key}\n")

data = redis.get(key)

if not data:
    print("❌ Reflection NOT FOUND")
    exit(1)

reflection = json.loads(data) if isinstance(data, str) else data

print("✅ Reflection EXISTS!\n")

# Check structure
print("=" * 80)
print("DATA STRUCTURE ANALYSIS")
print("=" * 80)

# Show top-level keys
print(f"\n📦 Top-level keys: {list(reflection.keys())}")

# Check for final
if 'final' in reflection:
    final = reflection['final']
    print(f"\n🎯 final keys: {list(final.keys())}")
    
    # Check wheel
    if 'wheel' in final:
        print(f"   🎡 wheel: {final['wheel']}")
    
    # Check post_enrichment
    if 'post_enrichment' in final:
        pe = final['post_enrichment']
        print(f"\n📝 post_enrichment keys: {list(pe.keys())}")
        
        # Check dialogue_tuples
        if 'dialogue_tuples' in pe:
            dt = pe['dialogue_tuples']
            print(f"\n   💬 dialogue_tuples ({len(dt)} tuples):")
            for i, tuple_data in enumerate(dt, 1):
                print(f"      Tuple {i}: {tuple_data}")
        
        # Check poems
        if 'poems' in pe:
            poems = pe['poems']
            print(f"\n   📖 poems ({len(poems)} poems):")
            for i, poem in enumerate(poems, 1):
                print(f"      Poem {i} ({len(poem)} chars): {poem[:100]}...")
        
        # Check meta
        if 'meta' in pe:
            meta = pe['meta']
            print(f"\n   🔍 meta keys: {list(meta.keys())}")
            
            # Check for poem fields
            poem_fields = [k for k in meta.keys() if 'poem' in k.lower()]
            if poem_fields:
                print(f"\n   🎨 POEM FIELDS IN META:")
                for field in poem_fields:
                    value = meta[field]
                    if value:
                        print(f"      {field}: {str(value)[:100]}...")
                    else:
                        print(f"      {field}: (empty)")

# Check for legacy fields at top level
print(f"\n🔍 Legacy fields at top level:")
if 'poems' in reflection:
    print(f"   poems: {len(reflection['poems'])} items")
if 'tips' in reflection:
    print(f"   tips: {len(reflection['tips'])} items")

print("\n" + "=" * 80)
print("REDUNDANCY ANALYSIS")
print("=" * 80)

# Count duplicate storage
storage_locations = []

if 'poems' in reflection:
    storage_locations.append("reflection.poems (LEGACY)")
if 'tips' in reflection:
    storage_locations.append("reflection.tips (LEGACY)")
if reflection.get('final', {}).get('post_enrichment', {}).get('dialogue_tuples'):
    storage_locations.append("reflection.final.post_enrichment.dialogue_tuples")
if reflection.get('final', {}).get('post_enrichment', {}).get('poems'):
    storage_locations.append("reflection.final.post_enrichment.poems")
if reflection.get('final', {}).get('post_enrichment', {}).get('meta', {}).get('dialogue_tuples'):
    storage_locations.append("reflection.final.post_enrichment.meta.dialogue_tuples (DUPLICATE)")
if reflection.get('final', {}).get('post_enrichment', {}).get('meta', {}).get('poem'):
    storage_locations.append("reflection.final.post_enrichment.meta.poem")

print(f"\n🗂️  Data stored in {len(storage_locations)} locations:")
for loc in storage_locations:
    print(f"   • {loc}")

print("\n✅ ISSUES IDENTIFIED:")
print("   1. dialogue_tuples stored in both:")
print("      - final.post_enrichment.dialogue_tuples (USED BY FRONTEND)")
print("      - final.post_enrichment.meta.dialogue_tuples (REDUNDANT)")
print("   2. poems stored in multiple places:")
print("      - final.post_enrichment.poems (from Excel Poem En 1/2)")
print("      - final.post_enrichment.meta.poem (random selection)")
print("      - Need to verify which source is being used")

# Show full structure for one dialogue tuple
if reflection.get('final', {}).get('post_enrichment', {}).get('dialogue_tuples'):
    print("\n" + "=" * 80)
    print("SAMPLE DIALOGUE TUPLE STRUCTURE")
    print("=" * 80)
    dt = reflection['final']['post_enrichment']['dialogue_tuples']
    if len(dt) > 0:
        print(f"\nTuple 1 (as stored):")
        print(f"   {json.dumps(dt[0], indent=4)}")
