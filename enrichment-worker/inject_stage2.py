"""
Inject Stage 2 post_enrichment payload for testing

This script adds final.post_enrichment to a reflection, triggering the
breathing window illumination and playback sequence.

Usage:
    python inject_stage2.py <reflection_id> <primary_emotion>
    
Example:
    python inject_stage2.py refl_1761063801626_cpsu9k65r joyful
"""

import sys
import json
import requests
from pathlib import Path

def load_env():
    env_path = Path(__file__).parent.parent / 'apps' / 'web' / '.env.local'
    env = {}
    
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    value = value.strip('"').strip("'")
                    env[key] = value
    
    return env

# Sample payloads for each emotion
STAGE2_PAYLOADS = {
    'joyful': {
        'poems': [
            'Light spills through\nwhere joy lives',
            'This warmth\nis yours to keep'
        ],
        'tips': [
            'Notice what makes you smile',
            'Share this feeling with someone',
            'Let it fill your chest'
        ],
        'closing_line': 'May this brightness stay with you',
        'tip_moods': ['celebratory', 'peaceful', 'celebratory']
    },
    'powerful': {
        'poems': [
            'You are the storm\nand the stillness after',
            'This strength\nwas always yours'
        ],
        'tips': [
            'Feel your feet on the ground',
            'Own this moment fully',
            'Let your voice be heard'
        ],
        'closing_line': 'Stand tall in what you know',
        'tip_moods': ['pride', 'pride', 'celebratory']
    },
    'peaceful': {
        'poems': [
            'Soft edges\ngentle breathing',
            'Here, everything\ncan slow down'
        ],
        'tips': [
            'Let your shoulders drop',
            'Notice the quiet spaces',
            'This calm is always here'
        ],
        'closing_line': 'Rest in this stillness',
        'tip_moods': ['peaceful', 'peaceful', 'peaceful']
    },
    'sad': {
        'poems': [
            'Even rain\nfeeds the earth',
            'This heaviness\nwill soften'
        ],
        'tips': [
            'Let it move through you',
            'There\'s no rush to be okay',
            'Tears are part of healing'
        ],
        'closing_line': 'Be gentle with yourself',
        'tip_moods': ['peaceful', 'peaceful', 'pride']
    },
    'mad': {
        'poems': [
            'Fire burns\nbut doesn\'t consume',
            'Your anger\nis information'
        ],
        'tips': [
            'Name what crossed your boundary',
            'This energy can transform',
            'What do you need to protect?'
        ],
        'closing_line': 'Your boundaries matter',
        'tip_moods': ['pride', 'celebratory', 'pride']
    },
    'scared': {
        'poems': [
            'Fear keeps you\nwatchful, alive',
            'You\'ve survived\nevery storm so far'
        ],
        'tips': [
            'What feels unsafe right now?',
            'Ground yourself in what\'s real',
            'You don\'t have to face this alone'
        ],
        'closing_line': 'You are still here, still breathing',
        'tip_moods': ['peaceful', 'pride', 'peaceful']
    },
}

def inject_stage2(rid: str, primary: str, env: dict) -> bool:
    kv_url = env.get('KV_REST_API_URL')
    kv_token = env.get('KV_REST_API_TOKEN')
    
    if not kv_url or not kv_token:
        print("❌ Missing KV credentials in .env.local")
        return False
    
    kv_url = kv_url.rstrip('/')
    key = f"reflection:{rid}"
    
    # 1. GET current reflection
    print(f"🔍 Fetching {key}...")
    
    try:
        resp = requests.get(
            f"{kv_url}/get/{key}",
            headers={"Authorization": f"Bearer {kv_token}"}
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"❌ Failed to fetch: {e}")
        return False
    
    result = data.get('result')
    if not result:
        print(f"❌ No reflection found: {key}")
        return False
    
    # 2. Parse JSON
    reflection = json.loads(result) if isinstance(result, str) else result
    
    print(f"✅ Found reflection")
    
    # 3. Inject post_enrichment payload
    if 'final' not in reflection:
        reflection['final'] = {}
    
    payload = STAGE2_PAYLOADS.get(primary.lower())
    if not payload:
        print(f"❌ Unknown emotion: {primary}")
        return False
    
    reflection['final']['post_enrichment'] = payload
    
    print(f"💉 Injecting Stage 2 payload for {primary}:")
    print(f"   Poems: {len(payload['poems'])}")
    print(f"   Tips: {len(payload['tips'])}")
    print(f"   Moods: {payload['tip_moods']}")
    
    # 4. Write back
    try:
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
        
        print(f"✅ Stage 2 payload injected!")
        print(f"\n🎬 Watch the breathing phase:")
        print(f"   - Window should illuminate on primary tower")
        print(f"   - Poems appear during inhale/exhale")
        print(f"   - Tips display with micro-animations")
        print(f"   - Breathing slows to 6s resting pulse")
        print(f"   - Closing cue with sticky-note icon")
        
        return True
        
    except Exception as e:
        print(f"❌ Failed to write: {e}")
        return False


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    
    rid = sys.argv[1]
    primary = sys.argv[2].lower()
    
    if primary not in STAGE2_PAYLOADS:
        print(f"❌ Invalid emotion: {primary}")
        print(f"   Valid: {', '.join(STAGE2_PAYLOADS.keys())}")
        sys.exit(1)
    
    env = load_env()
    
    if not env.get('KV_REST_API_URL'):
        print("❌ Could not load .env.local")
        sys.exit(1)
    
    success = inject_stage2(rid, primary, env)
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
