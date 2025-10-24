#!/usr/bin/env python3
"""Real-time monitoring of Upstash state after each reflection."""

import os
import json
from dotenv import load_dotenv
load_dotenv('apps/web/.env.local')

from micro_dream_agent import UpstashClient

upstash = UpstashClient(
    os.getenv('KV_REST_API_URL'),
    os.getenv('KV_REST_API_TOKEN')
)

print("\n" + "="*60)
print("UPSTASH MONITORING - Real-time State")
print("="*60)

# 1. Reflections
reflection_keys = upstash.keys('reflection:*')
print(f"\n📝 REFLECTIONS: {len(reflection_keys)} found")

if reflection_keys:
    values = upstash.mget(reflection_keys)
    for key, val in zip(reflection_keys, values):
        if val:
            data = json.loads(val)
            print(f"   - {data.get('rid', 'unknown')}")
            print(f"     owner_id: {data.get('owner_id', 'unknown')}")
            print(f"     timestamp: {data.get('timestamp', 'unknown')}")

# 2. Signin counters
print(f"\n🔢 SIGNIN COUNTERS:")
signin_keys = upstash.keys('signin_count:*')
if signin_keys:
    for key in signin_keys:
        count = upstash.get(key)
        print(f"   {key}: {count}")
else:
    print("   (none found)")

# 3. Micro-dreams
print(f"\n🌙 MICRO-DREAMS:")
dream_keys = upstash.keys('micro_dream:*')
if dream_keys:
    for key in dream_keys:
        data = upstash.get(key)
        if data:
            dream = json.loads(data)
            print(f"   {key}")
            print(f"   Line 1: {dream.get('lines', [''])[0]}")
            print(f"   Line 2: {dream.get('lines', ['', ''])[1]}")
else:
    print("   (none found)")

# 4. Gap cursors
print(f"\n📍 GAP CURSORS:")
cursor_keys = upstash.keys('dream_gap_cursor:*')
if cursor_keys:
    for key in cursor_keys:
        cursor = upstash.get(key)
        print(f"   {key}: {cursor}")
else:
    print("   (none found)")

print("\n" + "="*60 + "\n")
