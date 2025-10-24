#!/usr/bin/env python3
"""Check if reflections have post_enrichment."""

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

print("\n" + "="*70)
print("CHECK REFLECTIONS FOR POST-ENRICHMENT")
print("="*70 + "\n")

rids = [
    'refl_1761306580657_fqr0qaz13',
    'refl_1761315283762_alo31xt1u',
    'refl_1761316738873_cqpvpr80w'
]

for rid in rids:
    key = f"reflection:{rid}"
    response = requests.post(f"{url}/GET/{key}", headers=headers)
    
    if response.status_code == 200:
        data_str = response.json().get('result')
        if data_str:
            data = json.loads(data_str)
            
            has_final = 'final' in data
            has_post = 'post_enrichment' in data
            
            print(f"{rid}:")
            print(f"  final: {'✓' if has_final else '✗'}")
            print(f"  post_enrichment: {'✓' if has_post else '✗'}")
            
            if has_post:
                pe = data['post_enrichment']
                print(f"    poems: {len(pe.get('poems', []))}")
                print(f"    tips: {len(pe.get('tips', []))}")
                print(f"    closing: {pe.get('closing_line', '(none)')[:50]}")
            
            print()

print("="*70 + "\n")
