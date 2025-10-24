#!/usr/bin/env python3
"""Run micro-dream agent with loaded env."""

import os
import sys
from pathlib import Path

# Force UTF-8 output
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

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

# Map KV_REST_API_* to UPSTASH_REDIS_REST_*
if 'KV_REST_API_URL' in os.environ and 'UPSTASH_REDIS_REST_URL' not in os.environ:
    os.environ['UPSTASH_REDIS_REST_URL'] = os.environ['KV_REST_API_URL']

if 'KV_REST_API_TOKEN' in os.environ and 'UPSTASH_REDIS_REST_TOKEN' not in os.environ:
    os.environ['UPSTASH_REDIS_REST_TOKEN'] = os.environ['KV_REST_API_TOKEN']

# Set test params
os.environ['SID'] = 'sess_1760847437034_y2zlmiso5'
os.environ['SKIP_OLLAMA'] = '1'

# Run agent
import micro_dream_agent
micro_dream_agent.main()
