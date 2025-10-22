"""
Inject primary emotion into a reflection for local testing

This script updates an existing reflection in Upstash KV to add the final.wheel.primary
field, triggering the CityInterlude zoom sequence without waiting for ML enrichment.

Usage:
    python inject_primary.py <reflection_id> <primary_emotion>
    
Examples:
    python inject_primary.py refl_1761063801626_cpsu9k65r sad
    python inject_primary.py refl_1761063801626_cpsu9k65r joyful
    
Valid primary emotions (Willcox 6):
    - joyful (Vera tower - gold)
    - powerful (Vanta tower - orange)
    - peaceful (Haven tower - blue)
    - sad (Ashmere tower - gray)
    - mad (Vire tower - red)
    - scared (Sable tower - purple)
"""

import sys
import json
import os
import requests
from pathlib import Path
from typing import Optional

# Load env from web/.env.local
def load_env():
    env_path = Path(__file__).parent.parent / 'apps' / 'web' / '.env.local'
    env = {}
    
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    # Remove quotes
                    value = value.strip('"').strip("'")
                    env[key] = value
    
    return env

VALID_PRIMARIES = ['joyful', 'powerful', 'peaceful', 'sad', 'mad', 'scared']

def inject_primary(rid: str, primary: str, env: dict) -> bool:
    """
    Fetch reflection from Upstash, inject final.wheel.primary, write back
    """
    kv_url = env.get('KV_REST_API_URL')
    kv_token = env.get('KV_REST_API_TOKEN')
    
    if not kv_url or not kv_token:
        print("❌ Missing KV_REST_API_URL or KV_REST_API_TOKEN in .env.local")
        return False
    
    # Remove trailing slash
    kv_url = kv_url.rstrip('/')
    
    key = f"reflection:{rid}"
    
    # 1. GET current value
    print(f"🔍 Fetching {key} from Upstash...")
    
    try:
        resp = requests.get(
            f"{kv_url}/get/{key}",
            headers={"Authorization": f"Bearer {kv_token}"}
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"❌ Failed to fetch reflection: {e}")
        return False
    
    result = data.get('result')
    if not result:
        print(f"❌ No reflection found for key: {key}")
        print(f"   Make sure you've submitted a reflection first!")
        return False
    
    # 2. Parse JSON (Upstash may return string or already parsed)
    if isinstance(result, str):
        try:
            reflection = json.loads(result)
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse JSON: {e}")
            return False
    else:
        reflection = result
    
    print(f"✅ Found reflection: {rid}")
    print(f"   Text: {reflection.get('raw_text', 'N/A')[:50]}...")
    
    # 3. Inject final.wheel.primary
    if 'final' not in reflection:
        reflection['final'] = {}
    
    if 'wheel' not in reflection['final']:
        reflection['final']['wheel'] = {}
    
    # Map to expected backend format (lowercase for Willcox)
    reflection['final']['wheel']['primary'] = primary.lower()
    reflection['final']['wheel']['secondary'] = 'trust'  # Default secondary
    
    # Add valence/arousal based on emotion
    valence_map = {
        'joyful': 0.85,
        'powerful': 0.65,
        'peaceful': 0.75,
        'sad': 0.15,
        'mad': 0.25,
        'scared': 0.20,
    }
    
    arousal_map = {
        'joyful': 0.75,
        'powerful': 0.85,
        'peaceful': 0.25,
        'sad': 0.35,
        'mad': 0.80,
        'scared': 0.70,
    }
    
    reflection['final']['valence'] = valence_map.get(primary.lower(), 0.5)
    reflection['final']['arousal'] = arousal_map.get(primary.lower(), 0.5)
    reflection['final']['confidence'] = 0.88
    
    print(f"💉 Injecting primary: {primary}")
    print(f"   Valence: {reflection['final']['valence']}")
    print(f"   Arousal: {reflection['final']['arousal']}")
    
    # 4. Write back to Upstash
    try:
        # Upstash SET command format: /set/{key} with body as the value
        # We need to send the JSON string as the direct body
        value_str = json.dumps(reflection)
        
        resp = requests.post(
            f"{kv_url}/set/{key}",
            headers={
                "Authorization": f"Bearer {kv_token}",
                "Content-Type": "text/plain"
            },
            data=value_str
        )
        resp.raise_for_status()
        result = resp.json()
        
        print(f"✅ Updated reflection in Upstash: {result}")
        print(f"\n🎯 Primary emotion '{primary}' injected successfully!")
        print(f"   Watch your browser console - CityInterlude should detect it within ~3.5s")
        print(f"   and trigger the zoom sequence to the {primary} tower.")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to write to Upstash: {e}")
        return False


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    rid = sys.argv[1]
    primary = sys.argv[2].lower()
    
    if not rid.startswith('refl_'):
        print(f"❌ Invalid reflection ID: {rid}")
        print("   Expected format: refl_<timestamp>_<random>")
        sys.exit(1)
    
    if primary not in VALID_PRIMARIES:
        print(f"❌ Invalid primary emotion: {primary}")
        print(f"   Valid options: {', '.join(VALID_PRIMARIES)}")
        sys.exit(1)
    
    # Load environment
    env = load_env()
    
    if not env.get('KV_REST_API_URL'):
        print("❌ Could not load .env.local from apps/web/")
        print("   Make sure apps/web/.env.local exists with KV_REST_API_URL and KV_REST_API_TOKEN")
        sys.exit(1)
    
    print(f"🔧 Using Upstash KV: {env['KV_REST_API_URL'][:40]}...")
    print()
    
    success = inject_primary(rid, primary, env)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
