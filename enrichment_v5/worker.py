"""
Queue Worker for enrichment_v5 HuggingFace Spaces API
Polls Upstash reflections:normalized queue and processes reflections.

Architecture:
1. Poll reflections:normalized queue (blocking BLPOP)
2. Extract reflection data
3. POST normalized_text to HF Spaces /enrich endpoint
4. Save enrichment to reflections:enriched:{rid}
5. Update reflection:{rid} with final data
"""

import os
import sys
import time
import json
import requests
from typing import Dict, Optional
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Configuration
UPSTASH_URL = os.getenv('UPSTASH_REDIS_REST_URL') or os.getenv('KV_REST_API_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN') or os.getenv('KV_REST_API_TOKEN')
ENRICHMENT_API_URL = os.getenv('ENRICHMENT_API_URL')  # Your HF Spaces URL

POLL_INTERVAL = 1  # seconds
BATCH_TIMEOUT = 30  # seconds for BLPOP
REFLECTION_TTL = 30 * 24 * 60 * 60  # 30 days

print("="*60)
print("ENRICHMENT WORKER - Queue Processor")
print("="*60)
print(f"Upstash URL: {UPSTASH_URL[:30]}..." if UPSTASH_URL else "❌ Missing")
print(f"Upstash Token: {'✅ Configured' if UPSTASH_TOKEN else '❌ Missing'}")
print(f"API URL: {ENRICHMENT_API_URL}" if ENRICHMENT_API_URL else "❌ Missing ENRICHMENT_API_URL")
print("="*60)

if not all([UPSTASH_URL, UPSTASH_TOKEN, ENRICHMENT_API_URL]):
    print("\n❌ ERROR: Missing required environment variables")
    print("   Set: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, ENRICHMENT_API_URL")
    sys.exit(1)


