#!/usr/bin/env python3
"""
Manually trigger micro-dream generation for testing.
This bypasses the API and directly runs the agent.
"""

import os
import json
from dotenv import load_dotenv

# Load environment
load_dotenv('apps/web/.env.local')

from micro_dream_agent import UpstashClient, OllamaClient, MicroDreamAgent

# Get credentials
upstash_url = os.getenv('UPSTASH_REDIS_REST_URL') or os.getenv('KV_REST_API_URL')
upstash_token = os.getenv('UPSTASH_REDIS_REST_TOKEN') or os.getenv('KV_REST_API_TOKEN')

if not upstash_url or not upstash_token:
    print("❌ Missing UPSTASH credentials")
    exit(1)

# Get owner_id from Upstash
upstash = UpstashClient(upstash_url, upstash_token)
keys = upstash.keys('reflection:*')

if not keys:
    print("❌ No reflections found")
    exit(1)

# Get first reflection to extract owner_id
val = upstash.get(keys[0])
data = json.loads(val)
owner_id = data.get('owner_id', 'unknown')

print(f"\n{'='*60}")
print(f"MANUAL MICRO-DREAM TRIGGER")
print(f"{'='*60}")
print(f"Owner ID: {owner_id}")
print(f"Reflections found: {len(keys)}")
print(f"{'='*60}\n")

# Initialize clients
ollama = OllamaClient()

# Run agent with FORCE_DREAM=1 to bypass signin gating
agent = MicroDreamAgent(upstash, ollama)
result = agent.run(owner_id, force_dream=True, skip_ollama=True)

if not result:
    print("\n❌ Micro-dream generation failed")
    exit(1)

# Print results
print(f"\n{'='*60}")
print(f"✅ MICRO-DREAM GENERATED")
print(f"{'='*60}")
print(f"Line 1: {result['lines'][0]}")
print(f"Line 2: {result['lines'][1]}")
print(f"\nFades: {' → '.join([f[:20] for f in result['fades']])}")
print(f"Dominant: {result['metrics']['dominant_primary']}")
print(f"Valence: {result['metrics']['valence_mean']:+.2f}")
print(f"Δ Valence: {result['metrics']['delta_valence']:+.2f}")
print(f"\nStored in Upstash: micro_dream:{owner_id}")
print(f"{'='*60}\n")

# Also increment signin_count manually to 4 so it displays
current = int(upstash.get(f'signin_count:{owner_id}') or 0)
upstash.set(f'signin_count:{owner_id}', '4')  # Set to 4 for first display
print(f"✅ Set signin_count:{owner_id} from {current} → 4 (will display on next sign-in)")
print()
