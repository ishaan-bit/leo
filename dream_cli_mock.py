#!/usr/bin/env python3
"""
Dream CLI - Mock Mode (No Network Required)
Uses sample reflection data to demonstrate dream generation
"""

import json
import statistics
from collections import Counter
from typing import List, Dict, Tuple
import requests
import sys

# Sample reflection data (from user's example)
SAMPLE_REFLECTIONS = [
    {
        "rid": "refl_1761298103684_ib6gufxb5",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-24T09:28:18.176Z",
        "normalized_text": "i dont know how im feeling about this",
        "final": {
            "invoked": "worry + hope + awe",
            "expressed": "hopeful / confused / worried",
            "wheel": {
                "primary": "Scared",
                "secondary": "confused",
                "tertiary": "perplexed"
            },
            "valence": 0.2,
            "arousal": 0.65,
            "confidence": 0.660100910906105
        },
        "post_enrichment": {
            "poems": [
                "Hope flickers in uncertain nights",
                "A maze within a storm's eye view",
                "Sun and clouds of doubt dance"
            ],
            "tips": [
                "Chai with your yaar, share the moment",
                "Lean on an auto ride for city breeze",
                "Let nimbu paani clear the sky in a cup"
            ],
            "closing_line": "awe can often lead to silent reflection. See you tomorrow."
        }
    },
    # Simulated additional reflections for variety
    {
        "rid": "refl_1761306580657_fqr0qaz13",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-24T11:43:00.657Z",
        "normalized_text": "Im frustrated I got distracted and messed up this new feature implementation",
        "final": {
            "invoked": "change + distraction + frustration",
            "expressed": "irritated / calm / angry",
            "wheel": {
                "primary": "Mad",
                "secondary": "angry",
                "tertiary": "mad"
            },
            "valence": -0.3,
            "arousal": 0.75,
            "confidence": 0.9
        },
        "post_enrichment": {
            "poems": [
                "Fire burns beneath the broken code",
                "Patience frays like old thread",
                "Breath returns when storms have passed"
            ],
            "tips": [
                "Step away, walk the street for 5 minutes",
                "Sip ginger chai, reset your mind",
                "Talk to a friend about anything else"
            ],
            "closing_line": "Frustration clears when you give it space."
        }
    },
    {
        "rid": "refl_1761290000000_sample3",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-24T07:13:20.000Z",
        "normalized_text": "Feeling peaceful this morning, just quiet time with tea",
        "final": {
            "invoked": "calm + gratitude + presence",
            "expressed": "content / peaceful / still",
            "wheel": {
                "primary": "Peaceful",
                "secondary": "content",
                "tertiary": "serene"
            },
            "valence": 0.6,
            "arousal": 0.3,
            "confidence": 0.85
        },
        "post_enrichment": {
            "poems": [
                "Morning light softens the edges",
                "Steam rises like quiet prayer",
                "The world waits patiently outside"
            ],
            "tips": [
                "Keep this morning ritual sacred",
                "Notice the warmth in your hands",
                "Let silence be enough"
            ],
            "closing_line": "Peace lives in small rituals."
        }
    }
]


def aggregate_emotions(reflections: List[Dict]) -> Dict:
    """Compute emotional aggregates"""
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
            expressed_parts = final['expressed'].split(' / ')
            expressed_all.extend(expressed_parts)
        
        if 'invoked' in final:
            invoked_parts = final['invoked'].replace(' + ', ' / ').split(' / ')
            invoked_all.extend(invoked_parts)
    
    valence_mean = statistics.mean(valences) if valences else 0.0
    arousal_mean = statistics.mean(arousals) if arousals else 0.0
    
    primary_counts = Counter(primaries)
    dominant_primary = primary_counts.most_common(1)[0][0] if primary_counts else 'Peaceful'
    
    latest_valence = valences[0] if valences else 0.0
    delta_valence = latest_valence - valence_mean if len(valences) > 1 else 0.0
    
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
    """Return lexical palette based on primary emotion"""
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
    
    return palettes.get(primary, palettes['Peaceful'])


