"""
Enrichment Worker
Polls Redis for normalized reflections, runs analytics, calls Ollama, merges results
"""

import os
import time
import json
from datetime import datetime
from typing import Dict, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import modules
from src.modules.redis_client import get_redis
from src.modules.ollama_client import OllamaClient
from src.modules.analytics import (
    TemporalAnalyzer, 
    CircadianAnalyzer, 
    WillingnessAnalyzer,
    LatentStateTracker,
    QualityAnalyzer,
    RiskSignalDetector
)
from src.modules.comparator import EventComparator
from src.modules.recursion import RecursionDetector
from src.modules.event_mapper import map_generic_events

# Configuration
POLL_MS = int(os.getenv('WORKER_POLL_MS', '500'))
NORMALIZED_KEY = os.getenv('REFLECTIONS_NORMALIZED_KEY', 'reflections:normalized')
BASELINE_BLEND = float(os.getenv('BASELINE_BLEND', '0.35'))
TIMEZONE = os.getenv('TIMEZONE', 'Asia/Kolkata')

# Initialize components
redis_client = get_redis()
ollama_client = OllamaClient(
    base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    model=os.getenv('OLLAMA_MODEL', 'phi3:latest'),
    timeout=int(os.getenv('OLLAMA_TIMEOUT', '30'))
)

# Analytics modules
temporal_analyzer = TemporalAnalyzer(windows=[1, 7, 28], zscore_window_days=90)
circadian_analyzer = CircadianAnalyzer(timezone=TIMEZONE)
willingness_analyzer = WillingnessAnalyzer()
state_tracker = LatentStateTracker(alpha=0.3)
quality_analyzer = QualityAnalyzer()
risk_detector = RiskSignalDetector(anergy_threshold=3, irritation_threshold=3, window_days=5)
comparator = EventComparator()
recursion_detector = RecursionDetector(max_links=5, similarity_threshold=0.7, time_window_days=14)


def check_health() -> Dict:
    """Check health of dependencies"""
    ollama_ok = ollama_client.is_available()
    redis_ok = redis_client.ping()
    
    status = "healthy" if (ollama_ok and redis_ok) else "degraded"
    
    return {
        'ollama': 'ok' if ollama_ok else 'down',
        'redis': 'ok' if redis_ok else 'down',
        'status': status,
        'model': ollama_client.model,
    }


