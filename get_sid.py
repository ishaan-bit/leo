#!/usr/bin/env python3
"""Get session ID from reflections."""

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

# Get first reflection
response = requests.post(f"{url}/GET/reflection:refl_1761306580657_fqr0qaz13", headers=headers)
if response.status_code == 200:
    data_str = response.json().get('result')
    if data_str:
        data = json.loads(data_str)
        print(data.get('sid'))
