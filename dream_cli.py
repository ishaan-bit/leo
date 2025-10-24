#!/usr/bin/env python3
"""
Dream CLI Agent - Terminal Preview (No Commits)
Connects to Upstash Redis, pulls reflections, generates dream sequence text.
Output: 12-line dream (3 acts × 4 lines) + emotional summary.
"""

import os
import sys
import json
import statistics
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from collections import Counter
import requests

# Upstash REST API client
class UpstashClient:
    def __init__(self):
        # Support both Vercel (KV_*) and Upstash (UPSTASH_*) naming conventions
        self.url = (
            os.getenv('UPSTASH_REDIS_REST_URL') or 
            os.getenv('KV_REST_API_URL')
        )
        self.token = (
            os.getenv('UPSTASH_REDIS_REST_TOKEN') or 
            os.getenv('KV_REST_API_TOKEN')
        )
        
        if not self.url or not self.token:
            raise ValueError(
                "Missing Upstash credentials.\n"
                "Set either:\n"
                "  UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (Upstash naming)\n"
                "  KV_REST_API_URL + KV_REST_API_TOKEN (Vercel naming)\n\n"
                "Get them from: Vercel project → Storage → Upstash Redis → .env.local tab\n"
                "Or check apps/web/.env.local"
            )
        
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def _execute(self, command: List[str]) -> any:
        """Execute Redis command via REST API"""
        response = requests.post(
            self.url,
            headers=self.headers,
            json=command,
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"Upstash error: {response.status_code} - {response.text}")
        
        data = response.json()
        return data.get('result')
    
    def get(self, key: str) -> Optional[str]:
        """GET key"""
        return self._execute(["GET", key])
    
    def lrange(self, key: str, start: int = 0, stop: int = -1) -> List[str]:
        """LRANGE key start stop"""
        result = self._execute(["LRANGE", key, start, stop])
        return result if result else []
    
    def scan(self, pattern: str, count: int = 100) -> List[str]:
        """SCAN 0 MATCH pattern COUNT count"""
        result = self._execute(["SCAN", "0", "MATCH", pattern, "COUNT", count])
        return result[1] if result else []
    
    def hgetall(self, key: str) -> Dict:
        """HGETALL key - returns hash as dict"""
        result = self._execute(["HGETALL", key])
        if not result:
            return {}
        # Convert flat array [k1, v1, k2, v2] to dict
        return {result[i]: result[i+1] for i in range(0, len(result), 2)}


def fetch_reflections(client: UpstashClient, sid: Optional[str] = None) -> List[Dict]:
    """
    Fetch reflections from Upstash.
    Priority: moments:{sid} list → fallback to multiple scan patterns
    """
    reflections = []
    
    # Strategy 1: If sid provided, try moments:{sid}
    if sid:
        moments_key = f"moments:{sid}"
        print(f"[DEBUG] Checking {moments_key}...", file=sys.stderr)
        
        raw_moments = client.lrange(moments_key, 0, -1)
        
        for raw in raw_moments:
            try:
                refl = json.loads(raw)
                reflections.append(refl)
            except json.JSONDecodeError:
                print(f"[WARN] Invalid JSON in moments list: {raw[:100]}", file=sys.stderr)
        
        if reflections:
            print(f"[DEBUG] Found {len(reflections)} reflections in {moments_key}", file=sys.stderr)
            return reflections
    
    # Strategy 2: Try different key patterns
    patterns = [
        "reflections:enriched:*",  # New pattern from worker
        "reflection:*",
        "refl:*",
        "refl_*",
        "moments:*",
    ]
    
    all_keys = []
    
    for pattern in patterns:
        print(f"[DEBUG] Scanning for {pattern}...", file=sys.stderr)
        keys = client.scan(pattern, count=200)
        
        if keys:
            print(f"[DEBUG] Found {len(keys)} keys matching {pattern}", file=sys.stderr)
            all_keys.extend(keys)
    
    # Remove duplicates
    all_keys = list(set(all_keys))
    print(f"[DEBUG] Total unique keys: {len(all_keys)}", file=sys.stderr)
    
    # Try to fetch each key
    for key in all_keys:
        try:
            # Try HGETALL first (hash)
            raw_data = client.hgetall(key)
            
            if raw_data:
                # Reconstruct reflection object from hash
                refl = {
                    'rid': raw_data.get('rid', key),
                    'sid': raw_data.get('sid'),
                    'timestamp': raw_data.get('timestamp'),
                    'normalized_text': raw_data.get('normalized_text'),
                    'raw_input': raw_data.get('raw_input'),
                }
                
                # Parse nested JSON fields
                if raw_data.get('final'):
                    refl['final'] = json.loads(raw_data['final'])
                if raw_data.get('post_enrichment'):
                    refl['post_enrichment'] = json.loads(raw_data['post_enrichment'])
                
                reflections.append(refl)
                print(f"[DEBUG] Parsed hash key: {key}", file=sys.stderr)
            else:
                # Try GET (string/JSON)
                raw_str = client.get(key)
                if raw_str:
                    try:
                        refl = json.loads(raw_str)
                        if 'rid' in refl or 'normalized_text' in refl:
                            reflections.append(refl)
                            print(f"[DEBUG] Parsed string key: {key}", file=sys.stderr)
                    except json.JSONDecodeError:
                        print(f"[WARN] Invalid JSON in {key}", file=sys.stderr)
        
        except Exception as e:
            print(f"[WARN] Error parsing {key}: {e}", file=sys.stderr)
    
    return reflections


