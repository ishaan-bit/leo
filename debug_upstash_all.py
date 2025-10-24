#!/usr/bin/env python3
"""Debug Upstash - find ALL keys."""

import os
import sys
import json
import requests
from pathlib import Path

# Load .env.local
env_path = Path(__file__).parent / 'apps' / 'web' / '.env.local'
if env_path.exists():
    with open(env_path, 'r') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                key, value = line.split('=', 1)
                value = value.strip().strip('"').strip("'")
                if value:
                    os.environ[key] = value

url = os.getenv('KV_REST_API_URL') or os.getenv('UPSTASH_REDIS_REST_URL')
token = os.getenv('KV_REST_API_TOKEN') or os.getenv('UPSTASH_REDIS_REST_TOKEN')

if not url or not token:
    print("[✗] Missing Upstash credentials")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

print("\n" + "="*70)
print("UPSTASH - ALL KEYS")
print("="*70)

# Scan for ALL keys
cursor = "0"
all_keys = []

while True:
    response = requests.post(f"{url}/SCAN/{cursor}/COUNT/100", headers=headers)
    if response.status_code != 200:
        print(f"Error: {response.status_code}")
        break
    
    result = response.json().get('result', [])
    if len(result) < 2:
        break
    
    new_cursor = result[0]
    keys = result[1]
    all_keys.extend(keys)
    
    if new_cursor == "0":
        break
    cursor = new_cursor

print(f"\nTotal keys: {len(all_keys)}\n")

# Group by pattern
patterns = {}
for key in all_keys:
    if ':' in key:
        prefix = key.split(':')[0]
    else:
        prefix = 'other'
    
    if prefix not in patterns:
        patterns[prefix] = []
    patterns[prefix].append(key)

for prefix, keys in sorted(patterns.items()):
    print(f"\n[{prefix}:*] ({len(keys)} keys)")
    for key in sorted(keys)[:10]:  # Show first 10
        print(f"  {key}")
    if len(keys) > 10:
        print(f"  ... and {len(keys) - 10} more")

print("\n" + "="*70 + "\n")
