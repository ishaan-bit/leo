#!/usr/bin/env python3
"""
Micro-Dream Agent v1.2 — Arc-aware 3/5 reflection generator

Generates 3-5 line arc-aware micro-dreams from Upstash reflections with sign-in display gating.

Environment:
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  OWNER_ID (user identity: 'user:{userId}' or 'guest:{sid}')
  FORCE_DREAM=1 (optional, bypass gating)

Output:
  - Writes micro_dream:{owner_id} to Upstash (7-day TTL)
  - Prints terminal preview with fade sequence + metrics
  - Updates signin_count:{owner_id} and dream_gap_cursor:{owner_id}

v1.2 Features:
  - Arc-aware selection: 2R+1O (N=3) or 3R+1M+1O (N≥5)
  - Recency-weighted metrics (0.5 latest, 0.3 second latest, 0.2 others)
  - Arc direction detection (upturn, downturn, steady)
  - Language detection from last 2 moments (en vs Hinglish)
  - Template-based generation (3-5 lines, ≤10 words/line)
  - Pivot sentence for significant upturns (|Δvalence| ≥ 0.15)
"""

import os
import sys
import json
import re
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
    
    def fetch_reflections(self, owner_id: str) -> List[Dict]:
        """
        Fetch all reflections for owner (user only, not guest), sorted by timestamp.
        
        Note: Guest sessions (owner_id starting with 'guest:') are excluded from
        micro-dream generation to prevent dreamscape triggers in guest mode.
        """
        # Skip guest users - they should not contribute to or trigger dreamscapes
        if owner_id.startswith('guest:'):
            print(f"[!] Guest session detected - skipping dreamscape (guests ineligible)")
            return []
        
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
                
                # Filter by owner_id (user:xxx or guest:sess_xxx)
                if data.get('owner_id') != owner_id:
                    continue
                
                # Validate structure
                if 'timestamp' not in data or 'final' not in data:
                    continue
                
                final = data.get('final', {})
                valence = final.get('valence', 0.0)
                arousal = final.get('arousal', 0.0)
                primary = final.get('wheel', {}).get('primary', 'peaceful').lower()
                
                # Extract closing line and metadata
                closing_line = ''
                post = data.get('post_enrichment', {})
                if post.get('closing_line'):
                    closing_line = post['closing_line'].replace('See you tomorrow.', '').strip()
                
                # Extract city and circadian
                city = data.get('city', '')
                circadian = data.get('circadian', '')
                
                # Extract language (if available)
                language = data.get('language', 'en')
                
                reflections.append({
                    'rid': data.get('rid', key.split(':')[-1]),
                    'owner_id': data.get('owner_id', owner_id),
                    'timestamp': data['timestamp'],
                    'valence': valence,
                    'arousal': arousal,
                    'primary': primary,
                    'secondary': final.get('wheel', {}).get('secondary', ''),
                    'tertiary': final.get('wheel', {}).get('tertiary', ''),
                    'closing_line': closing_line,
                    'text': data.get('normalized_text', ''),
                    'city': city,
                    'circadian': circadian,
                    'language': language
                })
                
            except (json.JSONDecodeError, KeyError) as e:
                continue
        
        # Sort by timestamp ascending
        reflections.sort(key=lambda r: r['timestamp'])
        
        return reflections
    
    def select_moments(self, reflections: List[Dict]) -> Tuple[List[Dict], str]:
        """
        Select 3-5 moments for fade sequence with arc-aware policy.
        
        Returns: (selected_moments, policy_used)
        
        Policy v1.2:
          N=3: 2 recent + 1 oldest (2R+1O)
          N≥5: 3 recent + 1 mid (40-60th percentile) + 1 oldest (3R+1M+1O)
          Always include latest moment
        """
        n = len(reflections)
        
        if n < 3:
            return [], "insufficient"
        
        # Compute valence mean for old selection
        valence_mean = sum(r['valence'] for r in reflections) / n
        
        if n == 3:
            # Policy: 2R+1O — Use all 3 (oldest + 2 recent)
            selected = reflections  # Already sorted, so [oldest, middle, latest]
            policy = "3=2R+1O"
        
        elif n == 4:
            # Policy: 2R+1O — oldest + 2 most recent
            recent = reflections[-2:]
            old = reflections[0]
            
            selected = [old] + recent
            policy = "3=2R+1O"
        
        else:
            # Policy: 3R + 1M + 1O (N≥5)
            recent = reflections[-3:]
            
            # Dominant primary from recent (recency-weighted mode)
            recent_primaries = [r['primary'] for r in recent]
            dominant_primary = Counter(recent_primaries).most_common(1)[0][0]
            
            # Mid = 40-60% percentile by time, prefer same primary as dominant
            mid_start = int(n * 0.40)
            mid_end = int(n * 0.60)
            mid_pool = reflections[mid_start:mid_end] if mid_end > mid_start else [reflections[n // 2]]
            
            # Prefer matching dominant primary
            mid_candidates = [r for r in mid_pool if r['primary'] == dominant_primary]
            if not mid_candidates:
                mid_candidates = mid_pool
            mid = mid_candidates[len(mid_candidates) // 2]  # Middle of mid pool
            
            # Old = oldest (first in sorted list)
            old = reflections[0]
            
            # Fade order: old → mid → recent[-3] → recent[-2] → recent[-1]
            selected = [old, mid] + recent
            policy = "5+=3R+1M+1O"
        
        # Deduplicate by rid while maintaining order
        seen_rids = set()
        fade_sequence = []
        for r in selected:
            if r['rid'] not in seen_rids:
                fade_sequence.append(r)
                seen_rids.add(r['rid'])
        
        return fade_sequence, policy
    
    def aggregate_metrics(self, moments: List[Dict]) -> Dict:
        """
        Compute aggregated emotional metrics with recency weighting.
        
        Recency weights (v1.2):
          Latest: 0.5
          Second latest: 0.3
          Others: 0.2 / (n-2) each
        """
        n = len(moments)
        
        # Recency weights
        if n == 1:
            weights = [1.0]
        elif n == 2:
            weights = [0.3, 0.5]  # [older, latest]
        else:
            # Latest=0.5, second=0.3, others split 0.2
            other_weight = 0.2 / (n - 2) if n > 2 else 0.0
            weights = [other_weight] * (n - 2) + [0.3, 0.5]
        
        # Weighted means
        valence_mean = sum(m['valence'] * w for m, w in zip(moments, weights))
        arousal_mean = sum(m['arousal'] * w for m, w in zip(moments, weights))
        
        # Dominant primary (recency-weighted mode)
        # Simple approach: count with weights as multipliers
        primary_counts = Counter()
        for m, w in zip(moments, weights):
            primary_counts[m['primary']] += w
        dominant_primary = primary_counts.most_common(1)[0][0]
        
        # Arc direction: Δvalence between earliest and latest
        earliest = moments[0]
        latest = moments[-1]
        delta_valence = latest['valence'] - earliest['valence']
        
        # Classify arc
        if delta_valence >= 0.15:
            arc_direction = "upturn"
        elif delta_valence <= -0.15:
            arc_direction = "downturn"
        else:
            arc_direction = "steady"
        
        return {
            'valence_mean': round(valence_mean, 2),
            'arousal_mean': round(arousal_mean, 2),
            'dominant_primary': dominant_primary,
            'delta_valence': round(delta_valence, 2),
            'arc_direction': arc_direction,
            'latest_primary': latest['primary'],
            'latest_closing_line': latest['closing_line'],
            'earliest_valence': round(earliest['valence'], 2),
            'latest_valence': round(latest['valence'], 2)
        }
    
    def detect_language(self, moments: List[Dict]) -> str:
        """
        Detect language from last 2 moments.
        
        Returns:
          'en' - English only
          'hi' - Hinglish (mixed detected in both last moments)
          
        Detection heuristic: Check for Hindi/mixed markers in language field
        or presence of common Hinglish words in text.
        """
        # Use last 2 moments
        recent = moments[-2:] if len(moments) >= 2 else moments
        
        languages = [m.get('language', 'en') for m in recent]
        
        # If both are mixed/hindi/hinglish, use Hinglish
        mixed_markers = ['mixed', 'hi', 'hinglish', 'hindi']
        
        is_mixed = [any(marker in lang.lower() for marker in mixed_markers) for lang in languages]
        
        if all(is_mixed) and len(is_mixed) >= 2:
            return 'hi'
        
        # Fallback: check text for Hinglish keywords
        hinglish_keywords = [
            'chai', 'tapri', 'auto', 'yaar', 'kya', 'hai', 'nahi', 'thoda',
            'kuch', 'bahut', 'zyada', 'accha', 'theek', 'matlab'
        ]
        
        texts = [m.get('text', '').lower() for m in recent]
        combined_text = ' '.join(texts)
        
        hinglish_count = sum(1 for kw in hinglish_keywords if kw in combined_text)
        
        if hinglish_count >= 2:
            return 'hi'
        
        return 'en'
    
    def generate_upturn_template(self, metrics: Dict, moments: List[Dict], language: str) -> List[str]:
        """
        Generate upturn template (3-5 lines).
        
        L1: Past heaviness, city detail
        L2: Morning attempt to rise
        L3: Social/shared moment easing
        L4: Directional promise ("turning toward calm")
        """
        primary = metrics['dominant_primary']
        latest = moments[-1]
        earliest = moments[0]
        
        # Extract locale details
        city = latest.get('city', 'the city')
        circadian = latest.get('circadian', 'evening')
        
        # City details for sensory grounding
        city_details = {
            'Mumbai': 'local train' if language == 'en' else 'local',
            'Delhi': 'metro' if language == 'en' else 'metro',
            'Bangalore': 'traffic' if language == 'en' else 'signal',
            'Kolkata': 'tram' if language == 'en' else 'tram'
        }
        city_detail = city_details.get(city, 'traffic')
        
        lines = []
        
        # L1: Past heaviness
        if language == 'hi':
            if primary in ['sad', 'scared']:
                lines.append(f"Pehle bahut heavy tha, {city_detail} bhi slow.")
            else:
                lines.append(f"Woh din tough the, bas holding on.")
        else:
            if primary in ['sad', 'scared']:
                lines.append(f"It weighed heavy then, {city_detail} crawling.")
            else:
                lines.append(f"Those days pressed hard, barely breathing.")
        
        # L2: Morning attempt
        if language == 'hi':
            lines.append("Subah uthi, thoda try kiya rise.")
        else:
            if circadian in ['morning', 'dawn']:
                lines.append("Morning came. You tried to rise.")
            else:
                lines.append("You woke up, tried something new.")
        
        # L3: Social/shared moment
        if language == 'hi':
            lines.append("Kisi se baat ki, halka laga.")
        else:
            lines.append("Someone listened. It felt lighter.")
        
        # L4: Directional promise (pivot sentence)
        pivot_emotion = 'calm' if primary in ['peaceful', 'joyful'] else 'steady'
        
        if language == 'hi':
            lines.append(f"Ab turn ho raha {pivot_emotion} ki taraf.")
        else:
            lines.append(f"You're turning toward {pivot_emotion}.")
        
        # Trim to ≤10 words per line
        lines = [self._trim_line(line, max_words=10) for line in lines]
        
        return lines[:5]  # Max 5 lines
    
    def generate_downturn_template(self, metrics: Dict, moments: List[Dict], language: str) -> List[str]:
        """
        Generate downturn template (3-5 lines).
        
        L1: Recent struggle (swap polarity from upturn)
        L2: City/sensory detail of decline
        L3: Acknowledge heaviness
        L4: Care cue ("breathe; go gently")
        """
        primary = metrics['dominant_primary']
        latest = moments[-1]
        
        city = latest.get('city', 'the city')
        
        lines = []
        
        # L1: Recent struggle
        if language == 'hi':
            if primary in ['sad', 'scared']:
                lines.append("Ab zyada heavy ho gaya hai.")
            else:
                lines.append("Kuch din se harder lag raha.")
        else:
            if primary in ['sad', 'scared']:
                lines.append("It got heavier this week.")
            else:
                lines.append("Things grew harder lately.")
        
        # L2: City/sensory decline
        if language == 'hi':
            lines.append("Raat lambi, subah door.")
        else:
            lines.append("Nights stretched long, mornings far.")
        
        # L3: Acknowledge heaviness
        if language == 'hi':
            lines.append("Mehsoos ho raha, it's okay.")
        else:
            lines.append("You're feeling it. That's real.")
        
        # L4: Care cue
        if language == 'hi':
            lines.append("Breathe le; thoda gentle jao.")
        else:
            lines.append("Breathe. Go gently with yourself.")
        
        lines = [self._trim_line(line, max_words=10) for line in lines]
        
        return lines[:5]
    
    def generate_steady_template(self, metrics: Dict, moments: List[Dict], language: str) -> List[str]:
        """
        Generate steady template (3-5 lines).
        
        L1: Anchor routine
        L2: Small constancy
        L3: Invite curiosity
        """
        primary = metrics['dominant_primary']
        latest = moments[-1]
        
        lines = []
        
        # L1: Anchor routine
        if language == 'hi':
            lines.append("Routine steady chal raha, holding ground.")
        else:
            lines.append("Things held steady this week.")
        
        # L2: Small constancy
        if language == 'hi':
            lines.append("Chai, traffic, same pattern.")
        else:
            lines.append("Same rhythm. Small constancies.")
        
        # L3: Invite curiosity
        if language == 'hi':
            lines.append("Kuch naya try kar sakte ho?")
        else:
            lines.append("Maybe try one new thing?")
        
        lines = [self._trim_line(line, max_words=10) for line in lines]
        
        return lines[:5]
    
    def _trim_line(self, line: str, max_words: int = 10) -> str:
        """Trim line to max_words, preserving meaning."""
        words = line.split()
        if len(words) <= max_words:
            return line
        
        # Trim from end, keep essential words
        return ' '.join(words[:max_words]) + '.'
    
    def validate_and_bridge(self, lines: List[str], metrics: Dict) -> List[str]:
        """
        Validate output contract and add bridge clause if needed.
        
        If arc_direction=upturn but dominant_primary not in {happy, peaceful},
        append bridge: "— and that's new."
        """
        arc = metrics['arc_direction']
        primary = metrics['dominant_primary']
        
        # Enforce 3-5 lines
        if len(lines) < 3:
            lines = lines + ["Hold steady."] * (3 - len(lines))
        elif len(lines) > 5:
            lines = lines[:5]
        
        # Enforce ≤10 words per line
        lines = [self._trim_line(line, max_words=10) for line in lines]
        
        # Bridge clause for unexpected upturns
        if arc == 'upturn' and primary not in ['happy', 'joyful', 'peaceful']:
            # Append to last line
            if not lines[-1].endswith("— and that's new."):
                lines[-1] = lines[-1].rstrip('.') + " — and that's new."
        
        return lines
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
    
    def refine_with_ollama(self, lines: List[str], metrics: Dict) -> List[str]:
        """
        Refine all lines with Ollama phi3 (optional).
        
        For v1.2, refinement is optional since templates are already
        concrete and sensory. Use sparingly to preserve template structure.
        """
        primary = metrics['dominant_primary']
        arc = metrics['arc_direction']
        
        context = f"Refine for concreteness. Emotion: {primary}, arc: {arc}. Keep ≤10 words, sensory details."
        
        refined = []
        for line in lines:
            refined_line = self.ollama.refine_line(line, context, temperature=0.15)
            # Validate length
            if len(refined_line.split()) <= 10:
                refined.append(refined_line)
            else:
                refined.append(line)  # Fallback to original
        
        return refined
    
    def compute_next_signin_display(self, signin_count: int, gap_cursor: int) -> int:
        """
        Compute next eligible sign-in for display.
        Pattern: skip 1, skip 2, repeat → play on #3, 5, 8, 10, 13, 15...
        """
        gaps = [1, 2]
        current_gap = gaps[gap_cursor % 2]
        
        # Next display = current + gap + 1
        return signin_count + current_gap + 1
    
    def check_should_display(self, owner_id: str, force: bool = False) -> Tuple[bool, int, int]:
        """
        Check if micro-dream should display on this sign-in.
        Returns: (should_display, signin_count, next_eligible)
        
        Pattern: First at #4 (after 3 moments), then #6, 8, 11, 13, 16, 18, 21, 23, 26...
        Gaps: +2, +2, +3, +2, +3, +2, +3, +2, +3...
        
        Note: Micro-dream uses 5 moments (3 recent, 1 mid, 1 old) when available.
        With only 3 moments, falls back to 3=2R+1O policy.
        """
        if force:
            return True, 0, 0
        
        # Increment signin counter for this owner
        signin_count = self.upstash.incr(f'signin_count:{owner_id}')
        
        # Get gap cursor (defaults to 0)
        gap_cursor_str = self.upstash.get(f'dream_gap_cursor:{owner_id}')
        gap_cursor = int(gap_cursor_str) if gap_cursor_str else 0
        
        # Build play sequence: start at 4, then pattern of +2, +2, +3, +2, +3, +2, +3...
        # #4 (first after 3 moments), #6 (+2), #8 (+2), #11 (+3), #13 (+2), #16 (+3), #18 (+2), #21 (+3)...
        plays = []
        pos = 4  # First play at signin #4 (after user has 3 moments)
        gap_pattern = [2, 2, 3]  # Pattern: +2, +2, +3, then repeat [+2, +3, +2, +3...]
        gap_idx = 0
        
        plays.append(pos)
        while pos < signin_count + 20:
            if gap_idx < 2:
                # First two gaps are both +2
                gap = 2
            else:
                # After first two, alternate between 2 and 3
                gap = 3 if ((gap_idx - 2) % 2 == 0) else 2
            
            pos += gap
            plays.append(pos)
            gap_idx += 1
            
            if len(plays) > 50:  # Safety limit
                break
        
        should_display = signin_count in plays
        
        if should_display:
            # Update gap cursor for next cycle
            new_cursor = gap_cursor + 1
            self.upstash.set(f'dream_gap_cursor:{owner_id}', str(new_cursor))
        
        # Find next eligible
        next_eligible = min([p for p in plays if p > signin_count], default=signin_count + 2)
        
        return should_display, signin_count, next_eligible
    
    def write_micro_dream(self, owner_id: str, lines: List[str], fades: List[str], 
                          metrics: Dict, policy: str) -> bool:
        """Write micro_dream:{owner_id} to Upstash with 7-day TTL (v1.2 format)."""
        payload = {
            'owner_id': owner_id,
            'algo': 'micro-v1.2',
            'createdAt': datetime.utcnow().isoformat() + 'Z',
            'lines': lines,
            'fades': fades,
            'dominant_primary': metrics['dominant_primary'],
            'valence_mean': metrics['valence_mean'],
            'arousal_mean': metrics['arousal_mean'],
            'arc_direction': metrics['arc_direction'],
            'source_policy': policy
        }
        
        # 7 days = 604800 seconds
        ttl = 7 * 24 * 60 * 60
        
        return self.upstash.set(
            f'micro_dream:{owner_id}',
            json.dumps(payload),
            ex=ttl
        )
    
    def run(self, owner_id: str, force_dream: bool = False, skip_ollama: bool = False) -> Optional[Dict]:
        """
        Main execution flow (v1.2).
        
        Returns dict with terminal output data, or None if insufficient reflections.
        """
        print(f"[•] Fetching reflections for owner_id={owner_id}...")
        reflections = self.fetch_reflections(owner_id)
        
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
        
        # Aggregate metrics with recency weighting
        metrics = self.aggregate_metrics(moments)
        arc = metrics['arc_direction']
        print(f"[✓] Aggregated: {metrics['dominant_primary']} | arc={arc} | "
              f"valence={metrics['valence_mean']:+.2f} ({metrics['earliest_valence']:+.2f}→{metrics['latest_valence']:+.2f}) | "
              f"Δ={metrics['delta_valence']:+.2f}")
        
        # Detect language
        language = self.detect_language(moments)
        print(f"[✓] Language detected: {'Hinglish' if language == 'hi' else 'English'}")
        
        # Generate lines using template system
        print(f"[•] Generating {arc} template...")
        lines = self.generate_micro_dream_lines(metrics, moments)
        
        # Optional Ollama refinement (disabled by default for v1.2 templates)
        if not skip_ollama:
            print(f"[•] Refining with Ollama (phi3)...")
            lines = self.refine_with_ollama(lines, metrics)
        
        print(f"[✓] Generated {len(lines)} lines")
        
        fades = [m['rid'] for m in moments]
        
        # Write to Upstash
        print(f"[•] Writing micro_dream:{owner_id} to Upstash...")
        success = self.write_micro_dream(owner_id, lines, fades, metrics, policy)
        
        if success:
            print(f"[✓] Micro-dream saved (7-day TTL)")
        else:
            print(f"[⚠] Failed to write to Upstash")
        
        # Check sign-in gating
        should_display, signin_count, next_eligible = self.check_should_display(owner_id, force_dream)
        
        return {
            'lines': lines,
            'fades': fades,
            'metrics': metrics,
            'policy': policy,
            'language': language,
            'should_display': should_display,
            'signin_count': signin_count,
            'next_eligible': next_eligible
        }


def main():
    """Main entry point."""
    # Load environment
    upstash_url = os.getenv('UPSTASH_REDIS_REST_URL')
    upstash_token = os.getenv('UPSTASH_REDIS_REST_TOKEN')
    owner_id = os.getenv('OWNER_ID', 'guest:sess_default')
    force_dream = os.getenv('FORCE_DREAM', '0') == '1'
    skip_ollama = os.getenv('SKIP_OLLAMA', '0') == '1'
    
    if not upstash_url or not upstash_token:
        print("[✗] Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN")
        sys.exit(1)
    
    print(f"\n{'='*60}")
    print(f"MICRO-DREAM AGENT v1.2 — Arc-aware Generator")
    print(f"{'='*60}")
    print(f"Owner: {owner_id}")
    print(f"Upstash: {upstash_url[:40]}...")
    print(f"Force display: {force_dream}")
    print(f"Skip Ollama: {skip_ollama}")
    print(f"{'='*60}\n")
    
    # Initialize clients
    upstash = UpstashClient(upstash_url, upstash_token)
    ollama = OllamaClient()
    
    # Run agent
    agent = MicroDreamAgent(upstash, ollama)
    result = agent.run(owner_id, force_dream=force_dream, skip_ollama=skip_ollama)
    
    if not result:
        sys.exit(1)
    
    # Terminal output
    print(f"\n{'='*60}")
    print(f"MICRO-DREAM v1.2 PREVIEW")
    print(f"{'='*60}")
    
    # Print all lines (3-5 lines)
    for i, line in enumerate(result['lines'], 1):
        print(f"{i}) {line}")
    
    print(f"\nFADES: {' → '.join(result['fades'])}")
    print(f"\nMETRICS:")
    print(f"  Arc: {result['metrics']['arc_direction']} "
          f"({result['metrics']['earliest_valence']:+.2f} → {result['metrics']['latest_valence']:+.2f}, "
          f"Δ={result['metrics']['delta_valence']:+.2f})")
    print(f"  Dominant: {result['metrics']['dominant_primary']}")
    print(f"  Valence: {result['metrics']['valence_mean']:+.2f} (weighted)")
    print(f"  Arousal: {result['metrics']['arousal_mean']:.2f} (weighted)")
    print(f"  Language: {'Hinglish' if result['language'] == 'hi' else 'English'}")
    print(f"  Policy: {result['policy']}")
    
    if result['should_display']:
        print(f"\n[✓] DISPLAY ON THIS SIGN-IN (#{result['signin_count']})")
    else:
        print(f"\nNext display eligible sign-in: #{result['next_eligible']} (current: #{result['signin_count']})")
    
    print(f"{'='*60}\n")


if __name__ == '__main__':
    main()