def filter_valid_reflections(reflections: List[Dict]) -> List[Dict]:
    """Filter out deleted or empty reflections, sort by timestamp desc"""
    valid = [
        r for r in reflections
        if r.get('normalized_text') 
        and not r.get('deleted')
        and r.get('final')
    ]
    
    # Sort by timestamp (newest first)
    valid.sort(key=lambda r: r.get('timestamp', ''), reverse=True)
    
    return valid


def aggregate_emotions(reflections: List[Dict]) -> Dict:
    """
    Compute emotional aggregates:
    - valence_mean, arousal_mean
    - dominant_primary wheel emotion
    - delta_valence (latest vs average)
    - top expressed/invoked
    """
    if not reflections:
        return {}
    
    valences = []
    arousals = []
    primaries = []
    expressed_all = []
    invoked_all = []
    
    for r in reflections:
        final = r.get('final', {})
        
        if 'valence' in final:
            valences.append(final['valence'])
        if 'arousal' in final:
            arousals.append(final['arousal'])
        
        wheel = final.get('wheel', {})
        if wheel.get('primary'):
            primaries.append(wheel['primary'])
        
        if 'expressed' in final:
            expressed_all.append(final['expressed'])
        if 'invoked' in final:
            invoked_all.append(final['invoked'])
    
    # Aggregates
    valence_mean = statistics.mean(valences) if valences else 0.0
    arousal_mean = statistics.mean(arousals) if arousals else 0.0
    
    # Dominant primary (most frequent)
    primary_counts = Counter(primaries)
    dominant_primary = primary_counts.most_common(1)[0][0] if primary_counts else 'Peaceful'
    
    # Delta valence
    latest_valence = valences[0] if valences else 0.0
    delta_valence = latest_valence - valence_mean if len(valences) > 1 else 0.0
    
    # Top expressed/invoked
    expressed_top = Counter(expressed_all).most_common(1)[0][0] if expressed_all else 'calm'
    invoked_top = Counter(invoked_all).most_common(1)[0][0] if invoked_all else 'hope'
    
    return {
        'valence_mean': valence_mean,
        'arousal_mean': arousal_mean,
        'dominant_primary': dominant_primary,
        'delta_valence': delta_valence,
        'expressed_top': expressed_top,
        'invoked_top': invoked_top,
        'latest_valence': latest_valence,
        'count': len(reflections)
    }


