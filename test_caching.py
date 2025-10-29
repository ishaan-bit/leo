#!/usr/bin/env python3
"""
Test script to verify caching is working in enrichment-worker.
Submits the same reflection twice and checks for cache hits.
"""

import requests
import json
import time
import os
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from enrichment-worker/.env
env_path = Path(__file__).parent / "enrichment-worker" / ".env"
load_dotenv(env_path)

# Redis REST API client
class RedisClient:
    def __init__(self, url: str, token: str):
        self.url = url.rstrip('/')
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def _execute(self, command):
        response = requests.post(
            self.url,
            json=command,
            headers=self.headers,
            timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            return result.get('result')
        raise Exception(f"Redis error: {response.status_code}")
    
    def get(self, key: str):
        return self._execute(['GET', key])
    
    def set(self, key: str, value: str, ex: int = None):
        if ex:
            return self._execute(['SET', key, value, 'EX', ex])
        return self._execute(['SET', key, value])
    
    def lpush(self, key: str, value: str):
        return self._execute(['LPUSH', key, value])

# Connect to Redis
redis_url = os.getenv("UPSTASH_REDIS_REST_URL")
redis_token = os.getenv("UPSTASH_REDIS_REST_TOKEN")

if not redis_url or not redis_token:
    print("ERROR: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set in .env")
    exit(1)

r = RedisClient(redis_url, redis_token)

# Test reflection text
TEST_TEXT = "I'm feeling really grateful today for my family and friends. The sunset was beautiful."

# Create test reflection
def create_test_reflection(user_id: str, text: str) -> str:
    """Create a test reflection and push to enrichment queue."""
    
    timestamp = datetime.now(timezone.utc).isoformat()
    reflection_id = f"{user_id}_{int(time.time() * 1000)}"
    
    reflection_data = {
        "rid": reflection_id,
        "sid": user_id,
        "normalized_text": text,
        "timestamp": timestamp,
        "status": "normalized",
        "emotion": "joyful",
        "score": 0.85
    }
    
    # Push to normalized queue (worker watches this)
    r.lpush("reflections:normalized", json.dumps(reflection_data))
    
    print(f"✓ Created reflection: {reflection_id}")
    print(f"  Text: {text[:60]}...")
    
    return reflection_id

def wait_for_enrichment(reflection_id: str, timeout: int = 30) -> dict:
    """Wait for enrichment to complete."""
    
    start = time.time()
    key = f"reflection:{reflection_id}"
    
    while time.time() - start < timeout:
        data_json = r.get(key)
        
        if data_json:
            data = json.loads(data_json)
            status = data.get("status", "")
            
            if status in ["complete", "complete_with_fallback"]:
                print(f"✓ Enrichment complete: {status}")
                return data
        
        time.sleep(0.5)
    
    raise TimeoutError(f"Enrichment timed out after {timeout}s")

def main():
    print("\n=== CACHE TEST: Enrichment Worker ===\n")
    
    user_id = "test_user_cache"
    
    # Test 1: First submission (should be CACHE MISS)
    print("[1/2] First submission (should be CACHE MISS)...")
    refl_id_1 = create_test_reflection(user_id, TEST_TEXT)
    
    print("  Waiting for enrichment...")
    start_time = time.time()
    result_1 = wait_for_enrichment(refl_id_1, timeout=45)
    elapsed_1 = time.time() - start_time
    
    print(f"  ✓ Completed in {elapsed_1:.2f}s")
    wheel = json.loads(result_1.get('wheel', '{}')) if isinstance(result_1.get('wheel'), str) else result_1.get('wheel', {})
    print(f"  Primary emotion: {wheel.get('primary', 'N/A')}")
    print(f"  Secondary: {wheel.get('secondary', 'N/A')}")
    
    # Wait a bit
    print("\n  Waiting 3s before second submission...\n")
    time.sleep(3)
    
    # Test 2: Second submission (should be CACHE HIT)
    print("[2/2] Second submission (should be CACHE HIT)...")
    refl_id_2 = create_test_reflection(user_id, TEST_TEXT)
    
    print("  Waiting for enrichment...")
    start_time = time.time()
    result_2 = wait_for_enrichment(refl_id_2, timeout=45)
    elapsed_2 = time.time() - start_time
    
    print(f"  ✓ Completed in {elapsed_2:.2f}s")
    wheel2 = json.loads(result_2.get('wheel', '{}')) if isinstance(result_2.get('wheel'), str) else result_2.get('wheel', {})
    print(f"  Primary emotion: {wheel2.get('primary', 'N/A')}")
    print(f"  Secondary: {wheel2.get('secondary', 'N/A')}")
    
    # Compare results
    print("\n=== RESULTS ===")
    print(f"First run:  {elapsed_1:.2f}s")
    print(f"Second run: {elapsed_2:.2f}s")
    
    if elapsed_2 < elapsed_1 * 0.3:
        speedup = elapsed_1 / elapsed_2
        print(f"✓ CACHE HIT CONFIRMED! {speedup:.1f}x faster")
    else:
        print("⚠ Cache may not have been used (times similar)")
    
    # Check if outputs match
    if wheel.get('primary') == wheel2.get('primary'):
        print("✓ Outputs match (consistent)")
    else:
        print("⚠ Outputs differ (unexpected)")
    
    print("\n=== TEST COMPLETE ===\n")

if __name__ == "__main__":
    main()
