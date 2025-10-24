#!/usr/bin/env python3
"""Debug Upstash data - check reflections, signin count, and micro-dream status."""

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

# Get Upstash credentials
url = os.getenv('KV_REST_API_URL') or os.getenv('UPSTASH_REDIS_REST_URL')
token = os.getenv('KV_REST_API_TOKEN') or os.getenv('UPSTASH_REDIS_REST_TOKEN')

if not url or not token:
    print("[✗] Missing Upstash credentials")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

print("\n" + "="*70)
print("UPSTASH DEBUG - Checking your data")
print("="*70)
print(f"URL: {url}")

# 1. Find all reflection keys
print("\n[1] Scanning for reflections:enriched:* keys...")
response = requests.post(f"{url}/SCAN/0/MATCH/reflections:enriched:*/COUNT/500", headers=headers)
if response.status_code == 200:
    result = response.json().get('result', [])
    keys = result[1] if len(result) > 1 else []
    print(f"    Found {len(keys)} reflection keys")
    
    if keys:
        # Group by session
        sessions = {}
        for key in keys:
            # Get the reflection data
            resp = requests.post(f"{url}/GET/{key}", headers=headers)
            if resp.status_code == 200:
                data_str = resp.json().get('result')
                if data_str:
                    try:
                        data = json.loads(data_str)
                        sid = data.get('sid', 'unknown')
                        if sid not in sessions:
                            sessions[sid] = []
                        sessions[sid].append({
                            'rid': data.get('rid'),
                            'timestamp': data.get('timestamp'),
                            'text': data.get('normalized_text', '')[:50]
                        })
                    except:
                        pass
        
        print(f"\n    Sessions found: {len(sessions)}")
        for sid, reflections in sessions.items():
            print(f"\n    Session: {sid}")
            print(f"    Reflections: {len(reflections)}")
            for r in sorted(reflections, key=lambda x: x.get('timestamp', '')):
                print(f"      - {r['rid']}: {r['text']}...")
            
            # Check signin_count for this session
            signin_key = f"signin_count:{sid}"
            resp = requests.post(f"{url}/GET/{signin_key}", headers=headers)
            if resp.status_code == 200:
                signin_count = resp.json().get('result')
                print(f"    signin_count:{sid} = {signin_count}")
            else:
                print(f"    signin_count:{sid} = (not set)")
            
            # Check micro_dream for this session
            dream_key = f"micro_dream:{sid}"
            resp = requests.post(f"{url}/GET/{dream_key}", headers=headers)
            if resp.status_code == 200:
                dream_data = resp.json().get('result')
                if dream_data:
                    try:
                        dream = json.loads(dream_data)
                        print(f"    micro_dream:{sid} EXISTS")
                        print(f"      Lines: {dream.get('lines', [])}")
                    except:
                        print(f"    micro_dream:{sid} = (parse error)")
                else:
                    print(f"    micro_dream:{sid} = (none)")
            else:
                print(f"    micro_dream:{sid} = (none)")

print("\n" + "="*70)
print("Debug complete")
print("="*70 + "\n")