def construct_dream_lines(reflections: List[Dict], agg: Dict) -> List[Tuple[str, str]]:
    """Generate 12 dream lines (3 phases × 4 lines)"""
    palette = get_tone_palette(
        agg['dominant_primary'],
        agg['valence_mean'],
        agg['arousal_mean']
    )
    
    # Extract text fragments
    poems = []
    tips = []
    closing_lines = []
    
    for r in reflections[:5]:
        pe = r.get('post_enrichment', {})
        
        if pe.get('poems'):
            for poem in pe['poems']:
                poems.append((poem, r['rid']))
        
        if pe.get('tips'):
            for tip in pe['tips'][:2]:
                tips.append((tip, r['rid']))
        
        if pe.get('closing_line'):
            closing_lines.append((pe['closing_line'], r['rid']))
    
    # Construct 12 lines
    lines = []
    
    # === SETUP (lines 1-4) ===
    setup_phrases = palette['setup']
    
    # Line 1: Opening scene with palette
    lines.append((f"A week where {setup_phrases[0]}.", reflections[0]['rid']))
    
    # Line 2: Use poem fragment
    if poems:
        lines.append((poems[0][0], poems[0][1]))
    else:
        lines.append((f"The {setup_phrases[1]} holds its shape.", reflections[0]['rid']))
    
    # Line 3: Emotional contrast
    expressed = agg['expressed_top']
    invoked = agg['invoked_top']
    lines.append((f"{invoked.capitalize()} whispers beside {expressed}.", reflections[0]['rid']))
    
    # Line 4: Arousal-based atmosphere
    if agg['arousal_mean'] > 0.5:
        lines.append(("The pulse quickens like distant thunder.", reflections[0]['rid']))
    else:
        lines.append(("Stillness settles like morning mist.", reflections[0]['rid']))
    
    # === BUILD-UP (lines 5-8) ===
    buildup_phrases = palette['buildup']
    
    # Line 5: Primary emotion action
    lines.append((f"Where {agg['dominant_primary'].lower()} {buildup_phrases[0]}.", reflections[1]['rid'] if len(reflections) > 1 else reflections[0]['rid']))
    
    # Line 6: Practical tip or palette phrase
    if tips and len(tips) > 0:
        lines.append((tips[0][0], tips[0][1]))
    else:
        lines.append((f"And doubt {buildup_phrases[1]}.", reflections[0]['rid']))
    
    # Line 7: Poem or tension phrase
    if poems and len(poems) > 1:
        lines.append((poems[1][0], poems[1][1]))
    else:
        lines.append((f"While stillness {buildup_phrases[2]}.", reflections[1]['rid'] if len(reflections) > 1 else reflections[0]['rid']))
    
    # Line 8: Transition to resolution
    if agg['arousal_mean'] > 0.6:
        lines.append(("The rhythm shifts, something accelerates.", reflections[0]['rid']))
    else:
        lines.append(("The rhythm shifts, something slows.", reflections[0]['rid']))
    
    # === RESOLUTION (lines 9-12) ===
    resolution_phrases = palette['resolution']
    
    # Line 9: Opening of resolution
    lines.append((f"Until {resolution_phrases[0]}.", reflections[0]['rid']))
    
    # Line 10: Trajectory based on delta valence
    if agg['delta_valence'] > 0.1:
        lines.append((f"You move {resolution_phrases[1]}.", reflections[0]['rid']))
    elif agg['delta_valence'] < -0.1:
        lines.append(("You carry more than yesterday.", reflections[0]['rid']))
    else:
        lines.append(("You hold steady in the current.", reflections[0]['rid']))
    
    # Line 11: Penultimate image (poem or palette)
    if poems and len(poems) > 2:
        lines.append((poems[2][0], poems[2][1]))
    else:
        lines.append((f"And the world {resolution_phrases[2]}.", reflections[0]['rid']))
    
    # Line 12: Final closing line
    if closing_lines:
        lines.append((closing_lines[0][0], closing_lines[0][1]))
    else:
        lines.append((f"Tomorrow arrives wearing {resolution_phrases[3]}.", reflections[0]['rid']))
    
    return lines


def refine_with_ollama(raw_lines: List[Tuple[str, str]], agg: Dict) -> List[Tuple[str, str]]:
    """
    Use Ollama (phi3) to refine raw dream lines into poetic, user-friendly text.
    Low temperature (0.3) for consistency, grounded voice.
    """
    ollama_url = "http://localhost:11434/api/generate"
    
    print("\n[Refining with Ollama phi3...]", file=sys.stderr)
    
    refined_lines = []
    
    for i, (raw_text, rid) in enumerate(raw_lines, 1):
        # Create prompt for refinement
        prompt = f"""Refine this into a short poetic line (max 8 words):

"{raw_text}"

Keep it simple, grounded, evocative. No flowery language. Output only the refined line:"""

        try:
            response = requests.post(
                ollama_url,
                json={
                    "model": "phi3:latest",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.2,
                        "num_predict": 15,
                        "stop": ["\n", "Refined", "Output"]
                    }
                },
                timeout=20
            )
            
            if response.status_code == 200:
                result = response.json()
                refined_text = result.get('response', '').strip()
                
                # Clean up common artifacts
                refined_text = refined_text.replace('"', '').replace('Refined:', '').replace('Output:', '').strip()
                refined_text = ' '.join(refined_text.split())  # Normalize whitespace
                
                # If Ollama returns something reasonable, use it
                if refined_text and 3 < len(refined_text.split()) <= 12:
                    refined_lines.append((refined_text, rid))
                    print(f"  {i}. {refined_text}", file=sys.stderr)
                else:
                    # Fall back to raw
                    refined_lines.append((raw_text, rid))
                    print(f"  {i}. (raw) {raw_text}", file=sys.stderr)
            else:
                refined_lines.append((raw_text, rid))
                print(f"  {i}. (error) {raw_text}", file=sys.stderr)
        
        except Exception as e:
            print(f"  {i}. (skip) {raw_text}", file=sys.stderr)
            refined_lines.append((raw_text, rid))
    
    return refined_lines