def get_tone_palette(primary: str, valence: float, arousal: float) -> Dict[str, List[str]]:
    """
    Return lexical palette based on primary emotion + valence/arousal
    Returns: {setup: [], buildup: [], resolution: []}
    """
    palettes = {
        'Peaceful': {
            'setup': ['soft hush', 'early window', 'quiet breathing', 'stillness'],
            'buildup': ['holds its breath', 'meets halfway', 'listens where fear spoke', 'learns to slow'],
            'resolution': ['gentle return', 'lighter than yesterday', 'leans toward morning', 'softer dawn']
        },
        'Powerful': {
            'setup': ['fire beneath', 'rising current', 'unbroken stride', 'thunder waiting'],
            'buildup': ['breaks through', 'claims its ground', 'refuses silence', 'burns brighter'],
            'resolution': ['stands taller', 'voice finds form', 'strength remembers', 'bold horizon']
        },
        'Joyful': {
            'setup': ['light spills over', 'laughter echoes', 'warmth blooms', 'day opens wide'],
            'buildup': ['dances forward', 'heart leaps', 'sun catches fire', 'joy multiplies'],
            'resolution': ['radiance settles', 'smile lingers', 'world glows', 'bright tomorrow']
        },
        'Sad': {
            'setup': ['grey edges', 'weight settles', 'silence deepens', 'heavy sky'],
            'buildup': ['tears find room', 'sorrow speaks', 'heart aches', 'loss whispers'],
            'resolution': ['grief softens', 'rain stops', 'tender healing', 'quiet hope']
        },
        'Mad': {
            'setup': ['storm gathers', 'pressure builds', 'jaw tightens', 'fire sparks'],
            'buildup': ['rage roars', 'thunder cracks', 'fury rises', 'lightning strikes'],
            'resolution': ['storm passes', 'breath slows', 'anger cools', 'calm returns']
        },
        'Scared': {
            'setup': ['shadows lengthen', 'heart races', 'fear whispers', 'darkness creeps'],
            'buildup': ['panic swells', 'doubt multiplies', 'terror grips', 'walls close'],
            'resolution': ['courage stirs', 'light breaks', 'fear fades', 'safe ground']
        }
    }
    
    # Fallback to Peaceful if primary not found
    return palettes.get(primary, palettes['Peaceful'])


def construct_dream_lines(reflections: List[Dict], agg: Dict) -> List[Tuple[str, str]]:
    """
    Generate 12 dream lines (3 phases × 4 lines).
    Returns: [(line_text, source_rid), ...]
    """
    if not reflections:
        return [
            ("No moments found in Living City.", "n/a"),
            ("Try sharing a moment first.", "n/a"),
        ]
    
    palette = get_tone_palette(
        agg['dominant_primary'],
        agg['valence_mean'],
        agg['arousal_mean']
    )
    
    # Extract text fragments from reflections
    poems = []
    tips = []
    closing_lines = []
    
    for r in reflections[:5]:  # Use last 5
        pe = r.get('post_enrichment', {})
        
        if pe.get('poems'):
            for poem in pe['poems']:
                if isinstance(poem, dict) and poem.get('text'):
                    # Take first line of each poem
                    first_line = poem['text'].split('\n')[0].strip()
                    poems.append((first_line, r['rid']))
        
        if pe.get('tips'):
            for tip in pe['tips'][:2]:  # Max 2 tips per reflection
                tips.append((tip, r['rid']))
        
        if pe.get('closing_line'):
            closing_lines.append((pe['closing_line'], r['rid']))
    
    # Construct 12 lines
    lines = []
    
    # === SETUP (lines 1-4) ===
    setup_phrases = palette['setup']
    
    # Line 1: Use palette phrase
    lines.append((f"A {setup_phrases[0]} moves through the week.", reflections[0]['rid']))
    
    # Line 2: Use palette or poem fragment
    if poems:
        lines.append((poems[0][0], poems[0][1]))
    else:
        lines.append((f"The {setup_phrases[1]} still remembers.", reflections[0]['rid']))
    
    # Line 3: Contrast expressed + invoked
    expressed = agg['expressed_top']
    invoked = agg['invoked_top']
    lines.append((f"{invoked.capitalize()} sits quietly beside {expressed}.", reflections[0]['rid']))
    
    # Line 4: Use arousal-based imagery
    if agg['arousal_mean'] > 0.5:
        lines.append(("Energy hums like distant thunder.", reflections[0]['rid']))
    else:
        lines.append(("Stillness curls like morning mist.", reflections[0]['rid']))
    
    # === BUILD-UP (lines 5-8) ===
    buildup_phrases = palette['buildup']
    
    # Line 5: Palette
    lines.append((f"{agg['dominant_primary']} {buildup_phrases[0]}.", reflections[1]['rid'] if len(reflections) > 1 else reflections[0]['rid']))
    
    # Line 6: Use tip or palette
    if tips:
        lines.append((tips[0][0], tips[0][1]))
    else:
        lines.append((f"Doubt {buildup_phrases[1]}.", reflections[0]['rid']))
    
    # Line 7: Another palette phrase
    lines.append((f"Calm {buildup_phrases[2]}.", reflections[1]['rid'] if len(reflections) > 1 else reflections[0]['rid']))
    
    # Line 8: Transition phrase
    if agg['arousal_mean'] > 0.6:
        lines.append(("The air learns to quicken.", reflections[0]['rid']))
    else:
        lines.append(("The air learns to slow.", reflections[0]['rid']))
    
    # === RESOLUTION (lines 9-12) ===
    resolution_phrases = palette['resolution']
    
    # Line 9: Palette
    lines.append((f"Something {resolution_phrases[0]}.", reflections[0]['rid']))
    
    # Line 10: Delta valence (improving or declining)
    if agg['delta_valence'] > 0.1:
        lines.append((f"You move {resolution_phrases[1]}.", reflections[0]['rid']))
    elif agg['delta_valence'] < -0.1:
        lines.append(("You carry more than before.", reflections[0]['rid']))
    else:
        lines.append(("You stay steady, neither more nor less.", reflections[0]['rid']))
    
    # Line 11: Palette
    lines.append((f"The world {resolution_phrases[2]}.", reflections[0]['rid']))
    
    # Line 12: Closing line (from latest reflection or fallback)
    if closing_lines:
        lines.append((closing_lines[0][0], closing_lines[0][1]))
    else:
        lines.append((f"{agg['dominant_primary']} opens her eyes to a {resolution_phrases[3]}.", reflections[0]['rid']))
    
    return lines


