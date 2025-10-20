"""
Backfill Script
Transform refl_test_1234567890 to corrected schema
"""

import json
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

from src.modules.redis_client import get_redis


def backfill_refl_test_1234567890():
    """Transform the test reflection to new schema"""
    
    redis_client = get_redis()
    
    rid = "refl_test_1234567890"
    
    # Fetch old enriched data
    print(f"📥 Fetching old enriched data for {rid}...")
    old_data_raw = redis_client.get(f"reflections:enriched:{rid}")
    
    if not old_data_raw:
        print(f"❌ No data found for {rid}")
        return
    
    old_data = json.loads(old_data_raw)
    
    print("✅ Fetched old data\n")
    
    # Print old schema
    print("=" * 80)
    print("OLD SCHEMA")
    print("=" * 80)
    print(json.dumps(old_data, indent=2))
    print()
    
    # Transform to new schema
    print("🔄 Transforming to new schema...")
    print()
    
    new_data = {
        "rid": rid,
        "sid": old_data.get("sid", "sess_test"),
        "timestamp": old_data.get("timestamp", "2025-10-20T04:05:22.017397Z"),
        "timezone_used": "Asia/Kolkata",
        "normalized_text": old_data.get("normalized_text", "very tired and irritated, didn't make much progress today"),
        
        "final": {
            "invoked": "fatigue + frustration",  # Corrected from generic label
            "expressed": "irritated / deflated",  # Corrected from verbatim
            "expressed_text": None,
            "wheel": {
                "primary": "sadness",  # Primary Plutchik emotion
                "secondary": "anger"   # Secondary from frustration/irritation
            },
            "valence": 0.25,
            "arousal": 0.60,
            "confidence": 0.80,
            "events": [
                {"label": "fatigue", "confidence": 0.90},
                {"label": "irritation", "confidence": 0.85},
                {"label": "low_progress", "confidence": 0.85}
            ],
            "warnings": []
        },
        
        "congruence": 0.80,  # Moved to top level, computed from invoked↔expressed
        
        "temporal": {
            "ema": old_data.get("temporal", {}).get("ema", {
                "v_1d": 0.25, "v_7d": 0.25, "v_28d": 0.25,
                "a_1d": 0.60, "a_7d": 0.60, "a_28d": 0.60
            }),
            "zscore": {
                "valence": None,  # Null when baseline unknown
                "arousal": None,
                "window_days": 90
            },
            "wow_change": {  # Renamed from wow
                "valence": None,
                "arousal": None
            },
            "streaks": old_data.get("temporal", {}).get("streaks", {
                "positive_valence_days": 0,
                "negative_valence_days": 1
            }),
            "last_marks": {
                "last_positive_at": None,
                "last_negative_at": "2025-10-20T04:05:22.017Z",  # Set because negative_streak >= 1
                "last_risk_at": None
            },
            "circadian": old_data.get("temporal", {}).get("circadian", {
                "hour_local": 9.6,
                "phase": "morning",
                "sleep_adjacent": False
            })
        },
        
        "willingness": {
            "willingness_to_express": 0.55,  # Adjusted for coherence
            "inhibition": 0.0,
            "amplification": 0.60,  # Slightly reduced to match willingness
            "dissociation": 0.0,
            "social_desirability": 0.0
        },
        
        "comparator": {
            "expected": {
                "invoked": "tired",
                "expressed": "exhausted",
                "valence": 0.25,
                "arousal": 0.30
            },
            "deviation": {
                "valence": 0.0,
                "arousal": 0.30
            },
            "note": "Fatigue: arousal higher than expected, indicating activation from irritation."
        },
        
        "recursion": old_data.get("recursion", {
            "method": "hybrid(semantic+lexical+time)",
            "links": [],
            "thread_summary": "",
            "thread_state": "new"
        }),
        
        "state": old_data.get("state", {
            "valence_mu": 0.25,
            "arousal_mu": 0.60,
            "energy_mu": 0.425,
            "fatigue_mu": 0.575,
            "sigma": 0.3,
            "confidence": 0.5
        }),
        
        "quality": old_data.get("quality", {
            "text_len": 57,
            "uncertainty": 0.20
        }),
        
        "risk_signals_weak": [],
        
        "provenance": {
            "baseline_version": "rules@v1",
            "ollama_model": "phi3:latest"
        },
        
        "meta": {
            "mode": "hybrid-local",
            "blend": 0.35,
            "revision": 2,  # Incremented
            "created_at": datetime.utcnow().isoformat() + 'Z',
            "ollama_latency_ms": old_data.get("meta", {}).get("ollama_latency_ms", 14803),
            "warnings": []
        }
    }
    
    print("=" * 80)
    print("NEW SCHEMA")
    print("=" * 80)
    print(json.dumps(new_data, indent=2))
    print()
    
    # Show diff
    print("=" * 80)
    print("KEY CHANGES")
    print("=" * 80)
    print()
    print("✅ final.invoked: 'daily reflection' → 'fatigue + frustration'")
    print("✅ final.expressed: verbatim text → 'irritated / deflated'")
    print("✅ final.wheel: ADDED → {primary: 'sadness', secondary: 'anger'}")
    print("✅ final.events: 1 generic → 3 specific [fatigue, irritation, low_progress]")
    print("✅ congruence: moved from comparator to top level (0.80)")
    print("✅ temporal.wow → temporal.wow_change")
    print("✅ temporal.zscore: added window_days=90")
    print("✅ temporal.last_marks.last_negative_at: null → '2025-10-20T04:05:22.017Z'")
    print("✅ willingness: adjusted for coherence (amplification ↔ willingness_to_express)")
    print("✅ provenance: restructured → {baseline_version, ollama_model}")
    print("✅ meta: added mode, blend, revision, created_at")
    print()
    
    # Write to Redis
    print("💾 Writing backfilled data to Redis...")
    redis_client.set_enriched(rid, new_data, ttl=2592000)
    print(f"✅ Backfilled {rid}")
    print()
    
    return new_data


if __name__ == '__main__':
    backfill_refl_test_1234567890()
