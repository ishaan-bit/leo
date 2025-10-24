#!/usr/bin/env python3
"""
Micro-Dream Generator - MOCK MODE
Uses sample data to demonstrate 2-line micro-dream generation
"""

import json
import statistics
from typing import List, Dict
from collections import Counter
import requests
import sys


# Sample reflections (expanded from previous data)
SAMPLE_REFLECTIONS = [
    {
        "rid": "refl_1761290000000_old1",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-20T07:00:00.000Z",
        "normalized_text": "Feeling peaceful this morning, just quiet time with tea",
        "final": {
            "invoked": "calm + gratitude + presence",
            "expressed": "content / peaceful / still",
            "wheel": {"primary": "Peaceful", "secondary": "content", "tertiary": "serene"},
            "valence": 0.6,
            "arousal": 0.3,
        },
        "post_enrichment": {
            "closing_line": "Peace lives in small rituals."
        }
    },
    {
        "rid": "refl_1761292000000_old2",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-21T10:15:00.000Z",
        "normalized_text": "Worried about the presentation tomorrow",
        "final": {
            "invoked": "fear + doubt + worry",
            "expressed": "anxious / worried / tense",
            "wheel": {"primary": "Scared", "secondary": "anxious", "tertiary": "worried"},
            "valence": -0.2,
            "arousal": 0.7,
        },
        "post_enrichment": {
            "closing_line": "Courage grows in small steps. See you tomorrow."
        }
    },
    {
        "rid": "refl_1761295000000_mid",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-22T14:30:00.000Z",
        "normalized_text": "Presentation went okay, still feeling a bit uncertain",
        "final": {
            "invoked": "relief + uncertainty + hope",
            "expressed": "uncertain / relieved / hopeful",
            "wheel": {"primary": "Scared", "secondary": "uncertain", "tertiary": "hopeful"},
            "valence": 0.1,
            "arousal": 0.5,
        },
        "post_enrichment": {
            "closing_line": "You did it. That's enough."
        }
    },
    {
        "rid": "refl_1761298103684_recent1",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-24T09:28:18.176Z",
        "normalized_text": "i dont know how im feeling about this",
        "final": {
            "invoked": "worry + hope + awe",
            "expressed": "hopeful / confused / worried",
            "wheel": {"primary": "Scared", "secondary": "confused", "tertiary": "perplexed"},
            "valence": 0.2,
            "arousal": 0.65,
        },
        "post_enrichment": {
            "closing_line": "awe can often lead to silent reflection. See you tomorrow."
        }
    },
    {
        "rid": "refl_1761306580657_recent2",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-24T11:43:00.657Z",
        "normalized_text": "Im frustrated I got distracted and messed up this new feature implementation",
        "final": {
            "invoked": "change + distraction + frustration",
            "expressed": "irritated / calm / angry",
            "wheel": {"primary": "Mad", "secondary": "angry", "tertiary": "mad"},
            "valence": -0.3,
            "arousal": 0.75,
        },
        "post_enrichment": {
            "closing_line": "Frustration clears when you give it space."
        }
    },
    {
        "rid": "refl_1761308000000_recent3",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-24T12:06:40.000Z",
        "normalized_text": "Taking a break, going for a walk to clear my head",
        "final": {
            "invoked": "calm + movement + reset",
            "expressed": "calmer / grounded / present",
            "wheel": {"primary": "Peaceful", "secondary": "calm", "tertiary": "grounded"},
            "valence": 0.3,
            "arousal": 0.4,
        },
        "post_enrichment": {
            "closing_line": "Movement brings clarity."
        }
    }
]


