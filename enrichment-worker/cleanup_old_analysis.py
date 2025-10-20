"""
Cleanup script to remove redundant 'analysis' field from existing reflections
Run this once to clean up old data
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

from src.modules.redis_client import get_redis

def cleanup_reflection(redis, rid):
    """Remove analysis field from a reflection"""
    reflection = redis.get_reflection(rid)
    
    if not reflection:
        print(f"  ⚠️  Reflection {rid} not found")
        return False
    
    if 'analysis' not in reflection:
        print(f"  ✅ {rid} - Already clean (no analysis field)")
        return True
    
    # Remove redundant fields
    reflection.pop('analysis', None)
    reflection.pop('tags_auto', None)  # Empty array, not useful
    reflection.pop('tags_user', None)  # Empty array, not useful
    
    # Write back
    key = f"reflection:{rid}"
    success = redis.set(key, json.dumps(reflection), ex=2592000)  # 30 days TTL
    
    if success:
        print(f"  ✅ {rid} - Cleaned (removed analysis)")
        return True
    else:
        print(f"  ❌ {rid} - Failed to write")
        return False


def main():
    """Clean up all reflections in a session"""
    redis = get_redis()
    
    print("🧹 Reflection Cleanup Script")
    print("=" * 50)
    
    # Get session ID from user
    sid = input("\nEnter session ID (or press Enter to skip): ").strip()
    
    if not sid:
        print("\n📝 Manual cleanup:")
        print("  1. Go to Upstash console: https://console.upstash.com/")
        print("  2. Find keys matching pattern: reflection:*")
        print("  3. View each reflection JSON")
        print("  4. If it has 'analysis' field, delete that field")
        print("\nOr run this script again with a session ID.")
        return
    
    # Get reflections for this session
    owner_key = f"reflections:sess_{sid}"
    rids = redis.zrevrange(owner_key, 0, -1)  # Get all
    
    if not rids:
        print(f"\n⚠️  No reflections found for session {sid}")
        return
    
    print(f"\n📊 Found {len(rids)} reflections for session {sid}")
    print()
    
    cleaned_count = 0
    for i, rid in enumerate(rids, 1):
        print(f"[{i}/{len(rids)}] {rid}")
        if cleanup_reflection(redis, rid):
            cleaned_count += 1
    
    print()
    print(f"✅ Cleaned {cleaned_count}/{len(rids)} reflections")
    print("\n🎉 Cleanup complete!")


if __name__ == '__main__':
    main()
