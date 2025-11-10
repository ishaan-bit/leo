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
    print("❌ Missing Upstash credentials in apps/web/.env.local")
    exit(1)

# Direct credentials
redis = Redis(url=url, token=token)

rid = "refl_1762774924308_r3h4dr0rv"
key = f"reflection:{rid}"

print(f"🔍 Checking reflection: {rid}")
print(f"📌 Key: {key}\n")

data = redis.get(key)

if data:
    reflection = json.loads(data) if isinstance(data, str) else data
    print("✅ Reflection EXISTS in Upstash!")
    print(f"📊 user_id: {reflection.get('user_id')}")
    print(f"📊 owner_id: {reflection.get('owner_id')}")
    print(f"📊 timestamp: {reflection.get('timestamp')}")
    print(f"\n🎭 Primary emotion: {reflection.get('final', {}).get('wheel', {}).get('primary')}")
    
    # Check post_enrichment structure
    post_enrich = reflection.get('post_enrichment', {})
    print(f"\n📦 post_enrichment keys: {list(post_enrich.keys()) if post_enrich else 'None'}")
    print(f"📝 Poems: {len(post_enrich.get('poems', []))}")
    print(f"💡 Tips: {len(post_enrich.get('tips', []))}")
    
    # Print FULL structure to see what's actually there
    print("\n🔍 FULL STRUCTURE:")
    print(json.dumps(reflection, indent=2)[:2000])  # First 2000 chars
    
    if reflection.get('post_enrichment', {}).get('poems'):
        print("\n📖 Poems:")
        for i, poem in enumerate(reflection['post_enrichment']['poems'], 1):
            print(f"  {i}. {poem[:80]}...")
    
    if reflection.get('post_enrichment', {}).get('tips'):
        print("\n💡 Tips:")
        for i, tip in enumerate(reflection['post_enrichment']['tips'], 1):
            print(f"  {i}. {tip[:80]}...")
    
    # Check TTL
    ttl = redis.ttl(key)
    print(f"\n⏱️  TTL: {ttl} seconds ({ttl/60:.1f} minutes)")
else:
    print("❌ Reflection NOT FOUND in Upstash (already expired or deleted)")