def select_fade_moments(reflections: List[Dict]) -> List[Dict]:
    """Select 3-5 moments for fade sequence"""
    if len(reflections) < 3:
        return []
    
    sorted_refls = sorted(reflections, key=lambda r: r.get('timestamp', ''))
    total = len(sorted_refls)
    
    selected = []
    
    if total <= 4:
        old_idx = 0
        recent_indices = [total - 2, total - 1]
        selected = [sorted_refls[old_idx]] + [sorted_refls[i] for i in recent_indices]
    else:
        # OLD: Bottom 25%, highest |valence - mean|
        old_pool = sorted_refls[:max(1, total // 4)]
        valences = [r.get('final', {}).get('valence', 0) for r in sorted_refls]
        mean_val = statistics.mean(valences) if valences else 0
        old = max(old_pool, key=lambda r: abs(r.get('final', {}).get('valence', 0) - mean_val))
        
        # MID: 50-65% percentile
        mid_start = total // 2
        mid_end = int(total * 0.65)
        mid_pool = sorted_refls[mid_start:mid_end]
        
        recent_primaries = [
            r.get('final', {}).get('wheel', {}).get('primary')
            for r in sorted_refls[-3:]
            if r.get('final', {}).get('wheel', {}).get('primary')
        ]
        dominant_recent = Counter(recent_primaries).most_common(1)[0][0] if recent_primaries else None
        
        mid = None
        if dominant_recent and mid_pool:
            for r in mid_pool:
                if r.get('final', {}).get('wheel', {}).get('primary') == dominant_recent:
                    mid = r
                    break
        
        if not mid and mid_pool:
            mid = mid_pool[len(mid_pool) // 2]
        
        # RECENT: Last 3
        recent = sorted_refls[-3:]
        
        selected = [old] + ([mid] if mid else []) + recent
    
    # Deduplicate
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
    """Line 1: Tone of Now - more direct and specific"""
    valence = agg['valence_mean']
    arousal = agg['arousal_mean']
    primary = agg['dominant_primary']
    
    # More direct emotional states
    if primary == 'Peaceful':
        if valence > 0.3:
            return "You found some calm this week."
        elif arousal < 0.4:
            return "Things slowed down, quieter now."
        else:
            return "A steady peace, holding ground."
    
    elif primary == 'Mad':
        if arousal > 0.6:
            return "Anger flared up, still burning."
        elif valence < -0.2:
            return "Frustration built, hard to shake."
        else:
            return "The fire cooled, but not gone."
    
    elif primary == 'Scared':
        if arousal > 0.6:
            return "Worry raced through your days."
        elif valence < 0:
            return "Fear sat heavy, weighing down."
        else:
            return "Uncertainty followed you around."
    
    elif primary == 'Sad':
        if valence < -0.3:
            return "Sadness deepened, hard to lift."
        elif arousal < 0.4:
            return "Heaviness settled in, stayed quiet."
        else:
            return "Grief moved through, waves and pauses."
    
    elif primary == 'Joyful':
        if valence > 0.4:
            return "Light broke through, you felt it."
        elif arousal > 0.6:
            return "Energy lifted, something sparked."
        else:
            return "Small joys bloomed, you noticed."
    
    elif primary == 'Powerful':
        if valence > 0.3:
            return "Strength showed up, you used it."
        elif arousal > 0.6:
            return "You pushed forward, momentum built."
        else:
            return "Steady power, claiming space."
    
    # Fallback
    if valence > 0.3:
        return "The week turned lighter."
    elif valence < -0.3:
        return "The week felt heavier."
    else:
        return "The week held steady."


def generate_line2_direction(agg: Dict, latest_refl: Dict) -> str:
    """Line 2: Direction / Next - more direct and actionable"""
    delta = agg['delta_valence']
    primary = agg['dominant_primary']
    
    # Try to use latest closing_line first
    closing_line = latest_refl.get('post_enrichment', {}).get('closing_line', '')
    if closing_line:
        closing_line = closing_line.replace('See you tomorrow.', '').replace('see you tomorrow', '').strip()
        if closing_line and len(closing_line.split()) >= 4:
            return closing_line
    
    # Direct trajectory based on delta_valence
    if delta >= 0.2:
        return "You're moving toward lighter ground."
    elif delta >= 0.1:
        return "Something's shifting, opening up."
    elif delta <= -0.2:
        return "It got harder. Be gentle."
    elif delta <= -0.1:
        return "The weight increased. Rest when you can."
    
    # Direct primary-based guidance
    if primary == 'Mad':
        return "Name what's burning. Let it out."
    elif primary == 'Scared':
        return "You're not alone in this."
    elif primary == 'Sad':
        return "Grief takes time. Keep breathing."
    elif primary == 'Peaceful':
        return "This calm is yours. Keep it close."
    elif primary == 'Joyful':
        return "Hold onto this light."
    elif primary == 'Powerful':
        return "You have what you need."
    
    # Neutral fallback
    return "Tomorrow comes. You'll meet it."


def print_micro_dream(line1: str, line2: str, fade_rids: List[str]):
    """Print final output"""
    print("\nMICRO-DREAM PREVIEW")
    print(f"1) {line1}")
    print(f"2) {line2}")
    print()
    print(f"FADES: {' → '.join(fade_rids)}")
    print()


def refine_with_ollama(raw_line1: str, raw_line2: str, agg: Dict) -> tuple[str, str]:
    """
    Use Ollama phi3 to refine the 2 lines - keep them direct, not vague.
    Low temp (0.2) for consistency.
    """
    ollama_url = "http://localhost:11434/api/generate"
    
    print("[Refining with Ollama phi3...]", file=sys.stderr)
    
    refined_line1 = raw_line1
    refined_line2 = raw_line2
    
    # Refine Line 1 (Tone) - keep it direct and specific
    prompt1 = f"""Make this more direct and specific (6-8 words, no metaphors):

"{raw_line1}"

Be clear about the actual emotion. Output:"""

    try:
        response = requests.post(
            ollama_url,
            json={
                "model": "phi3:latest",
                "prompt": prompt1,
                "stream": False,
                "options": {
                    "temperature": 0.15,
                    "num_predict": 12,
                    "stop": ["\n"]
                }
            },
            timeout=15
        )
        
        if response.status_code == 200:
            result = response.json()
            text = result.get('response', '').strip().replace('"', '').strip()
            text = ' '.join(text.split())
            
            if text and 4 < len(text.split()) <= 10:
                refined_line1 = text
                print(f"  Line 1: {text}", file=sys.stderr)
            else:
                print(f"  Line 1: (raw) {raw_line1}", file=sys.stderr)
    except Exception:
        print(f"  Line 1: (raw) {raw_line1}", file=sys.stderr)
    
    # Refine Line 2 (Direction) - keep it actionable
    prompt2 = f"""Make this more direct and actionable (6-8 words, clear guidance):

"{raw_line2}"

Be specific about what to do. Output:"""

    try:
        response = requests.post(
            ollama_url,
            json={
                "model": "phi3:latest",
                "prompt": prompt2,
                "stream": False,
                "options": {
                    "temperature": 0.15,
                    "num_predict": 12,
                    "stop": ["\n"]
                }
            },
            timeout=15
        )
        
        if response.status_code == 200:
            result = response.json()
            text = result.get('response', '').strip().replace('"', '').strip()
            text = ' '.join(text.split())
            
            if text and 4 < len(text.split()) <= 10:
                refined_line2 = text
                print(f"  Line 2: {text}", file=sys.stderr)
            else:
                print(f"  Line 2: (raw) {raw_line2}", file=sys.stderr)
    except Exception:
        print(f"  Line 2: (raw) {raw_line2}", file=sys.stderr)
    
    print(file=sys.stderr)
    return refined_line1, refined_line2


def main():
    print("[Micro-Dream Generator - MOCK MODE]")
    print(f"[Using {len(SAMPLE_REFLECTIONS)} sample reflections]\n")
    
    # Select fade moments
    fade_moments = select_fade_moments(SAMPLE_REFLECTIONS)
    
    if not fade_moments:
        print("❌ Not enough moments for micro-dream.\n")
        return
    
    print(f"[✓] Selected {len(fade_moments)} moments for fade sequence")
    
    # Aggregate metrics
    agg = aggregate_metrics(fade_moments)
    
    print(f"[✓] Aggregated: {agg['dominant_primary']} | valence={agg['valence_mean']:+.2f} | Δ={agg['delta_valence']:+.2f}\n")
    
    # Generate raw 2 lines (already direct and specific)
    raw_line1 = generate_line1_tone(agg)
    raw_line2 = generate_line2_direction(agg, fade_moments[-1])
    
    print(f"[RAW] Line 1: {raw_line1}")
    print(f"[RAW] Line 2: {raw_line2}\n")
    
    # Refine with Ollama (optional - test both)
    line1, line2 = refine_with_ollama(raw_line1, raw_line2, agg)
    
    # Print output
    fade_rids = [m['rid'] for m in fade_moments]
    print_micro_dream(line1, line2, fade_rids)


if __name__ == '__main__':
    main()
