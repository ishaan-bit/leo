"""
Image Processing Worker
Polls Upstash Redis for image reflections (base64), processes with local GPU,
generates narrative text, and triggers enrichment pipeline
"""

import os
import time
import json
import base64
import requests
from datetime import datetime
from typing import Dict, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
POLL_MS = int(os.getenv('IMAGE_WORKER_POLL_MS', '1000'))
IMAGES_QUEUE = 'images:queue'
IMAGE_CAPTIONING_URL = os.getenv('IMAGE_CAPTIONING_URL', 'http://localhost:5050')

# Upstash Redis - try different env var names
UPSTASH_REDIS_URL = (
    os.getenv('UPSTASH_REDIS_REST_URL') or 
    os.getenv('KV_REST_API_URL')
)
UPSTASH_REDIS_TOKEN = (
    os.getenv('UPSTASH_REDIS_REST_TOKEN') or 
    os.getenv('KV_REST_API_TOKEN')
)

if not UPSTASH_REDIS_URL or not UPSTASH_REDIS_TOKEN:
    raise ValueError("UPSTASH_REDIS_REST_URL/KV_REST_API_URL and UPSTASH_REDIS_REST_TOKEN/KV_REST_API_TOKEN must be set")


class UpstashClient:
    """Simple Upstash Redis HTTP client"""
    
    def __init__(self, url: str, token: str):
        self.url = url.rstrip('/')
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        }
    
    def _execute(self, command: list, timeout: int = 30):
        """Execute Redis command via HTTP"""
        response = requests.post(
            self.url,
            headers=self.headers,
            json=command,
            timeout=timeout
        )
        response.raise_for_status()
        result = response.json()
        return result.get('result')
    
    def lpop(self, key: str) -> Optional[str]:
        """Pop from left of list"""
        return self._execute(['LPOP', key])
    
    def get(self, key: str) -> Optional[str]:
        """Get value"""
        return self._execute(['GET', key])
    
    def set(self, key: str, value: str, ex: Optional[int] = None):
        """Set value with optional expiry"""
        # Use longer timeout for large data (images can be 100KB+ base64)
        timeout = 60 if len(value) > 50000 else 30
        if ex:
            return self._execute(['SET', key, value, 'EX', ex], timeout=timeout)
        return self._execute(['SET', key, value], timeout=timeout)
    
    def rpush(self, key: str, value: str):
        """Push to right of list"""
        return self._execute(['RPUSH', key, value])
    
    def llen(self, key: str) -> int:
        """Get list length"""
        result = self._execute(['LLEN', key])
        return result if result is not None else 0
    
    def ping(self) -> bool:
        """Check connection"""
        try:
            result = self._execute(['PING'])
            return result == 'PONG'
        except:
            return False


def check_health() -> Dict:
    """Check health of dependencies"""
    # Check image-captioning service
    try:
        response = requests.get(f'{IMAGE_CAPTIONING_URL}/', timeout=5)
        image_service_ok = response.status_code == 200
    except:
        image_service_ok = False
    
    # Check Redis
    redis_client = UpstashClient(UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN)
    redis_ok = redis_client.ping()
    
    status = "healthy" if (image_service_ok and redis_ok) else "degraded"
    
    return {
        'image_captioning': 'ok' if image_service_ok else 'down',
        'redis': 'ok' if redis_ok else 'down',
        'status': status,
        'service_url': IMAGE_CAPTIONING_URL,
    }