def print_dream_sequence(lines: List[Tuple[str, str]], agg: Dict):
    """Print dream sequence with formatting"""
    print("\n" + "="*60)
    print("Dream Sequence Preview (Terminal)")
    print("="*60 + "\n")
    
    # SETUP
    print("— SETUP —")
    for i, (line, rid) in enumerate(lines[0:4], 1):
        print(f"{i}. {line}")
        print(f"   [source: {rid}]")
    
    print()
    
    # BUILD-UP
    print("— BUILD-UP —")
    for i, (line, rid) in enumerate(lines[4:8], 5):
        print(f"{i}. {line}")
        print(f"   [source: {rid}]")
    
    print()
    
    # RESOLUTION
    print("— RESOLUTION —")
    for i, (line, rid) in enumerate(lines[8:12], 9):
        print(f"{i}. {line}")
        print(f"   [source: {rid}]")
    
    print()
    
    # Summary
    print("="*60)
    print("Summary")
    print("="*60)
    print(f"dominant: {agg.get('dominant_primary', 'n/a')}")
    print(f"valence_mean: {agg.get('valence_mean', 0.0):+.2f}")
    print(f"arousal_mean: {agg.get('arousal_mean', 0.0):.2f}")
    
    delta = agg.get('delta_valence', 0.0)
    trend = "↑ improving" if delta > 0.1 else "↓ declining" if delta < -0.1 else "→ stable"
    print(f"trend: {trend} (Δ valence: {delta:+.2f})")
    
    print(f"reflections_used: {agg.get('count', 0)}")
    print()


def main():
    """Main entry point"""
    print("[Dream CLI Agent]", file=sys.stderr)
    print("[Mode: Terminal Preview - No Commits]\n", file=sys.stderr)
    
    try:
        # Connect to Upstash
        client = UpstashClient()
        print("[✓] Connected to Upstash Redis", file=sys.stderr)
        
        # Fetch reflections (auto-detect sid or scan all)
        sid = os.getenv('TARGET_SID')  # Optional: set TARGET_SID to filter by session
        
        reflections = fetch_reflections(client, sid)
        
        if not reflections:
            print("\n❌ No moments found in Living City.", file=sys.stderr)
            print("Try sharing a moment first at /reflect/{pigId}\n", file=sys.stderr)
            return
        
        # Filter valid
        valid_reflections = filter_valid_reflections(reflections)
        
        if not valid_reflections:
            print("\n❌ No valid reflections found (all deleted or empty).\n", file=sys.stderr)
            return
        
        # Use last 5
        last_five = valid_reflections[:5]
        print(f"[✓] Using {len(last_five)} most recent reflections", file=sys.stderr)
        
        # Aggregate emotions
        agg = aggregate_emotions(last_five)
        
        # Construct dream
        dream_lines = construct_dream_lines(last_five, agg)
        
        # Print to terminal
        print_dream_sequence(dream_lines, agg)
        
    except ValueError as e:
        print(f"\n❌ Configuration Error: {e}\n", file=sys.stderr)
        sys.exit(1)
    
    except Exception as e:
        print(f"\n❌ Upstash Error: {e}\n", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
