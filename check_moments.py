#!/usr/bin/env python3
"""Quick script to check Upstash reflection count and owner breakdown."""

import os
import json
from dotenv import load_dotenv

# Load environment from apps/web/.env.local
load_dotenv('apps/web/.env.local')

from micro_dream_agent import UpstashClient

# Map KV_REST_API_* to UPSTASH_REDIS_REST_*
upstash_url = os.getenv('UPSTASH_REDIS_REST_URL') or os.getenv('KV_REST_API_URL')
upstash_token = os.getenv('UPSTASH_REDIS_REST_TOKEN') or os.getenv('KV_REST_API_TOKEN')

if not upstash_url or not upstash_token:
    print("❌ Missing UPSTASH credentials in apps/web/.env.local")
    print(f"   KV_REST_API_URL found: {bool(os.getenv('KV_REST_API_URL'))}")
    print(f"   KV_REST_API_TOKEN found: {bool(os.getenv('KV_REST_API_TOKEN'))}")
    exit(1)

upstash = UpstashClient(upstash_url, upstash_token)

# Get all reflection keys
keys = upstash.keys('reflection:*')
print(f"\n{'='*60}")
print(f"Total reflection keys found: {len(keys)}")
print(f"{'='*60}")

if not keys:
    print("\n❌ No reflections found in Upstash")
    exit(0)

# Fetch all reflections
values = upstash.mget(keys)

reflections = []
for key, val in zip(keys, values):
    if not val:
        continue
    
    try:
        data = json.loads(val)
        reflections.append({
            'rid': data.get('rid', key.split(':')[-1]),
            'owner_id': data.get('owner_id', 'unknown'),
            'timestamp': data.get('timestamp', 0),
            'pig_id': data.get('pig_id', 'unknown'),
        })
    except json.JSONDecodeError:
        continue

print(f"\nValid reflections parsed: {len(reflections)}\n")

# Group by owner_id
from collections import defaultdict
by_owner = defaultdict(list)
for r in reflections:
    by_owner[r['owner_id']].append(r)

# Display breakdown
print("Reflections by owner_id:")
print("-" * 60)
for owner_id, moments in sorted(by_owner.items()):
    print(f"\n{owner_id}: {len(moments)} moment(s)")
    for m in sorted(moments, key=lambda x: x['timestamp']):
        print(f"  - {m['rid'][:20]}... (pig: {m['pig_id']})")

print(f"\n{'='*60}\n")

# Check signin counters
print("Signin counters in Upstash:")
print("-" * 60)
for owner_id in by_owner.keys():
    count = upstash.get(f'signin_count:{owner_id}')
    gap = upstash.get(f'dream_gap_cursor:{owner_id}')
    print(f"{owner_id}:")
    print(f"  signin_count: {count or 0}")
    print(f"  dream_gap_cursor: {gap or 0}")

print(f"\n{'='*60}\n")
