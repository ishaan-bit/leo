#!/usr/bin/env python3
"""
Micro-Dream Agent — Mock Mode
Demonstrates all logic with 6 sample reflections (no Upstash required).

Features:
  - 6 reflections spanning Oct 20-24 (Peaceful → Scared → Mad → Peaceful)
  - Tests 3-5 moment selection algorithm
  - Ollama refinement (can be skipped with SKIP_OLLAMA=1)
  - Sign-in display gating simulation
  - Terminal preview output
"""

import json
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import Counter


# SAMPLE REFLECTIONS (6 total, sorted by timestamp)
SAMPLE_REFLECTIONS = [
    {
        'rid': 'refl_001_peaceful',
        'sid': 'sess_mock',
        'timestamp': '2025-10-20T08:30:00Z',
        'valence': 0.6,
        'arousal': 0.3,
        'primary': 'peaceful',
        'closing_line': 'Let the calm keep watch.',
        'text': 'Woke up feeling rested and calm. Morning coffee tasted good.'
    },
    {
        'rid': 'refl_002_scared',
        'sid': 'sess_mock',
        'timestamp': '2025-10-21T14:45:00Z',
        'valence': -0.2,
        'arousal': 0.7,
        'primary': 'scared',
        'closing_line': "Breathe; you're not alone.",
        'text': 'Big presentation today. Hands shaking beforehand, worried about messing up.'
    },
    {
        'rid': 'refl_003_scared',
        'sid': 'sess_mock',
        'timestamp': '2025-10-22T09:15:00Z',
        'valence': 0.1,
        'arousal': 0.5,
        'primary': 'scared',
        'closing_line': 'The fear passed; you held steady.',
        'text': "Presentation went okay. Still anxious but relieved it's over."
    },
    {
        'rid': 'refl_004_mad',
        'sid': 'sess_mock',
        'timestamp': '2025-10-24T11:00:00Z',
        'valence': -0.3,
        'arousal': 0.8,
        'primary': 'mad',
        'closing_line': 'Name it, reshape it.',
        'text': 'Teammate took credit for my work. So frustrated and angry.'
    },
    {
        'rid': 'refl_005_peaceful',
        'sid': 'sess_mock',
        'timestamp': '2025-10-24T18:30:00Z',
        'valence': 0.4,
        'arousal': 0.4,
        'primary': 'peaceful',
        'closing_line': 'This calm is yours. Keep it close.',
        'text': 'Talked to manager about it. Feeling heard and calmer now.'
    },
    {
        'rid': 'refl_006_peaceful',
        'sid': 'sess_mock',
        'timestamp': '2025-10-24T21:00:00Z',
        'valence': 0.5,
        'arousal': 0.3,
        'primary': 'peaceful',
        'closing_line': 'Let the calm keep watch.',
        'text': 'Evening walk by the park. Sky was pretty. Feeling settled.'
    }
]


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


