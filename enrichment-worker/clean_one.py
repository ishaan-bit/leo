"""Quick script to clean a single reflection by removing analysis object"""

import json
import sys
import os
from dotenv import load_dotenv
from src.modules.redis_client import RedisClient

# Load environment variables
load_dotenv()

def clean_reflection(rid: str):
    """Remove analysis, tags_auto, tags_user from a reflection"""
    redis = RedisClient(
        url=os.getenv('UPSTASH_REDIS_REST_URL'),
        token=os.getenv('UPSTASH_REDIS_REST_TOKEN')
    )
    
    # Get reflection
    print(f"📥 Fetching {rid}...")
    reflection = redis.get_reflection(rid)
    
    if not reflection:
        print(f"❌ Reflection {rid} not found")
        return False
    
    # Check what needs cleaning
    has_analysis = 'analysis' in reflection
    has_tags_auto = 'tags_auto' in reflection
    has_tags_user = 'tags_user' in reflection
    
    if not any([has_analysis, has_tags_auto, has_tags_user]):
        print(f"✅ Reflection {rid} is already clean!")
        return True
    
    # Show what will be removed
    print(f"\n🧹 Cleaning {rid}:")
    if has_analysis:
        print(f"   - Removing 'analysis' object ({len(json.dumps(reflection['analysis']))} bytes)")
    if has_tags_auto:
        print(f"   - Removing 'tags_auto': {reflection['tags_auto']}")
    if has_tags_user:
        print(f"   - Removing 'tags_user': {reflection['tags_user']}")
    
    # Remove fields
    reflection.pop('analysis', None)
    reflection.pop('tags_auto', None)
    reflection.pop('tags_user', None)
    
    # Save back
    key = f"reflection:{rid}"
    success = redis.set(key, json.dumps(reflection), ex=2592000)
    
    if success:
        print(f"✅ Cleaned and saved {rid}")
        return True
    else:
        print(f"❌ Failed to save {rid}")
        return False

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python clean_one.py <reflection_id>")
        print("Example: python clean_one.py refl_1760942250813_ds8qayvdn")
        sys.exit(1)
    
    rid = sys.argv[1]
    clean_reflection(rid)
