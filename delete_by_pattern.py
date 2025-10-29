#!/usr/bin/env python3
"""
Delete keys matching a pattern from Upstash Redis.
Safer than FLUSHDB - only deletes matching keys.
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv('enrichment-worker/.env')

UPSTASH_REDIS_URL = os.getenv('UPSTASH_REDIS_REST_URL')
UPSTASH_REDIS_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN')

def execute_command(command: list):
    """Execute Redis command via REST API"""
    response = requests.post(
        UPSTASH_REDIS_URL,
        json=command,
        headers={
            'Authorization': f'Bearer {UPSTASH_REDIS_TOKEN}',
            'Content-Type': 'application/json',
        },
        timeout=30
    )
    response.raise_for_status()
    return response.json().get('result')

def delete_by_pattern(pattern: str):
    """Delete all keys matching pattern"""
    print(f"\n🔍 Finding keys matching: {pattern}")
    
    # SCAN to find all matching keys
    cursor = 0
    total_deleted = 0
    
    while True:
        # SCAN returns [cursor, [keys]]
        result = execute_command(['SCAN', cursor, 'MATCH', pattern, 'COUNT', 100])
        cursor = int(result[0])
        keys = result[1]
        
        if keys:
            print(f"Found {len(keys)} keys, deleting...")
            execute_command(['DEL'] + keys)
            total_deleted += len(keys)
        
        if cursor == 0:
            break
    
    print(f"✅ Deleted {total_deleted} keys")

def main():
    print("\n🗑️  Delete keys by pattern from Upstash Redis")
    print("\nExamples:")
    print("  moment:*       - All moment data")
    print("  image:*        - All image captions")
    print("  user:*         - All user data")
    print("  *              - Everything (use flush_upstash.py instead)")
    
    pattern = input("\nEnter pattern: ").strip()
    
    if not pattern:
        print("❌ No pattern provided.")
        return
    
    print(f"\n⚠️  This will DELETE all keys matching: {pattern}")
    confirmation = input("Type 'DELETE' to confirm: ")
    
    if confirmation != "DELETE":
        print("❌ Operation cancelled.")
        return
    
    try:
        delete_by_pattern(pattern)
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