class UpstashClient:
    """Upstash REST API client."""
    
    def __init__(self, url: str, token: str):
        self.url = url.rstrip('/')
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def _request(self, command: list) -> any:
        """Execute Redis command via REST API."""
        try:
            response = requests.post(
                self.url,
                headers=self.headers,
                json=command,
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            return data.get('result')
        except Exception as e:
            print(f"❌ Upstash request failed: {e}")
            return None
    
    def blpop(self, key: str, timeout: int = 30) -> Optional[tuple]:
        """Blocking left pop from list."""
        result = self._request(['BLPOP', key, timeout])
        if result and isinstance(result, list) and len(result) == 2:
            return (result[0], result[1])  # (key, value)
        return None
    
    def get(self, key: str) -> Optional[str]:
        """Get value from key."""
        return self._request(['GET', key])
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Set key with optional expiry."""
        if ex:
            result = self._request(['SETEX', key, ex, value])
        else:
            result = self._request(['SET', key, value])
        return result == 'OK'
    
    def rpush(self, key: str, value: str) -> int:
        """Right push to list."""
        return self._request(['RPUSH', key, value]) or 0


def call_enrichment_api(reflection: Dict) -> Optional[Dict]:
    """
    Call HuggingFace Spaces enrichment API.
    
    Args:
        reflection: Full reflection object from queue
        
    Returns:
        Enrichment JSON or None if failed
    """
    try:
        # Build request payload (support both formats)
        payload = {
            'rid': reflection.get('rid'),
            'sid': reflection.get('sid'),
            'timestamp': reflection.get('timestamp'),
            'normalized_text': reflection.get('normalized_text'),
        }
        
        # Remove None values
        payload = {k: v for k, v in payload.items() if v is not None}
        
        print(f"   📤 Calling API: {ENRICHMENT_API_URL}/enrich")
        
        response = requests.post(
            f"{ENRICHMENT_API_URL}/enrich",
            json=payload,
            timeout=60  # API can take time on first call (model loading)
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"   ❌ API error {response.status_code}: {response.text[:200]}")
            return None
            
    except requests.exceptions.Timeout:
        print(f"   ⏱️  API timeout (60s) - may be cold start")
        return None
    except Exception as e:
        print(f"   ❌ API call failed: {e}")
        return None


def save_enrichment(redis: UpstashClient, rid: str, enrichment: Dict) -> bool:
    """
    Save enrichment to Upstash.
    
    Saves to:
    - reflections:enriched:{rid} - full enrichment data
    - reflection:{rid} - update with final.* fields
    
    Args:
        redis: Upstash client
        rid: Reflection ID
        enrichment: Enrichment JSON from API
        
    Returns:
        True if successful
    """
    try:
        # 1. Save to reflections:enriched:{rid}
        enriched_key = f'reflections:enriched:{rid}'
        enriched_data = {
            'rid': rid,
            'enrichment': enrichment,
            'processed_at': datetime.now().isoformat(),
            'version': '5.0.0',
            'source': 'enrichment_v5_api'
        }
        
        if not redis.set(enriched_key, json.dumps(enriched_data), ex=REFLECTION_TTL):
            print(f"   ❌ Failed to save enrichment to {enriched_key}")
            return False
        
        print(f"   ✅ Saved to {enriched_key}")
        
        # 2. Update reflection:{rid} with final.* fields
        reflection_key = f'reflection:{rid}'
        reflection_json = redis.get(reflection_key)
        
        if reflection_json:
            reflection = json.loads(reflection_json)
            
            # Add 'final' field with enrichment data
            reflection['final'] = {
                'wheel': {
                    'primary': enrichment.get('primary'),
                    'secondary': enrichment.get('secondary'),
                    'tertiary': enrichment.get('tertiary'),
                },
                'valence': enrichment.get('valence'),
                'arousal': enrichment.get('arousal'),
                'event_valence': enrichment.get('event_valence'),
                'domain': enrichment.get('domain'),
                'control': enrichment.get('control'),
                'polarity': enrichment.get('polarity'),
                'confidence': enrichment.get('confidence'),
            }
            
            # Add dialogue if present
            if enrichment.get('poems'):
                reflection['final']['poems'] = enrichment['poems']
            if enrichment.get('tips'):
                reflection['final']['tips'] = enrichment['tips']
            if enrichment.get('poem'):
                reflection['final']['poem'] = enrichment['poem']  # 🔥 NEW: Single poem from Excel
            
            # Update reflection
            if redis.set(reflection_key, json.dumps(reflection), ex=REFLECTION_TTL):
                print(f"   ✅ Updated {reflection_key} with final data")
                print(f"      Primary: {enrichment.get('primary')}")
                print(f"      Valence: {enrichment.get('valence'):.3f}")
                print(f"      Arousal: {enrichment.get('arousal'):.3f}")
                return True
            else:
                print(f"   ❌ Failed to update {reflection_key}")
                return False
        else:
            print(f"   ⚠️  Reflection {reflection_key} not found (enrichment saved anyway)")
            return True
            
    except Exception as e:
        print(f"   ❌ Save failed: {e}")
        return False


def process_reflection(redis: UpstashClient, reflection_json: str) -> bool:
    """
    Process a single reflection from queue.
    
    Args:
        redis: Upstash client
        reflection_json: JSON string from queue
        
    Returns:
        True if successful
    """
    try:
        reflection = json.loads(reflection_json)
        rid = reflection.get('rid')
        normalized_text = reflection.get('normalized_text')
        
        if not rid or not normalized_text:
            print(f"   ❌ Invalid reflection: missing rid or normalized_text")
            return False
        
        print(f"\n[>] {rid}")
        print(f"   Text: {normalized_text[:80]}...")
        
        # Call enrichment API
        enrichment = call_enrichment_api(reflection)
        
        if not enrichment:
            print(f"   ❌ Enrichment failed")
            return False
        
        # Validate enrichment has required fields
        if not enrichment.get('primary'):
            print(f"   ❌ Invalid enrichment: missing primary emotion")
            return False
        
        # Save to Upstash
        success = save_enrichment(redis, rid, enrichment)
        
        if success:
            print(f"[✓] {rid} complete")
        
        return success
        
    except json.JSONDecodeError as e:
        print(f"   ❌ Invalid JSON from queue: {e}")
        return False
    except Exception as e:
        print(f"   ❌ Processing failed: {e}")
        return False


def main():
    """Main worker loop."""
    redis = UpstashClient(UPSTASH_URL, UPSTASH_TOKEN)
    
    print("\n🚀 Worker started")
    print("   Polling queue: reflections:normalized")
    print("   Press Ctrl+C to stop\n")
    
    processed_count = 0
    failed_count = 0
    
    try:
        while True:
            # Blocking pop from queue (waits up to BATCH_TIMEOUT seconds)
            result = redis.blpop('reflections:normalized', timeout=BATCH_TIMEOUT)
            
            if result:
                _, reflection_json = result
                
                # Process reflection
                success = process_reflection(redis, reflection_json)
                
                if success:
                    processed_count += 1
                else:
                    failed_count += 1
                
                # Log stats every 10 reflections
                if (processed_count + failed_count) % 10 == 0:
                    print(f"\n📊 Stats: {processed_count} processed, {failed_count} failed\n")
            else:
                # No items in queue, wait briefly
                print(".", end="", flush=True)
                time.sleep(POLL_INTERVAL)
                
    except KeyboardInterrupt:
        print(f"\n\n🛑 Worker stopped")
        print(f"   Total processed: {processed_count}")
        print(f"   Total failed: {failed_count}")
        sys.exit(0)
    except Exception as e:
        print(f"\n\n❌ Worker crashed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
