#!/usr/bin/env python3
"""
Test worker - processes ONE reflection and shows enriched output
"""
import json
import sys
from dotenv import load_dotenv

load_dotenv()

from src.modules.redis_client import get_redis
from src.modules.ollama_client import OllamaClient
from src.modules.analytics import (
    TemporalAnalyzer, CircadianAnalyzer, WillingnessAnalyzer,
    LatentStateTracker, QualityAnalyzer, RiskSignalDetector
)
from src.modules.comparator import EventComparator
from src.modules.recursion import RecursionDetector
from src.modules.event_mapper import map_generic_events
from datetime import datetime

print("🔧 Initializing components...")

# Initialize clients
redis_client = get_redis()
ollama_client = OllamaClient()

# Initialize analyzers
temporal_analyzer = TemporalAnalyzer()
circadian_analyzer = CircadianAnalyzer()
willingness_analyzer = WillingnessAnalyzer()
state_tracker = LatentStateTracker()
quality_analyzer = QualityAnalyzer()
risk_detector = RiskSignalDetector()
comparator = EventComparator()
recursion_detector = RecursionDetector()

print("✅ Components initialized\n")

def process_reflection(reflection: dict):
    """Process ONE reflection and return enriched data"""
    
    rid = reflection['rid']
    sid = reflection['sid']
    normalized_text = reflection['normalized_text']
    timestamp = reflection['timestamp']
    
    print(f"📥 Processing reflection: {rid}")
    print(f"   Session: {sid}")
    print(f"   Text: {normalized_text}")
    print(f"   Time: {timestamp}\n")
    
    # 1. Get user history
    print("📚 Fetching user history...")
    history = redis_client.get_user_history(sid, limit=90)
    print(f"   Found {len(history)} past reflections\n")
    
    # 2. Call Ollama
    print("🤖 Calling Ollama phi3...")
    ollama_result = ollama_client.enrich(normalized_text)
    print(f"   ✅ Ollama returned in {ollama_result.get('_latency_ms', 0)}ms")
    print(f"   Invoked: {ollama_result.get('invoked', 'N/A')}")
    print(f"   Expressed: {ollama_result.get('expressed', 'N/A')}")
    print(f"   Valence: {ollama_result.get('valence', 0):.2f}")
    print(f"   Arousal: {ollama_result.get('arousal', 0):.2f}")
    print(f"   Events: {ollama_result.get('events', [])}\n")
    
    # 3. Run analytics
    print("📊 Running analytics...")
    
    # Extract values from Ollama
    valence = ollama_result['valence']
    arousal = ollama_result['arousal']
    confidence = ollama_result['confidence']
    invoked = ollama_result['invoked']
    expressed = ollama_result['expressed']
    wheel = ollama_result.get('wheel', {'primary': None, 'secondary': None})
    events_raw = ollama_result.get('events', [])
    ollama_cues = ollama_result.get('willingness_cues', {})
    
    # Validation: reject verbatim expressed
    if expressed.lower().strip() == normalized_text.lower().strip():
        print("   ⚠️  Warning: expressed is verbatim input, forcing to label")
        expressed = "matter-of-fact"
    
    # Temporal EMAs
    ema_1d = temporal_analyzer.compute_ema(valence, history, 1)
    ema_7d = temporal_analyzer.compute_ema(valence, history, 7)
    ema_28d = temporal_analyzer.compute_ema(valence, history, 28)
    
    ema_a_1d = temporal_analyzer.compute_ema(arousal, history, 1)
    ema_a_7d = temporal_analyzer.compute_ema(arousal, history, 7)
    ema_a_28d = temporal_analyzer.compute_ema(arousal, history, 28)
    
    zscore_v = temporal_analyzer.compute_zscore(valence, history, 'valence')
    zscore_a = temporal_analyzer.compute_zscore(arousal, history, 'arousal')
    
    wow_v = temporal_analyzer.compute_wow_change(history, 'valence')
    wow_a = temporal_analyzer.compute_wow_change(history, 'arousal')
    
    streaks = temporal_analyzer.compute_streaks(history, valence)
    last_marks = temporal_analyzer.get_last_marks(history)
    
    print(f"   Temporal: EMA 1d={ema_1d:.2f}, 7d={ema_7d:.2f}, z-score={zscore_v:.2f}")
    
    # Circadian
    circadian = circadian_analyzer.analyze(timestamp)
    print(f"   Circadian: {circadian.get('phase', 'N/A')}, hour={circadian.get('hour_local', 0)}")
    
    # Willingness
    text_cues = willingness_analyzer.extract_cues(normalized_text)
    merged_cues = {
        'hedges': list(set(text_cues['hedges'] + ollama_cues.get('hedges', []))),
        'intensifiers': list(set(text_cues['intensifiers'] + ollama_cues.get('intensifiers', []))),
        'negations': list(set(text_cues['negations'] + ollama_cues.get('negations', []))),
        'self_reference': list(set(text_cues['self_reference'] + ollama_cues.get('self_reference', []))),
    }
    
    willingness = willingness_analyzer.compute_willingness(
        invoked, expressed, merged_cues, valence, valence
    )
    print(f"   Willingness: {willingness.get('willingness_to_express', 0):.2f}")
    
    # Latent state
    energy = (valence + arousal) / 2.0
    fatigue = 1 - energy
    state = state_tracker.update_state(valence, arousal, history, energy, fatigue)
    print(f"   State: valence_mu={state.get('valence_mu', 0):.2f}, confidence={state.get('confidence', 0):.2f}")
    
    # Quality
    quality = quality_analyzer.analyze(normalized_text, confidence)
    print(f"   Quality: text_len={quality.get('text_len', 0)}, uncertainty={quality.get('uncertainty', 0):.2f}")
    
    # Map generic events to specific ones
    events = map_generic_events(events_raw, normalized_text, valence, arousal)
    event_labels = [e['label'] for e in events]
    print(f"   Mapped events: {len(events)} specific events")
    
    # Comparator
    comparator_result = comparator.compare(event_labels, valence, arousal)
    
    # Compute congruence from invoked↔expressed (NEW: top-level field)
    congruence = comparator.compute_invoked_expressed_congruence(invoked, expressed)
    print(f"   Congruence (invoked↔expressed): {congruence:.2f}")
    
    # Recursion
    recursion = recursion_detector.detect_links(normalized_text, event_labels, timestamp, history)
    print(f"   Recursion: {len(recursion.get('links', []))} links, method={recursion.get('method', 'N/A')}")
    
    # Risk
    risk_signals = risk_detector.detect(history, event_labels)
    print(f"   Risk signals: {len(risk_signals)}")
    
    # Update last_marks if negative streak
    if streaks['negative_valence_days'] >= 1 and not last_marks.get('last_negative_at'):
        last_marks['last_negative_at'] = timestamp
    
    print()
    
    # Build temporal object
    temporal = {
        'ema': {
            'v_1d': ema_1d,
            'v_7d': ema_7d,
            'v_28d': ema_28d,
            'a_1d': ema_a_1d,
            'a_7d': ema_a_7d,
            'a_28d': ema_a_28d,
        },
        'zscore': {
            'valence': zscore_v if zscore_v != 0.0 else None,
            'arousal': zscore_a if zscore_a != 0.0 else None,
            'window_days': 90,
        },
        'wow_change': {  # Renamed from wow
            'valence': wow_v if wow_v != 0.0 else None,
            'arousal': wow_a if wow_a != 0.0 else None,
        },
        'streaks': streaks,
        'last_marks': last_marks,
        'circadian': circadian,
    }
    
    # 4. Merge everything (NEW SCHEMA)
    enriched = {
        "rid": rid,
        "sid": sid,
        "timestamp": timestamp,
        "timezone_used": "Asia/Kolkata",
        "normalized_text": normalized_text,
        
        "final": {
            "invoked": invoked,
            "expressed": expressed,
            "expressed_text": None,
            "wheel": wheel,
            "valence": valence,
            "arousal": arousal,
            "confidence": confidence,
            "events": events,
            "warnings": ollama_result.get('warnings', [])
        },
        
        "congruence": congruence,
        
        "temporal": temporal,
        
        "willingness": willingness,
        
        "comparator": comparator_result,
        
        "recursion": recursion,
        
        "state": state,
        
        "quality": quality,
        
        "risk_signals_weak": risk_signals,
        
        "provenance": {
            "baseline_version": "rules@v1",
            "ollama_model": ollama_client.model
        },
        
        "meta": {
            "mode": "hybrid-local",
            "blend": 0.35,
            "revision": 1,
            "created_at": datetime.utcnow().isoformat() + 'Z',
            "ollama_latency_ms": ollama_result.get('_latency_ms', 0),
            "warnings": ollama_result.get('warnings', [])
        }
    }
    
    return enriched

