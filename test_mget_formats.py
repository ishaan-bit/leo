#!/usr/bin/env python3
"""Test MGET different formats."""

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

keys = [
    'reflection:refl_1761306580657_fqr0qaz13',
    'reflection:refl_1761315283762_alo31xt1u',
    'reflection:refl_1761316738873_cqpvpr80w'
]

# Try format 1: POST /mget with JSON array
print("\n1. POST /mget with JSON array:")
resp = requests.post(f"{url}/mget", headers=headers, json=keys)
print(f"   Status: {resp.status_code}")
print(f"   Response: {resp.json()}")

# Try format 2: POST with command array  
print("\n2. POST / with command array:")
resp = requests.post(f"{url}", headers=headers, json=["MGET"] + keys)
print(f"   Status: {resp.status_code}")
print(f"   Response: {resp.json()}")

# Try format 3: Pipeline
print("\n3. POST /pipeline:")
pipeline = [["GET", key] for key in keys]
resp = requests.post(f"{url}/pipeline", headers=headers, json=pipeline)
print(f"   Status: {resp.status_code}")
result = resp.json()
print(f"   Response: {result}")

print()
