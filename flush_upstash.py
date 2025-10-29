#!/usr/bin/env python3
"""
Flush all data from Upstash Redis database.
⚠️ WARNING: This will DELETE ALL data. Use with caution!
"""

import os
import requests
from dotenv import load_dotenv

# Load environment from enrichment-worker/.env
load_dotenv('enrichment-worker/.env')

UPSTASH_REDIS_URL = os.getenv('UPSTASH_REDIS_REST_URL')
UPSTASH_REDIS_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN')

if not UPSTASH_REDIS_URL or not UPSTASH_REDIS_TOKEN:
    print("❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN in enrichment-worker/.env")
    exit(1)

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
    result = response.json()
    return result.get('result')

def main():
    print("\n⚠️  WARNING: This will DELETE ALL data from Upstash Redis!")
    print(f"Database: {UPSTASH_REDIS_URL}")
    print("\nThis action is IRREVERSIBLE.\n")
    
    confirmation = input("Type 'DELETE ALL' to confirm: ")
    
    if confirmation != "DELETE ALL":
        print("❌ Operation cancelled.")
        return
    
    print("\n🗑️  Flushing database...")
    
    try:
        # FLUSHDB deletes all keys in the current database
        result = execute_command(['FLUSHDB'])
        
        if result == 'OK':
            print("✅ Database flushed successfully!")
            print("All keys have been deleted.")
        else:
            print(f"⚠️  Unexpected result: {result}")
    
    except Exception as e:
        print(f"❌ Error flushing database: {e}")

if __name__ == "__main__":
    main()