def main():
    print("=" * 80)
    print("🧪 TEST WORKER - Process one reflection and show enriched output")
    print("=" * 80)
    print()
    
    # Check health
    print("🏥 Health check...")
    if not ollama_client.is_available():
        print("❌ Ollama not available!")
        return
    print("✅ Ollama available")
    
    if not redis_client.ping():
        print("❌ Redis not available!")
        return
    print("✅ Redis available\n")
    
    # Pop reflection from queue
    print("📥 Checking queue...")
    reflection = redis_client.lpop_normalized('reflections:normalized')
    
    if not reflection:
        print("❌ No reflections in queue!")
        print("   Run: python test_push.py")
        return
    
    print("✅ Found reflection in queue\n")
    
    # Process it
    try:
        enriched = process_reflection(reflection)
        
        # Show enriched output
        print("=" * 80)
        print("🎉 ENRICHED OUTPUT")
        print("=" * 80)
        print()
        print(json.dumps(enriched, indent=2))
        print()
        
        # Save to Redis
        print("💾 Saving to Redis...")
        redis_client.set_enriched(
            enriched['rid'],
            enriched,
            ttl=2592000  # 30 days
        )
        print(f"✅ Saved to: reflections:enriched:{enriched['rid']}")
        print()
        
    except Exception as e:
        print(f"❌ Error processing reflection: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n👋 Interrupted")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
