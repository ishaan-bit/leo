#!/usr/bin/env python3
"""
Micro-Dream Generator - Terminal Preview
Pulls reflections from Upstash, selects 3-5 key moments, generates 2-line summary.
"""

import os
import sys
import json
import statistics
from typing import List, Dict, Optional, Tuple
import requests
from collections import Counter


class UpstashClient:
    def __init__(self):
        self.url = os.getenv('UPSTASH_REDIS_REST_URL') or os.getenv('KV_REST_API_URL')
        self.token = os.getenv('UPSTASH_REDIS_REST_TOKEN') or os.getenv('KV_REST_API_TOKEN')
        
        if not self.url or not self.token:
            raise ValueError("Missing Upstash credentials. Set KV_REST_API_URL and KV_REST_API_TOKEN")
        
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def _execute(self, command: List[str]) -> any:
        response = requests.post(self.url, headers=self.headers, json=command, timeout=10)
        if response.status_code != 200:
            raise Exception(f"Upstash error: {response.status_code} - {response.text}")
        return response.json().get('result')
    
    def get(self, key: str) -> Optional[str]:
        return self._execute(["GET", key])
    
    def scan(self, pattern: str, count: int = 500) -> List[str]:
        result = self._execute(["SCAN", "0", "MATCH", pattern, "COUNT", count])
        return result[1] if result else []


def fetch_reflections(client: UpstashClient, sid: Optional[str] = None) -> List[Dict]:
    """Fetch reflections from reflections:enriched:* keys"""
    reflections = []
    
    keys = client.scan("reflections:enriched:*", count=500)
    
    for key in keys:
        try:
            raw_data = client.get(key)
            if raw_data:
                refl = json.loads(raw_data)
                
                # Filter by sid if provided
                if sid and refl.get('sid') != sid:
                    continue
                
                # Validate required fields
                if refl.get('rid') and refl.get('normalized_text') and refl.get('final'):
                    reflections.append(refl)
        
        except Exception:
            continue
    
    return reflections