def process_reflection(reflection: Dict) -> Optional[Dict]:
    """
    Process a single reflection through the enrichment pipeline
    
    Args:
        reflection: Normalized reflection from frontend
    
    Returns:
        Enriched reflection dict or None if failed
    """
    rid = reflection.get('rid')
    sid = reflection.get('sid')
    timestamp = reflection.get('timestamp')
    normalized_text = reflection.get('normalized_text')
    
    if not all([rid, sid, normalized_text]):
        print(f"⚠️  Skipping incomplete reflection: {reflection}")
        return None
    
    print(f"\n🔄 Processing {rid}")
    print(f"   Text: {normalized_text[:80]}...")
    
    start_time = time.time()
    
    try:
        # 1. Get user history for temporal analytics
        history = redis_client.get_user_history(sid, limit=90)
        print(f"📊 Loaded {len(history)} past reflections for {sid}")
        
        # 2. Call Ollama for core enrichment
        print(f"🤖 Calling Ollama...")
        ollama_result = ollama_client.enrich(normalized_text)
        
        if not ollama_result:
            print(f"❌ Ollama enrichment failed for {rid}")
            # Update worker status
            redis_client.set_worker_status('degraded', {'reason': 'ollama_failed', 'rid': rid})
            return None
        
        # Validate and clamp
        ollama_result = ollama_client.validate_and_clamp(ollama_result)
        
        # Extract values
        invoked = ollama_result['invoked']
        expressed = ollama_result['expressed']
        wheel = ollama_result.get('wheel', {'primary': None, 'secondary': None})
        valence = ollama_result['valence']
        arousal = ollama_result['arousal']
        confidence = ollama_result['confidence']
        events_raw = ollama_result['events']
        warnings = ollama_result['warnings']
        ollama_cues = ollama_result['willingness_cues']
        latency_ms = ollama_result.get('_latency_ms', 0)
        
        # Reject if expressed is verbatim input (validation rule)
        if expressed.lower().strip() == normalized_text.lower().strip():
            warnings.append("expressed_verbatim_input")
            # Force to label
            expressed = "matter-of-fact"
        
        # 3. Baseline Analytics
        print(f"📈 Running baseline analytics...")
        
        # Temporal
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
        
        # Circadian
        circadian = circadian_analyzer.analyze(timestamp)
        
        # Willingness
        text_cues = willingness_analyzer.extract_cues(normalized_text)
        
        # Merge Ollama cues with text-extracted cues
        merged_cues = {
            'hedges': list(set(text_cues['hedges'] + ollama_cues.get('hedges', []))),
            'intensifiers': list(set(text_cues['intensifiers'] + ollama_cues.get('intensifiers', []))),
            'negations': list(set(text_cues['negations'] + ollama_cues.get('negations', []))),
            'self_reference': list(set(text_cues['self_reference'] + ollama_cues.get('self_reference', []))),
        }
        
        willingness = willingness_analyzer.compute_willingness(
            invoked, expressed, merged_cues, valence, valence  # Using same valence for now
        )
        
        # Latent state
        energy = (valence + arousal) / 2.0  # Simplified
        fatigue = 1 - energy
        state = state_tracker.update_state(valence, arousal, history, energy, fatigue)
        
        # Quality
        quality = quality_analyzer.analyze(normalized_text, confidence)
        
        # Map generic events to specific ones
        events = map_generic_events(events_raw, normalized_text, valence, arousal)
        
        # Extract event labels for comparator
        event_labels = [e['label'] for e in events]
        
        # Comparator
        comparator_result = comparator.compare(event_labels, valence, arousal)
        
        # Compute congruence from invoked↔expressed (top-level field)
        congruence = comparator.compute_invoked_expressed_congruence(invoked, expressed)
        
        # Recursion
        recursion = recursion_detector.detect_links(
            normalized_text, event_labels, timestamp, history
        )
        
        # Risk signals
        risk_signals = risk_detector.detect(history, event_labels, normalized_text)
        
        # Update last_marks if negative streak
        if streaks['negative_valence_days'] >= 1 and not last_marks.get('last_negative_at'):
            last_marks['last_negative_at'] = timestamp
        
        # 4. Build enriched fields (will be merged into existing reflection)
        enriched = {
            # Only enriched fields - NOT duplicating rid, sid, timestamp from original
            'timezone_used': TIMEZONE,
            
            'final': {
                'invoked': invoked,
                'expressed': expressed,
                'expressed_text': None,  # Optional gloss
                'wheel': wheel,
                'valence': valence,
                'arousal': arousal,
                'confidence': confidence,
                'events': events,
                'warnings': warnings,
            },
            
            'congruence': congruence,
            
            'temporal': {
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
                'wow_change': {
                    'valence': wow_v if wow_v != 0.0 else None,
                    'arousal': wow_a if wow_a != 0.0 else None,
                },
                'streaks': streaks,
                'last_marks': last_marks,
                'circadian': circadian,
            },
            
            'willingness': willingness,
            
            'comparator': comparator_result,
            
            'recursion': recursion,
            
            'state': state,
            
            'quality': quality,
            
            'risk_signals_weak': risk_signals,
            
            'provenance': {
                'baseline_version': 'rules@v1',
                'ollama_model': ollama_client.model,
            },
            
            'meta': {
                'mode': 'hybrid-local',
                'model': 'phi3:latest',
                'blend': BASELINE_BLEND,
                'revision': 1,
                'enriched_at': datetime.utcnow().isoformat() + 'Z',
                'ollama_latency_ms': latency_ms,
                'warnings': warnings,
            }
        }
        
        # 5. Write to Redis
        success = redis_client.set_enriched(rid, enriched)
        
        total_time = int((time.time() - start_time) * 1000)
        
        if success:
            print(f"✅ Enriched {rid} in {total_time}ms")
            return enriched
        else:
            print(f"❌ Failed to write enriched data for {rid}")
            return None
        
    except Exception as e:
        print(f"❌ Error processing {rid}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main worker loop"""
    print("🚀 Enrichment Worker Starting...")
    print(f"   Poll interval: {POLL_MS}ms")
    print(f"   Ollama: {ollama_client.base_url}")
    print(f"   Model: {ollama_client.model}")
    print(f"   Timezone: {TIMEZONE}")
    print(f"   Baseline blend: {BASELINE_BLEND}")
    
    # Check health
    health = check_health()
    print(f"\n🏥 Health Check:")
    print(f"   Ollama: {health['ollama']}")
    print(f"   Redis: {health['redis']}")
    print(f"   Status: {health['status']}")
    
    if health['status'] != 'healthy':
        print(f"\n⚠️  WARNING: System not fully healthy!")
        redis_client.set_worker_status('degraded', health)
    else:
        redis_client.set_worker_status('healthy', health)
    
    print(f"\n👀 Watching {NORMALIZED_KEY} for reflections...\n")
    
    # Main loop
    processed_count = 0
    
    while True:
        try:
            # Check queue length
            queue_len = redis_client.llen(NORMALIZED_KEY)
            
            if queue_len > 0:
                print(f"📬 Queue length: {queue_len}")
                
                # Pop one reflection
                reflection = redis_client.lpop_normalized(NORMALIZED_KEY)
                
                if reflection:
                    # Process it
                    result = process_reflection(reflection)
                    
                    if result:
                        processed_count += 1
                        print(f"📊 Total processed: {processed_count}")
                    
                    # Update worker status
                    redis_client.set_worker_status('healthy', {
                        'processed_count': processed_count,
                        'queue_length': queue_len - 1,
                    })
            
            # Sleep
            time.sleep(POLL_MS / 1000.0)
            
        except KeyboardInterrupt:
            print("\n\n👋 Worker shutting down...")
            redis_client.set_worker_status('down', {'reason': 'manual_shutdown'})
            break
        except Exception as e:
            print(f"❌ Worker error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            redis_client.set_worker_status('degraded', {'reason': str(e)})
            time.sleep(5)  # Back off on error


if __name__ == '__main__':
    main()