def process_image_reflection(redis_client: UpstashClient, rid: str) -> bool:
    """
    Process a single image reflection
    
    Args:
        redis_client: Upstash client
        rid: Reflection ID
    
    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"\n🔄 Processing image reflection: {rid}")
        
        # 1. Get reflection from Upstash (using consistent reflection: prefix)
        reflection_key = f'reflection:{rid}'
        reflection_json = redis_client.get(reflection_key)
        
        if not reflection_json:
            print(f"❌ Reflection not found: {reflection_key}")
            return False
        
        reflection = json.loads(reflection_json)
        
        # 2. Extract image base64
        image_base64 = reflection.get('image_base64')
        if not image_base64:
            print(f"❌ No image_base64 found in reflection")
            return False
        
        print(f"📷 Image size: {len(image_base64)} chars (base64)")
        
        # 3. Update status to processing
        reflection['processing_status'] = 'processing'
        redis_client.set(reflection_key, json.dumps(reflection), ex=30 * 24 * 60 * 60)
        
        # 4. Call image-captioning service with base64
        print(f"🤖 Calling image-captioning service at {IMAGE_CAPTIONING_URL}")
        
        caption_response = requests.post(
            f'{IMAGE_CAPTIONING_URL}/caption-base64',
            json={'image_base64': image_base64},
            timeout=(60, 300)  # (connect timeout, read timeout) - 5min for large uploads + GPU
        )
        
        if not caption_response.ok:
            error_text = caption_response.text
            print(f"❌ Image captioning failed: {error_text}")
            
            # Mark as failed
            reflection['processing_status'] = 'failed'
            reflection['processing_error'] = error_text
            redis_client.set(reflection_key, json.dumps(reflection), ex=30 * 24 * 60 * 60)
            return False
        
        caption_data = caption_response.json()
        narrative_text = caption_data.get('narrative', '')
        
        print(f"✅ Generated narrative: {narrative_text[:80]}...")
        
        # 5. Update reflection with text
        reflection['original_text'] = narrative_text
        reflection['normalized_text'] = narrative_text
        reflection['vision_model'] = caption_data.get('model', 'llava:latest')
        reflection['processing_status'] = 'complete'
        reflection['processed_at'] = datetime.now().isoformat()
        
        # Save updated reflection
        redis_client.set(reflection_key, json.dumps(reflection), ex=30 * 24 * 60 * 60)
        
        # 6. Add to enrichment queue (must be full normalized payload as JSON string)
        print(f"📬 Adding to reflections:normalized queue for enrichment")
        
        # Build normalized payload matching the format from regular reflections
        normalized_payload = {
            'rid': rid,
            'sid': reflection['sid'],
            'timestamp': reflection['timestamp'],
            'normalized_text': narrative_text,
        }
        
        redis_client.rpush('reflections:normalized', json.dumps(normalized_payload))
        
        print(f"✅ Image reflection processed successfully: {rid}")
        return True
        
    except Exception as e:
        print(f"❌ Error processing {rid}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        
        # Try to mark as failed
        try:
            reflection_json = redis_client.get(f'reflection:{rid}')
            if reflection_json:
                reflection = json.loads(reflection_json)
                reflection['processing_status'] = 'failed'
                reflection['processing_error'] = str(e)
                redis_client.set(f'reflection:{rid}', json.dumps(reflection), ex=30 * 24 * 60 * 60)
        except:
            pass
        
        return False


def main():
    """Main worker loop"""
    print("🚀 Image Processing Worker Starting...")
    print(f"   Poll interval: {POLL_MS}ms")
    print(f"   Image service: {IMAGE_CAPTIONING_URL}")
    print(f"   Queue: {IMAGES_QUEUE}")
    
    # Check health
    health = check_health()
    print(f"\n🏥 Health Check:")
    print(f"   Image Captioning: {health['image_captioning']}")
    print(f"   Redis: {health['redis']}")
    print(f"   Status: {health['status']}")
    
    if health['status'] != 'healthy':
        print(f"\n⚠️  WARNING: System not fully healthy!")
        print(f"   Make sure image-captioning service is running:")
        print(f"   → cd image-captioning-service && python app.py")
    
    print(f"\n👀 Watching {IMAGES_QUEUE} for images...\n")
    
    # Initialize Redis client
    redis_client = UpstashClient(UPSTASH_REDIS_URL, UPSTASH_REDIS_TOKEN)
    
    # Main loop
    processed_count = 0
    
    while True:
        try:
            # Check queue length
            queue_len = redis_client.llen(IMAGES_QUEUE)
            
            if queue_len > 0:
                print(f"📬 Queue length: {queue_len}")
                
                # Pop one reflection ID
                rid = redis_client.lpop(IMAGES_QUEUE)
                
                if rid:
                    # Process it
                    success = process_image_reflection(redis_client, rid)
                    
                    if success:
                        processed_count += 1
                        print(f"📊 Total processed: {processed_count}")
            
            # Sleep
            time.sleep(POLL_MS / 1000.0)
            
        except KeyboardInterrupt:
            print("\n\n👋 Image worker shutting down...")
            break
        except Exception as e:
            print(f"❌ Worker error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(5)  # Back off on error


if __name__ == '__main__':
    main()