def select_fade_moments(reflections: List[Dict]) -> List[Dict]:
    """
    Select 3-5 moments for fade sequence:
    - If 3-4 total: 2 recent + 1 old
    - If ≥5 total: 3 recent + 1 mid + 1 old
    """
    if len(reflections) < 3:
        return []
    
    # Sort by timestamp ascending
    sorted_refls = sorted(reflections, key=lambda r: r.get('timestamp', ''))
    total = len(sorted_refls)
    
    selected = []
    
    if total <= 4:
        # Select: oldest + 2 most recent
        old_idx = 0
        recent_indices = [total - 2, total - 1]
        
        selected = [sorted_refls[old_idx]] + [sorted_refls[i] for i in recent_indices]
    
    else:
        # Select: 1 old (bottom 25%) + 1 mid (50-65%) + 3 recent
        
        # OLD: Bottom 25%, pick one with highest |valence - mean|
        old_pool = sorted_refls[:max(1, total // 4)]
        valences = [r.get('final', {}).get('valence', 0) for r in sorted_refls]
        mean_val = statistics.mean(valences) if valences else 0
        
        old = max(old_pool, key=lambda r: abs(r.get('final', {}).get('valence', 0) - mean_val))
        
        # MID: 50-65% percentile, match dominant recent primary if possible
        mid_start = total // 2
        mid_end = int(total * 0.65)
        mid_pool = sorted_refls[mid_start:mid_end]
        
        # Get dominant primary from recent
        recent_primaries = [
            r.get('final', {}).get('wheel', {}).get('primary')
            for r in sorted_refls[-3:]
            if r.get('final', {}).get('wheel', {}).get('primary')
        ]
        dominant_recent = Counter(recent_primaries).most_common(1)[0][0] if recent_primaries else None
        
        # Try to match mid with dominant_recent
        mid = None
        if dominant_recent:
            for r in mid_pool:
                if r.get('final', {}).get('wheel', {}).get('primary') == dominant_recent:
                    mid = r
                    break
        
        if not mid and mid_pool:
            mid = mid_pool[len(mid_pool) // 2]  # Pick middle of mid range
        
        # RECENT: Last 3
        recent = sorted_refls[-3:]
        
        selected = [old] + ([mid] if mid else []) + recent
    
    # Deduplicate and maintain fade order
    seen_rids = set()
    fade_sequence = []
    for r in selected:
        if r['rid'] not in seen_rids:
            fade_sequence.append(r)
            seen_rids.add(r['rid'])
    
    return fade_sequence


def aggregate_metrics(moments: List[Dict]) -> Dict:
    """Compute valence_mean, arousal_mean, dominant_primary, delta_valence"""
    valences = [m.get('final', {}).get('valence', 0) for m in moments]
    arousals = [m.get('final', {}).get('arousal', 0) for m in moments]
    primaries = [m.get('final', {}).get('wheel', {}).get('primary') for m in moments if m.get('final', {}).get('wheel', {}).get('primary')]
    
    valence_mean = statistics.mean(valences) if valences else 0
    arousal_mean = statistics.mean(arousals) if arousals else 0
    
    dominant_primary = Counter(primaries).most_common(1)[0][0] if primaries else 'Peaceful'
    
    latest_valence = valences[-1] if valences else 0
    delta_valence = latest_valence - valence_mean if len(valences) > 1 else 0
    
    return {
        'valence_mean': valence_mean,
        'arousal_mean': arousal_mean,
        'dominant_primary': dominant_primary,
        'delta_valence': delta_valence,
        'latest_valence': latest_valence
    }


def generate_line1_tone(agg: Dict) -> str:
    """
    Line 1: Tone of Now
    Combine valence (+/-) + arousal (+/-) + dominant primary → weather/light sentence
    """
    valence = agg['valence_mean']
    arousal = agg['arousal_mean']
    primary = agg['dominant_primary']
    
    # Valence tone
    if valence > 0.3:
        val_word = "warmer"
    elif valence < -0.3:
        val_word = "heavier"
    else:
        val_word = "steady"
    
    # Arousal movement
    if arousal > 0.6:
        arousal_phrase = "the wind rising"
    elif arousal < 0.4:
        arousal_phrase = "the noise fading"
    else:
        arousal_phrase = "the air holding"
    
    # Primary color
    primary_phrases = {
        'Peaceful': "light softer",
        'Joyful': "sky brightening",
        'Powerful': "ground firmer",
        'Mad': "storm passing",
        'Sad': "clouds settling",
        'Scared': "shadows lifting"
    }
    
    primary_phrase = primary_phrases.get(primary, "air shifting")
    
    # Combine
    templates = [
        f"Week turning {val_word}, {arousal_phrase}.",
        f"Sky {val_word} but {arousal_phrase}.",
        f"The {primary_phrase}, {arousal_phrase}."
    ]
    
    # Pick based on dominant
    if primary in ['Mad', 'Scared']:
        return templates[2]
    elif abs(valence) > 0.4:
        return templates[0]
    else:
        return templates[1]


def generate_line2_direction(agg: Dict, latest_refl: Dict) -> str:
    """
    Line 2: Direction / Next
    Use delta_valence or latest closing_line
    """
    delta = agg['delta_valence']
    primary = agg['dominant_primary']
    
    # Try to use latest closing_line
    closing_line = latest_refl.get('post_enrichment', {}).get('closing_line', '')
    if closing_line:
        # Trim "See you tomorrow." and similar
        closing_line = closing_line.replace('See you tomorrow.', '').replace('see you tomorrow', '').strip()
        if closing_line and len(closing_line.split()) >= 3:
            return closing_line
    
    # Fallback based on delta_valence
    if delta >= 0.1:
        return "You're opening to calmer ground."
    elif delta <= -0.1:
        return "Hold gently; rest gathers strength."
    
    # Fallback based on primary
    primary_lines = {
        'Joyful': "Carry this light forward.",
        'Peaceful': "Let the calm keep watch.",
        'Powerful': "Stand in your strength.",
        'Mad': "Name it, reshape it.",
        'Sad': "Be gentle with what aches.",
        'Scared': "Breathe; you're not alone."
    }
    
    return primary_lines.get(primary, "Holding steady; keep the small light.")


def print_micro_dream(line1: str, line2: str, fade_rids: List[str]):
    """Print final output"""
    print("\nMICRO-DREAM PREVIEW")
    print(f"1) {line1}")
    print(f"2) {line2}")
    print()
    print(f"FADES: {' → '.join(fade_rids)}")
    print()


def main():
    try:
        # Connect to Upstash
        client = UpstashClient()
        
        # Fetch reflections
        sid = os.getenv('TARGET_SID')  # Optional
        reflections = fetch_reflections(client, sid)
        
        if not reflections:
            print("\n❌ No moments found in Living City.")
            print("Try sharing a moment first.\n")
            return
        
        # Filter valid
        valid = [r for r in reflections if r.get('normalized_text') and not r.get('deleted')]
        
        if len(valid) < 3:
            print("\n❌ Not enough moments for micro-dream.")
            print(f"Found {len(valid)}, need at least 3.\n")
            return
        
        # Select fade moments
        fade_moments = select_fade_moments(valid)
        
        if not fade_moments:
            print("\n❌ Could not select fade moments.\n")
            return
        
        # Aggregate metrics
        agg = aggregate_metrics(fade_moments)
        
        # Generate 2 lines
        line1 = generate_line1_tone(agg)
        line2 = generate_line2_direction(agg, fade_moments[-1])
        
        # Print output
        fade_rids = [m['rid'] for m in fade_moments]
        print_micro_dream(line1, line2, fade_rids)
    
    except ValueError as e:
        print(f"\n❌ Configuration Error: {e}\n")
        sys.exit(1)
    
    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