class MicroDreamAgentMock:
    """Mock agent for micro-dream generation (no Upstash)."""
    
    def __init__(self, ollama: OllamaClient, reflections: List[Dict]):
        self.ollama = ollama
        self.reflections = reflections
        # Simulate sign-in state
        self.signin_count = 0
        self.gap_cursor = 0
    
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
            
            # Fade order: old → mid → recent (3 most recent)
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
    
    def simulate_signin_gating(self, current_count: int = 0) -> Tuple[bool, int, int]:
        """
        Simulate sign-in display gating.
        Returns: (should_display, signin_count, next_eligible)
        
        Pattern: First at #4 (after 3 moments), then #5, 7, 10, 12, 15, 17, 20, 22, 25...
        Timeline: 
          #1-3 (skip, building moments) → 
          #4 (PLAY - first micro-dream after 3 moments) → 
          #5 (PLAY, +1) → #6 (skip) → 
          #7 (PLAY, +2) → #8,9 (skip) → 
          #10 (PLAY, +3) → #11 (skip) → 
          #12 (PLAY, +2) → #13,14 (skip) → 
          #15 (PLAY, +3) → #16 (skip) → 
          #17 (PLAY, +2) → etc.
        """
        # Use provided count or increment internal
        signin_count = current_count if current_count > 0 else (self.signin_count + 1)
        self.signin_count = signin_count
        
        # Build play sequence: start at 4, then pattern of +1, +2, +3, +2, +3, +2, +3...
        # #4 (first after 3 moments), #5 (+1), #7 (+2), #10 (+3), #12 (+2), #15 (+3), #17 (+2), #20 (+3)...
        plays = []
        pos = 4  # First play at signin #4 (after user has 3 moments)
        gap_idx = 0
        
        plays.append(pos)
        while pos < signin_count + 20:
            # Cycle through [1, 2, 3, 2, 3, 2, 3...]
            if gap_idx == 0:
                gap = 1  # First gap after #4: #4 → #5
            else:
                # Alternate between 2 and 3 after first +1
                gap = 2 if (gap_idx % 2 == 1) else 3
            
            pos += gap
            plays.append(pos)
            gap_idx += 1
            
            if len(plays) > 50:
                break
        
        should_display = signin_count in plays
        next_eligible = min([p for p in plays if p > signin_count], default=signin_count + 2)
        
        return should_display, signin_count, next_eligible
    
    def run(self, skip_ollama: bool = False, signin_count: int = 0) -> Optional[Dict]:
        """
        Main execution flow.
        
        Returns dict with terminal output data, or None if insufficient reflections.
        """
        reflections = self.reflections
        
        print(f"[✓] Loaded {len(reflections)} sample reflections")
        
        if len(reflections) < 3:
            print(f"[✗] Not enough moments for micro-dream. Found {len(reflections)}, need ≥3.")
            return None
        
        # Select moments
        moments, policy = self.select_moments(reflections)
        
        if not moments:
            print("[✗] Moment selection failed")
            return None
        
        print(f"[✓] Selected {len(moments)} moments using policy: {policy}")
        
        # Aggregate metrics
        metrics = self.aggregate_metrics(moments)
        print(f"[✓] Aggregated: {metrics['dominant_primary']} | valence={metrics['valence_mean']:+.2f} | Δ={metrics['delta_valence']:+.2f}")
        
        # Generate raw lines
        line1_raw = self.generate_line1_tone(metrics)
        line2_raw = self.generate_line2_direction(metrics)
        
        print(f"\n[RAW] Line 1: {line1_raw}")
        print(f"[RAW] Line 2: {line2_raw}")
        
        # Refine with Ollama (unless skipped)
        if not skip_ollama:
            print(f"\n[•] Refining with Ollama (phi3)...")
            line1, line2 = self.refine_with_ollama(line1_raw, line2_raw, metrics)
        else:
            line1, line2 = line1_raw, line2_raw
        
        lines = [line1, line2]
        fades = [m['rid'] for m in moments]
        
        # Simulate sign-in gating
        should_display, signin_count_new, next_eligible = self.simulate_signin_gating(signin_count)
        
        return {
            'lines': lines,
            'lines_raw': [line1_raw, line2_raw],
            'fades': fades,
            'metrics': metrics,
            'policy': policy,
            'should_display': should_display,
            'signin_count': signin_count_new,
            'next_eligible': next_eligible
        }


def main():
    """Main entry point for mock mode."""
    import os
    
    skip_ollama = os.getenv('SKIP_OLLAMA', '0') == '1'
    signin_count = int(os.getenv('SIGNIN_COUNT', '0'))
    
    print(f"\n{'='*60}")
    print(f"MICRO-DREAM AGENT — Mock Mode")
    print(f"{'='*60}")
    print(f"Sample reflections: {len(SAMPLE_REFLECTIONS)}")
    print(f"Skip Ollama: {skip_ollama}")
    print(f"Simulated sign-in count: {signin_count}")
    print(f"{'='*60}\n")
    
    # Initialize
    ollama = OllamaClient()
    agent = MicroDreamAgentMock(ollama, SAMPLE_REFLECTIONS)
    
    # Run
    result = agent.run(skip_ollama=skip_ollama, signin_count=signin_count)
    
    if not result:
        return
    
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