def generate_waking_line(agg: Dict) -> str:
    """
    Use Ollama to convert the analytical summary into a poetic "waking line"
    that the pig speaks before waking up.
    """
    ollama_url = "http://localhost:11434/api/generate"
    
    print("\n[Generating waking line...]", file=sys.stderr)
    
    # Build context from aggregates
    dominant = agg['dominant_primary']
    valence_mean = agg['valence_mean']
    delta = agg['delta_valence']
    
    trend_word = "rising" if delta > 0.1 else "falling" if delta < -0.1 else "steady"
    tone_word = "bright" if valence_mean > 0.3 else "heavy" if valence_mean < -0.3 else "mixed"
    
    prompt = f"""A mindfulness pig wakes from reviewing someone's emotional week.

Emotion: {dominant}
Tone: {tone_word}
Trend: {trend_word}

Write one short line (max 10 words) the pig says. Grounded, warm, hopeful.

Line:"""

    try:
        response = requests.post(
            ollama_url,
            json={
                "model": "phi3:latest",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "num_predict": 20,
                    "stop": ["\n", "Line:"]
                }
            },
            timeout=20
        )
        
        if response.status_code == 200:
            result = response.json()
            waking_text = result.get('response', '').strip()
            
            # Clean up
            waking_text = waking_text.replace('"', '').replace('Line:', '').strip()
            waking_text = ' '.join(waking_text.split())
            
            if waking_text and 5 < len(waking_text.split()) <= 15:
                print(f"  ✓ {waking_text}", file=sys.stderr)
                return waking_text
    
    except Exception as e:
        print(f"  ✗ Error: {e}", file=sys.stderr)
    
    # Fallback waking lines based on dominant emotion
    fallbacks = {
        'Mad': "The storm passed. You're still here.",
        'Scared': "The shadows lifted. Morning came.",
        'Sad': "The weight softened. Tomorrow waits.",
        'Peaceful': "Stillness held you. Now breathe.",
        'Joyful': "Light found you. Keep it close.",
        'Powerful': "Strength remembered. You rose."
    }
    
    fallback = fallbacks.get(dominant, "The week breathed. So did you.")
    print(f"  (fallback) {fallback}", file=sys.stderr)
    return fallback


def print_dream_sequence(lines: List[Tuple[str, str]], agg: Dict, waking_line: str):
    """Print dream sequence as 3 poems (4 lines each)"""
    print("\n" + "="*60)
    print("Dream Sequence Preview (Terminal)")
    print("="*60 + "\n")
    
    # POEM 1: SETUP (lines 1-4)
    print("— POEM 1: SETUP —")
    for i, (line, rid) in enumerate(lines[0:4], 1):
        print(f"{line}")
    print(f"   [sources: {', '.join(set(rid for _, rid in lines[0:4]))}]")
    
    print()
    
    # POEM 2: BUILD-UP (lines 5-8)
    print("— POEM 2: BUILD-UP —")
    for i, (line, rid) in enumerate(lines[4:8], 5):
        print(f"{line}")
    print(f"   [sources: {', '.join(set(rid for _, rid in lines[4:8]))}]")
    
    print()
    
    # POEM 3: RESOLUTION (lines 9-12)
    print("— POEM 3: RESOLUTION —")
    for i, (line, rid) in enumerate(lines[8:12], 9):
        print(f"{line}")
    print(f"   [sources: {', '.join(set(rid for _, rid in lines[8:12]))}]")
    
    print()
    print("— WAKING —")
    print(f'🐷 "{waking_line}"')
    
    print()
    
    print("="*60)
    print("Summary (Analytical)")
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
    """Main entry point - MOCK MODE"""
    print("[Dream CLI Agent - MOCK MODE]")
    print("[Using sample reflection data]\n")
    
    # Use sample data
    reflections = SAMPLE_REFLECTIONS
    
    # Sort by timestamp (newest first)
    reflections.sort(key=lambda r: r.get('timestamp', ''), reverse=True)
    
    print(f"[✓] Loaded {len(reflections)} sample reflections\n")
    
    # Aggregate emotions
    agg = aggregate_emotions(reflections)
    
    # Construct raw dream lines
    raw_dream_lines = construct_dream_lines(reflections, agg)
    
    # Refine with Ollama (light hybrid LLM)
    refined_lines = refine_with_ollama(raw_dream_lines, agg)
    
    # Generate waking line (summary → poetic line)
    waking_line = generate_waking_line(agg)
    
    # Print to terminal
    print_dream_sequence(refined_lines, agg, waking_line)


if __name__ == '__main__':
    main()
