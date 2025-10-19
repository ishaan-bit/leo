#!/usr/bin/env python3
"""
Behavioral Backend CLI
Terminal-only interface for reflection analysis with temporal dynamics.
"""

import os
import sys
import json
import click
from datetime import datetime, timezone
from dotenv import load_dotenv

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from analyzer import analyze_reflection
from dynamics import process_dynamics
from persistence import UpstashStore


@click.group()
def cli():
    """Behavioral Backend - Reflection analysis with temporal dynamics."""
    pass


@cli.command()
@click.option('--user', required=True, help='User ID')
@click.option('--text', required=True, help='Reflection text (English)')
@click.option('--ts', default=None, help='Timestamp (ISO 8601, UTC). Defaults to now.')
def analyze(user, text, ts):
    """
    Analyze a reflection and update user state.
    Prints JSON output to stdout.
    """
    # Load environment
    load_dotenv()
    
    # Generate timestamp if not provided
    if not ts:
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    
    # Validate input
    if not text or len(text.strip()) == 0:
        click.echo(json.dumps({"error": "Empty text provided"}), err=True)
        sys.exit(1)
    
    try:
        # Initialize persistence (DISABLED - local processing only)
        # store = UpstashStore()
        
        # Get window size from env
        window = int(os.getenv("BASELINE_WINDOW", "10"))
        
        # Log start
        click.echo(f"[Analyzing] user={user}, ts={ts}, text_len={len(text)}", err=True)
        click.echo(f"[Mode] LOCAL ONLY - Upstash persistence disabled", err=True)
        
        # Step 1: Feature extraction
        features = analyze_reflection(text)
        
        # Observability: Log extracted features to stderr
        click.echo(
            f"[FEATURES] emotion={features['invoked']['emotion']} "
            f"v={features['invoked']['valence']:.2f} a={features['invoked']['arousal']:.2f} "
            f"intensity={features['expressed_intensity']:.3f} tone={features['expressed_tone']} "
            f"awareness={features['self_awareness_proxy']:.2f} risk={len(features['risk_flags'])}",
            err=True
        )
        
        # Step 2: Use default state and empty recent reflections (no DB lookup)
        prev_state = {"v": 0.0, "a": 0.3, "updated_at": None}
        recent_reflections = []
        
        click.echo(f"[State] prev_state={prev_state}, recent_count={len(recent_reflections)}", err=True)
        
        # Step 3: Compute dynamics
        dynamics = process_dynamics(
            user_id=user,
            invoked=features["invoked"],
            expressed_tone=features["expressed_tone"],
            expressed_intensity=features["expressed_intensity"],
            willingness_to_express=features["willingness_to_express"],
            recent_reflections=recent_reflections,
            prev_state=prev_state,
        )
        
        # Observability: Log dynamics state to stderr
        click.echo(
            f"[DYNAMICS] v={dynamics['state']['v']:.3f} a={dynamics['state']['a']:.3f} "
            f"base=({dynamics['baseline']['valence']:.2f},{dynamics['baseline']['arousal']:.2f}) "
            f"shock=({dynamics['shock']['valence']:.2f},{dynamics['shock']['arousal']:.2f}) "
            f"ERI={dynamics['ERI']:.2f}",
            err=True
        )
        
        # Step 4: Build reflection record
        reflection_record = {
            "user_id": user,
            "ts": ts,
            "text": text,
            "event_keywords": features["event_keywords"],
            "invoked_emotion": features["invoked"]["emotion"],
            "invoked_valence": features["invoked"]["valence"],
            "invoked_arousal": features["invoked"]["arousal"],
            "expressed_tone": features["expressed_tone"],
            "expressed_intensity": features["expressed_intensity"],
            "self_awareness_proxy": features["self_awareness_proxy"],
            "willingness_to_express": features["willingness_to_express"],
            "risk_flags": features["risk_flags"],
            "state_valence": dynamics["state"]["v"],
            "state_arousal": dynamics["state"]["a"],
            "ERI": dynamics["ERI"],
        }
        
        # Step 5: Skip saving to Upstash (local processing only)
        click.echo(f"[Skip] Upstash persistence disabled - processing locally only", err=True)
        
        # If risk flags present, log to stderr
        if features["risk_flags"]:
            click.echo(f"[Risk] flags={features['risk_flags']} detected (not persisted)", err=True)
        
        # Step 6: Build output JSON
        output = {
            "invoked": {
                "emotion": features["invoked"]["emotion"],
                "valence": features["invoked"]["valence"],
                "arousal": features["invoked"]["arousal"],
                "confidence": features["invoked"]["confidence"],
            },
            "expressed": {
                "tone": features["expressed_tone"],
                "intensity": features["expressed_intensity"],
            },
            "ERI": dynamics["ERI"],
            "baseline": dynamics["baseline"],
            "state": {
                "valence": dynamics["state"]["v"],
                "arousal": dynamics["state"]["a"],
            },
            "event_keywords": features["event_keywords"],
            "risk_flags": features["risk_flags"],
        }
        
        # Print JSON to stdout
        print(json.dumps(output, indent=2))
        
    except Exception as e:
        click.echo(f"[Error] {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.option('--user', required=True, help='User ID')
@click.option('-n', default=5, help='Number of reflections to show')
def tail(user, n):
    """
    Show last N reflections for a user.
    [DISABLED] Upstash persistence is disabled - local processing only.
    """
    load_dotenv()
    
    click.echo(f"[Error] tail command disabled - Upstash persistence is turned off", err=True)
    click.echo(f"[Info] The behavioral backend is running in local-only mode", err=True)
    sys.exit(1)


if __name__ == '__main__':
    cli()
