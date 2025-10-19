"""
Quick test to list reflections in Upstash
"""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from persistence import UpstashStore

def main():
    try:
        store = UpstashStore()
        print("✓ Connected to Upstash")
        
        # Try to find any reflections
        print("\nSearching for reflections...")
        
        # Check for the example reflection from your JSON
        test_rid = "refl_1760854132268_rbrpm3qz4"
        key = f"reflection:{test_rid}"
        data = store.redis.get(key)
        
        if data:
            import json
            reflection = json.loads(data)
            print(f"\n✓ Found reflection: {test_rid}")
            print(f"  Owner: {reflection.get('owner_id')}")
            print(f"  Text: {reflection.get('normalized_text', '')[:60]}...")
            print(f"  Has analysis: {'analysis' in reflection}")
        else:
            print(f"\n⚠️  Reflection {test_rid} not found")
            print("  This is expected if you haven't submitted a reflection yet")
            print("\n📝 To create a test reflection:")
            print("  1. Go to your Vercel app")
            print("  2. Enter a reflection in the notebook")
            print("  3. Submit")
            print("  4. Come back and run: python enrich_reflection.py <rid>")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nMake sure you have set:")
        print("  UPSTASH_REDIS_REST_URL")
        print("  UPSTASH_REDIS_REST_TOKEN")

if __name__ == "__main__":
    main()
