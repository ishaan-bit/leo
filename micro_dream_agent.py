#!/usr/bin/env python3
"""
Micro-Dream Agent — Production Version
Generates 2-line micro-dreams from Upstash reflections with sign-in display gating.

Environment:
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  SID (session ID)
  FORCE_DREAM=1 (optional, bypass gating)

Output:
  - Writes micro_dream:{sid} to Upstash (7-day TTL)
  - Prints terminal preview with fade sequence + metrics
  - Updates signin_count and dream_gap_cursor
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import Counter


class UpstashClient:
    """REST API client for Vercel Upstash Redis."""
    
    def __init__(self, url: str, token: str):
        self.url = url.rstrip('/')
        self.token = token
        self.headers = {'Authorization': f'Bearer {token}'}
    
    def get(self, key: str) -> Optional[str]:
        """GET key value."""
        resp = requests.post(
            f'{self.url}/get/{key}',
            headers=self.headers,
            timeout=10
        )
        resp.raise_for_status()
        result = resp.json().get('result')
        return result
    
    def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """SET key value with optional expiry (seconds)."""
        # Upstash REST API format: POST / with ["SET", key, value, "EX", ttl]
        payload = ["SET", key, value]
        if ex:
            payload.extend(["EX", str(ex)])
        
        resp = requests.post(
            self.url,
            headers=self.headers,
            json=payload,
            timeout=10
        )
        resp.raise_for_status()
        return resp.json().get('result') == 'OK'
    
    def incr(self, key: str) -> int:
        """INCR key, returns new value."""
        resp = requests.post(
            f'{self.url}/incr/{key}',
            headers=self.headers,
            timeout=10
        )
        resp.raise_for_status()
        return resp.json().get('result', 0)
    
    def keys(self, pattern: str) -> List[str]:
        """KEYS pattern."""
        resp = requests.post(
            f'{self.url}/keys/{pattern}',
            headers=self.headers,
            timeout=10
        )
        resp.raise_for_status()
        return resp.json().get('result', [])
    
    def mget(self, keys: List[str]) -> List[Optional[str]]:
        """MGET multiple keys."""
        if not keys:
            return []
        
        # Upstash REST API format: POST / with ["MGET", key1, key2, ...]
        resp = requests.post(
            self.url,
            headers=self.headers,
            json=["MGET"] + keys,
            timeout=15
        )
        resp.raise_for_status()
        return resp.json().get('result', [])


class OllamaClient:
    """Local Ollama API client for text refinement."""
    
    def __init__(self, base_url: str = 'http://localhost:11434'):
        self.base_url = base_url.rstrip('/')
    
    def refine_line(self, text: str, context: str, temperature: float = 0.2, timeout: int = 15) -> str:
        """Refine a line with Ollama phi3."""
        prompt = f"{context}\n\nOriginal: {text}\n\nRefined version (6-10 words, direct and specific):"
        
        payload = {
            'model': 'phi3:latest',
            'prompt': prompt,
            'stream': False,
            'options': {
                'temperature': temperature,
                'num_predict': 20
            }
        }
        
        try:
            resp = requests.post(
                f'{self.base_url}/api/generate',
                json=payload,
                timeout=timeout
            )
            resp.raise_for_status()
            refined = resp.json().get('response', '').strip()
            
            # Clean up artifacts
            refined = refined.replace('"', '').replace('\n', ' ').strip()
            if not refined or len(refined) > 80:
                return text  # Fallback to original
            
            return refined
        
        except Exception as e:
            print(f"[⚠] Ollama refinement failed: {e}, using raw line")
            return text


class MicroDreamAgent:
    """Main agent for micro-dream generation and sign-in gating."""
    
    def __init__(self, upstash: UpstashClient, ollama: OllamaClient):
        self.upstash = upstash
        self.ollama = ollama
    
    def fetch_reflections(self, sid: str) -> List[Dict]:
        """Fetch all reflections for session, sorted by timestamp."""
        # Try multiple key patterns
        keys = self.upstash.keys('reflection:*')  # Current format: reflection:refl_xxx
        
        if not keys:
            keys = self.upstash.keys(f'reflections:enriched:*')  # Old enriched format
        
        if not keys:
            keys = self.upstash.keys('refl:*')  # Legacy fallback
        
        if not keys:
            print(f"[X] No reflection keys found")
            return []
        
        # Fetch all reflection JSONs
        values = self.upstash.mget(keys)
        
        reflections = []
        for key, val in zip(keys, values):
            if not val:
                continue
            
            try:
                data = json.loads(val)
                
                # Filter by session ID
                if data.get('sid') != sid:
                    continue
                
                # Validate structure
                if 'timestamp' not in data or 'final' not in data:
                    continue
                
                final = data.get('final', {})
                valence = final.get('valence', 0.0)
                arousal = final.get('arousal', 0.0)
                primary = final.get('wheel', {}).get('primary', 'peaceful').lower()
                
                # Extract closing line
                closing_line = ''
                post = data.get('post_enrichment', {})
                if post.get('closing_line'):
                    closing_line = post['closing_line'].replace('See you tomorrow.', '').strip()
                
                reflections.append({
                    'rid': data.get('rid', key.split(':')[-1]),
                    'sid': data.get('sid', sid),
                    'timestamp': data['timestamp'],
                    'valence': valence,
                    'arousal': arousal,
                    'primary': primary,
                    'closing_line': closing_line,
                    'text': data.get('normalized_text', '')
                })
            
            except json.JSONDecodeError:
                continue
        
        # Sort by timestamp ascending
        reflections.sort(key=lambda r: r['timestamp'])
        
        return reflections
    
    def select_moments(self, reflections: List[Dict]) -> Tuple[List[Dict], str]:
        """
        Select 3-5 moments for fade sequence.
        
        Returns: (selected_moments, policy_used)
        
        Policy:
          3-4 total: 2 recent + 1 old
          5+ total: 3 recent + 1 mid + 1 old
        """
        n = len(reflections)
        
        if n < 3:
            return [], "insufficient"
        
        # Compute valence mean for old selection
        valence_mean = sum(r['valence'] for r in reflections) / n
        
        if n <= 4:
            # Policy: 2R + 1O
            recent = reflections[-2:]
            
            # Old = bottom 25%, highest |valence - mean|
            old_pool = reflections[:max(1, n // 4)]
            old = max(old_pool, key=lambda r: abs(r['valence'] - valence_mean))
            
            # Fade order: old → recent[-2] → recent[-1]
            selected = [old] + recent
            policy = "3=2R+1O"
        
        else:
            # Policy: 3R + 1M + 1O
            recent = reflections[-3:]
            
            # Dominant primary from recent
            recent_primaries = [r['primary'] for r in recent]
            dominant_primary = Counter(recent_primaries).most_common(1)[0][0]
            
            # Mid = 50-65% percentile, prefer same primary
            mid_start = int(n * 0.50)
            mid_end = int(n * 0.65)
            mid_pool = reflections[mid_start:mid_end] if mid_end > mid_start else [reflections[n // 2]]
            
            # Prefer matching dominant primary
            mid_candidates = [r for r in mid_pool if r['primary'] == dominant_primary]
            if not mid_candidates:
                mid_candidates = mid_pool
            mid = mid_candidates[len(mid_candidates) // 2]  # Middle of mid pool
            
            # Old = bottom 25%, most extreme valence
            old_pool = reflections[:max(1, n // 4)]
            old = max(old_pool, key=lambda r: abs(r['valence'] - valence_mean))
            
            # Fade order: old → mid → recent[-3] → recent[-2] → recent[-1]
            # But we only use 5 max, so: old → mid → recent (3 most recent)
            selected = [old, mid] + recent
            policy = "5+=3R+1M+1O"
        
        return selected, policy
    
    def aggregate_metrics(self, moments: List[Dict]) -> Dict:
        """Compute aggregated emotional metrics."""
        n = len(moments)
        
        valence_mean = sum(m['valence'] for m in moments) / n
        arousal_mean = sum(m['arousal'] for m in moments) / n
        
        primaries = [m['primary'] for m in moments]
        dominant_primary = Counter(primaries).most_common(1)[0][0]
        
        latest = moments[-1]
        delta_valence = latest['valence'] - valence_mean
        
        return {
            'valence_mean': round(valence_mean, 2),
            'arousal_mean': round(arousal_mean, 2),
            'dominant_primary': dominant_primary,
            'delta_valence': round(delta_valence, 2),
            'latest_primary': latest['primary'],
            'latest_closing_line': latest['closing_line']
        }
    
    def generate_line1_tone(self, metrics: Dict) -> str:
        """
        Generate Line 1 — Tone of Now.
        Based on valence_mean, arousal_mean, dominant_primary.
        """
        valence = metrics['valence_mean']
        arousal = metrics['arousal_mean']
        primary = metrics['dominant_primary']
        
        # Direct emotional statements per primary
        if primary == 'peaceful':
            if valence > 0.3:
                line = "You found some calm this week."
            elif arousal < 0.4:
                line = "Things slowed down, quieter now."
            else:
                line = "A steady peace, holding ground."
        
        elif primary == 'joyful':
            if valence > 0.4:
                line = "Light moments lifted you up."
            else:
                line = "Small joys breaking through."
        
        elif primary == 'mad':
            if arousal > 0.6:
                line = "Anger flared up, still burning."
            else:
                line = "Frustration simmered underneath."
        
        elif primary == 'scared':
            if arousal > 0.6:
                line = "Fear shook you, racing fast."
            elif valence < -0.2:
                line = "Worry pressed in heavy."
            else:
                line = "Unease lingered, holding tight."
        
        elif primary == 'sad':
            if valence < -0.3:
                line = "Sadness weighed you down hard."
            else:
                line = "A quiet ache, settling in."
        
        elif primary == 'powerful':
            if valence > 0.3:
                line = "Strength rose, clear and steady."
            else:
                line = "You stood your ground firmly."
        
        else:
            # Fallback to valence/arousal mapping
            if valence > 0.2 and arousal < 0.5:
                line = "A steady peace, holding ground."
            elif valence < -0.2 and arousal > 0.5:
                line = "Tension ran high, restless."
            else:
                line = "Things shifted, holding steady."
        
        return line
    
    def generate_line2_direction(self, metrics: Dict) -> str:
        """
        Generate Line 2 — Direction / Next.
        Based on delta_valence and closing_line.
        """
        delta = metrics['delta_valence']
        closing_line = metrics['latest_closing_line']
        primary = metrics['latest_primary']
        
        # Prefer closing_line if available
        if closing_line and len(closing_line) > 5:
            return closing_line
        
        # Delta-based direction
        if delta >= 0.1:
            line = "You're moving toward lighter ground."
        elif delta <= -0.1:
            line = "It got harder. Be gentle."
        else:
            line = "Holding steady; keep the small light."
        
        # Fallback to primary-based closing
        if not closing_line:
            primary_closings = {
                'joyful': 'Carry this light forward.',
                'peaceful': 'Let the calm keep watch.',
                'powerful': 'Stand in your strength.',
                'mad': 'Name it, reshape it.',
                'sad': 'Be gentle with what aches.',
                'scared': "Breathe; you're not alone."
            }
            
            if primary in primary_closings and abs(delta) < 0.05:
                line = primary_closings[primary]
        
        return line
    
    def refine_with_ollama(self, line1: str, line2: str, metrics: Dict) -> Tuple[str, str]:
        """Refine both lines with Ollama phi3."""
        primary = metrics['dominant_primary']
        valence = metrics['valence_mean']
        
        context1 = f"Make this emotion-focused statement more direct and specific (no metaphors). Primary emotion: {primary}."
        context2 = f"Make this guidance actionable and clear. Current emotional trajectory: {'improving' if metrics['delta_valence'] > 0 else 'declining' if metrics['delta_valence'] < 0 else 'stable'}."
        
        refined1 = self.ollama.refine_line(line1, context1, temperature=0.2)
        refined2 = self.ollama.refine_line(line2, context2, temperature=0.25)
        
        return refined1, refined2
    
    def compute_next_signin_display(self, signin_count: int, gap_cursor: int) -> int:
        """
        Compute next eligible sign-in for display.
        Pattern: skip 1, skip 2, repeat → play on #3, 5, 8, 10, 13, 15...
        """
        gaps = [1, 2]
        current_gap = gaps[gap_cursor % 2]
        
        # Next display = current + gap + 1
        return signin_count + current_gap + 1
    
    def check_should_display(self, sid: str, force: bool = False) -> Tuple[bool, int, int]:
        """
        Check if micro-dream should display on this sign-in.
        Returns: (should_display, signin_count, next_eligible)
        
        Pattern: First at #4 (after 3 moments), then #5, 7, 10, 12, 15, 17, 20, 22, 25...
        Gaps: +1, +2, +3, +2, +3, +2, +3, +2, +3...
        """
        if force:
            return True, 0, 0
        
        # Increment signin counter
        signin_count = self.upstash.incr(f'signin_count:{sid}')
        
        # Get gap cursor (defaults to 0)
        gap_cursor_str = self.upstash.get(f'dream_gap_cursor:{sid}')
        gap_cursor = int(gap_cursor_str) if gap_cursor_str else 0
        
        # Build play sequence: start at 4, then pattern of +1, +2, +3, +2, +3, +2, +3...
        # #4 (first after 3 moments), #5 (+1), #7 (+2), #10 (+3), #12 (+2), #15 (+3), #17 (+2), #20 (+3)...
        plays = []
        pos = 4  # First play at signin #4 (after user has 3 moments)
        gap_pattern = [1, 2, 3]  # After #4: +1 → #5, +2 → #7, +3 → #10, +2 → #12, +3 → #15...
        gap_idx = 0
        
        plays.append(pos)
        while pos < signin_count + 20:
            # Cycle through [1, 2, 3, 2, 3, 2, 3...]
            if gap_idx == 0:
                gap = 1  # First gap after #4
            else:
                # Alternate between 2 and 3 after first +1
                gap = 2 if (gap_idx % 2 == 1) else 3
            
            pos += gap
            plays.append(pos)
            gap_idx += 1
            
            if len(plays) > 50:  # Safety limit
                break
        
        should_display = signin_count in plays
        
        if should_display:
            # Update gap cursor for next cycle
            new_cursor = gap_cursor + 1
            self.upstash.set(f'dream_gap_cursor:{sid}', str(new_cursor))
        
        # Find next eligible
        next_eligible = min([p for p in plays if p > signin_count], default=signin_count + 2)
        
        return should_display, signin_count, next_eligible
    
    def write_micro_dream(self, sid: str, lines: List[str], fades: List[str], 
                          metrics: Dict, policy: str) -> bool:
        """Write micro_dream:{sid} to Upstash with 7-day TTL."""
        payload = {
            'sid': sid,
            'algo': 'micro-v1',
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            'lines': lines,
            'fades': fades,
            'dominant_primary': metrics['dominant_primary'],
            'valence_mean': metrics['valence_mean'],
            'arousal_mean': metrics['arousal_mean'],
            'source_policy': policy
        }
        
        # 7 days = 604800 seconds
        ttl = 7 * 24 * 60 * 60
        
        return self.upstash.set(
            f'micro_dream:{sid}',
            json.dumps(payload),
            ex=ttl
        )
    
    def run(self, sid: str, force_dream: bool = False, skip_ollama: bool = False) -> Optional[Dict]:
        """
        Main execution flow.
        
        Returns dict with terminal output data, or None if insufficient reflections.
        """
        print(f"[•] Fetching reflections for sid={sid}...")
        reflections = self.fetch_reflections(sid)
        
        if len(reflections) < 3:
            print(f"[✗] Not enough moments for micro-dream. Found {len(reflections)}, need ≥3.")
            return None
        
        print(f"[✓] Loaded {len(reflections)} reflections")
        
        # Select moments
        print(f"[•] Selecting fade moments...")
        moments, policy = self.select_moments(reflections)
        
        if not moments:
            print("[✗] Moment selection failed")
            return None
        
        print(f"[✓] Selected {len(moments)} moments using policy: {policy}")
        
        # Aggregate metrics
        metrics = self.aggregate_metrics(moments)
        print(f"[✓] Aggregated: {metrics['dominant_primary']} | valence={metrics['valence_mean']:+.2f} | Δ={metrics['delta_valence']:+.2f}")
        
        # Generate raw lines
        print(f"[•] Generating lines...")
        line1_raw = self.generate_line1_tone(metrics)
        line2_raw = self.generate_line2_direction(metrics)
        
        # Refine with Ollama (unless skipped)
        if not skip_ollama:
            print(f"[•] Refining with Ollama (phi3)...")
            line1, line2 = self.refine_with_ollama(line1_raw, line2_raw, metrics)
        else:
            line1, line2 = line1_raw, line2_raw
        
        lines = [line1, line2]
        fades = [m['rid'] for m in moments]
        
        # Write to Upstash
        print(f"[•] Writing micro_dream:{sid} to Upstash...")
        success = self.write_micro_dream(sid, lines, fades, metrics, policy)
        
        if success:
            print(f"[✓] Micro-dream saved (7-day TTL)")
        else:
            print(f"[⚠] Failed to write to Upstash")
        
        # Check sign-in gating
        should_display, signin_count, next_eligible = self.check_should_display(sid, force_dream)
        
        return {
            'lines': lines,
            'fades': fades,
            'metrics': metrics,
            'policy': policy,
            'should_display': should_display,
            'signin_count': signin_count,
            'next_eligible': next_eligible
        }


def main():
    """Main entry point."""
    # Load environment
    upstash_url = os.getenv('UPSTASH_REDIS_REST_URL')
    upstash_token = os.getenv('UPSTASH_REDIS_REST_TOKEN')
    sid = os.getenv('SID', 'sess_default')
    force_dream = os.getenv('FORCE_DREAM', '0') == '1'
    skip_ollama = os.getenv('SKIP_OLLAMA', '0') == '1'
    
    if not upstash_url or not upstash_token:
        print("[✗] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN")
        sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"MICRO-DREAM AGENT — Production Mode")
    print(f"{'='*60}")
    print(f"Session: {sid}")
    print(f"Upstash: {upstash_url[:40]}...")
    print(f"Force display: {force_dream}")
    print(f"Skip Ollama: {skip_ollama}")
    print(f"{'='*60}\n")
    
    # Initialize clients
    upstash = UpstashClient(upstash_url, upstash_token)
    ollama = OllamaClient()
    
    # Run agent
    agent = MicroDreamAgent(upstash, ollama)
    result = agent.run(sid, force_dream=force_dream, skip_ollama=skip_ollama)
    
    if not result:
        sys.exit(1)
    
    # Terminal output
    print(f"\n{'='*60}")
    print(f"MICRO-DREAM PREVIEW (terminal)")
    print(f"{'='*60}")
    print(f"1) {result['lines'][0]}")
    print(f"2) {result['lines'][1]}")
    print(f"\nFADES: {' → '.join(result['fades'])}")
    print(f"dominant: {result['metrics']['dominant_primary']} | " 
          f"valence: {result['metrics']['valence_mean']:+.2f} | "
          f"arousal: {result['metrics']['arousal_mean']:.2f} | "
          f"Δvalence: {result['metrics']['delta_valence']:+.2f}")
    
    if result['should_display']:
        print(f"\n[✓] DISPLAY ON THIS SIGN-IN (#{result['signin_count']})")
    else:
        print(f"\nNext display eligible sign-in: #{result['next_eligible']} (current: #{result['signin_count']})")
    
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
