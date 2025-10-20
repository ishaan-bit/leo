"""
Quick Test - Push a test reflection to the queue
"""

import os
import json
from datetime import datetime
from dotenv import load_dotenv
from src.modules.redis_client import get_redis

load_dotenv()

# Create test reflection
test_reflection = {
    "rid": "refl_test_1234567890",
    "sid": "sess_test",
    "timestamp": datetime.utcnow().isoformat() + 'Z',
    "normalized_text": "very tired and irritated, didn't make much progress today",
    "lang_detected": "english",
    "input_mode": "typing",
    "typing_summary": {
        "total_chars": 56,
        "total_words": 10,
        "duration_ms": 5000,
        "wpm": 120,
        "pauses": [],
        "avg_pause_ms": 0,
        "autocorrect_events": 0,
        "backspace_count": 2
    },
    "voice_summary": None,
    "client_context": {
        "timezone": "Asia/Kolkata",
        "device": "desktop"
    }
}

# Connect to Redis
redis = get_redis()

# Push to normalized queue
queue_key = os.getenv('REFLECTIONS_NORMALIZED_KEY', 'reflections:normalized')

print(f"🔄 Pushing test reflection to {queue_key}...")
print(f"   RID: {test_reflection['rid']}")
print(f"   Text: {test_reflection['normalized_text']}")

# Use RPUSH to add to end of list
result = redis._execute(['RPUSH', queue_key, json.dumps(test_reflection)])

if result:
    print(f"✅ Test reflection pushed! Queue length: {result}")
    print(f"\n👀 Watch the worker terminal for processing...")
    print(f"\n📊 Once processed, check enriched data:")
    print(f"   Key: reflections:enriched:{test_reflection['rid']}")
else:
    print(f"❌ Failed to push test reflection")
