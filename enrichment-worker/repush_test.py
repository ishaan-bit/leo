"""
Push reflection from your test back to queue
"""
import json
import os
from dotenv import load_dotenv

load_dotenv()

from src.modules.redis_client import get_redis

# Your actual reflection
test_reflection = {
    "rid": "refl_1760937985642_awea6h1dg",
    "sid": "sess_1760847437034_y2zlmiso5",
    "timestamp": "2025-10-20T05:26:23.418Z",
    "normalized_text": "im irritated that even after 24 hours of working straight im still stuck at the same point.",
    "lang_detected": "en",
    "input_mode": "typing",
    "client_context": {
        "device": "desktop",
        "locale": "en-US",
        "timezone": "Asia/Calcutta"
    }
}

# Connect to Redis
redis = get_redis()

# Push to normalized queue
queue_key = os.getenv('REFLECTIONS_NORMALIZED_KEY', 'reflections:normalized')

print(f"🔄 Re-pushing your reflection to {queue_key}...")
print(f"   RID: {test_reflection['rid']}")
print(f"   Text: {test_reflection['normalized_text']}")

# Use RPUSH to add to end of list
result = redis._execute(['RPUSH', queue_key, json.dumps(test_reflection)])

if result:
    print(f"✅ Reflection re-pushed! Queue length: {result}")
    print(f"\n👀 Watch the worker terminal - it should process within 60 seconds...")
else:
    print(f"❌ Failed to push reflection")
