#!/usr/bin/env python3
"""Test MGET."""

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

headers = {"Authorization": f"Bearer {token}"}

# Test GET single key
print("\n1. GET single key:")
resp = requests.post(f"{url}/GET/reflection:refl_1761306580657_fqr0qaz13", headers=headers)
print(f"   Status: {resp.status_code}")
if resp.status_code == 200:
    result = resp.json().get('result')
    if result:
        data = json.loads(result)
        print(f"   SID: {data.get('sid')}")
        print(f"   Timestamp: {data.get('timestamp')}")
    else:
        print(f"   Result: None")

# Test MGET
print("\n2. MGET multiple keys:")
keys = [
    'reflection:refl_1761306580657_fqr0qaz13',
    'reflection:refl_1761315283762_alo31xt1u',
    'reflection:refl_1761316738873_cqpvpr80w'
]

resp = requests.post(f"{url}/mget", headers=headers, json=keys)
print(f"   Status: {resp.status_code}")
print(f"   Response: {resp.json()}")

print()
