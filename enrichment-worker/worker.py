"""
Enrichment Worker
Polls Redis for normalized reflections, runs analytics, calls Ollama, merges results
"""

import os
import time
import json
import requests
from datetime import datetime
from typing import Dict, Optional
from dotenv import load_dotenv
from pathlib import Path
import threading

# Load environment variables from .env file in the same directory as this script
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Import modules
from src.modules.redis_client import get_redis
from src.modules.post_enricher import PostEnricher
from src.utils.emotion_validator import get_validator

# Configuration
POLL_MS = int(os.getenv('WORKER_POLL_MS', '500'))
NORMALIZED_KEY = os.getenv('REFLECTIONS_NORMALIZED_KEY', 'reflections:normalized')
BASELINE_BLEND = float(os.getenv('BASELINE_BLEND', '0.35'))
TIMEZONE = os.getenv('TIMEZONE', 'Asia/Kolkata')

# Initialize components
redis_client = get_redis()
emotion_validator = get_validator()  # Canonical Willcox Wheel validator

# Initialize Hybrid Scorer
print(f"[*] Initializing Hybrid Scorer")
from src.modules.hybrid_scorer import HybridScorer
ollama_client = HybridScorer(
    hf_token=os.getenv('HF_TOKEN'),
    ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    use_ollama=True
)

# Stage-2 Post-Enricher
post_enricher = PostEnricher(
    ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    ollama_model=os.getenv('OLLAMA_MODEL', 'phi3:latest'),
    temperature=float(os.getenv('STAGE2_TEMPERATURE', '0.8')),
    timeout=int(os.getenv('STAGE2_TIMEOUT', '360'))  # 6 minutes for CPU inference (no GPU)
)


def generate_songs_async(rid: str):
    """
    Generate song recommendations in background thread (non-blocking)
    Runs in parallel with Stage 2 post-enrichment
    """
    try:
        print(f"[ASYNC] Starting song generation for {rid}...")
        song_worker_url = os.getenv('SONG_WORKER_URL', 'http://localhost:5051')
        song_response = requests.post(
            f'{song_worker_url}/recommend',
            json={'rid': rid, 'refresh': False},
            timeout=300  # Increased timeout for YouTube API retries and fallback
        )
        
        if song_response.ok:
            song_data = song_response.json()
            
            # Add songs to the reflection in Upstash
            reflection_key = f'reflection:{rid}'
            reflection_json = redis_client.get(reflection_key)
            if reflection_json:
                reflection = json.loads(reflection_json)
                reflection['songs'] = {
                    'en': song_data.get('tracks', {}).get('en', {}),
                    'hi': song_data.get('tracks', {}).get('hi', {})
                }
                redis_client.set(reflection_key, json.dumps(reflection), ex=30 * 24 * 60 * 60)
                
                print(f"[OK] Songs added to reflection:{rid}")
                print(f"   Song EN: {reflection['songs']['en'].get('title', 'N/A')}")
                print(f"   Song HI: {reflection['songs']['hi'].get('title', 'N/A')}")
        else:
            print(f"[!] Song worker failed: {song_response.status_code}")
    except Exception as song_err:
        print(f"[!] Song generation failed (non-fatal): {song_err}")


def check_health() -> Dict:
    """Check health of dependencies"""
    ollama_ok = ollama_client.is_available()
    redis_ok = redis_client.ping()
    
    status = "healthy" if (ollama_ok and redis_ok) else "degraded"
    
    return {
        'ollama': 'ok' if ollama_ok else 'down',
        'redis': 'ok' if redis_ok else 'down',
        'status': status,
        'model': ollama_client.ollama_model,
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
        print(f"[!] Skipping incomplete reflection: {reflection}")
        return None
    
    print(f"\n[>] Processing {rid}")
    print(f"   Text: {normalized_text[:80]}...")
    
    start_time = time.time()
    
    try:
        # 1. Get user history for temporal analytics
        history = redis_client.get_user_history(sid, limit=90)
        print(f"[=] Loaded {len(history)} past reflections for {sid}")
        
        # 2. Stage-1: Hybrid Scorer
        print(f"[*] Stage-1: Hybrid Scorer...")
        ollama_result = ollama_client.enrich(normalized_text, history, timestamp)
        
        if not ollama_result:
            print(f"[X] Enrichment scorer failed for {rid}")
            redis_client.set_worker_status('degraded', {'reason': 'scorer_failed', 'rid': rid})
            return None
        
        # 2.5. VALIDATE EMOTIONS against canonical Willcox Wheel
        print(f"[*] Validating emotions...")
        wheel = ollama_result.get('wheel', {})
        primary = wheel.get('primary')
        secondary = wheel.get('secondary')
        tertiary = wheel.get('tertiary')
        
        # Validate emotion triplet
        is_valid = emotion_validator.validate_emotion(primary, secondary, tertiary) if (primary and secondary and tertiary) else False
        
        # Log validation result
        emotion_validator.log_validation(primary, secondary, tertiary, is_valid, context=rid)
        
        # Normalize if invalid
        if not is_valid:
            print(f"[!] Invalid emotion detected: {primary} -> {secondary} -> {tertiary}")
            is_valid_normalized, p_norm, s_norm, t_norm = emotion_validator.normalize_emotion(primary, secondary, tertiary)
            
            # Update wheel with normalized values
            ollama_result['wheel'] = {
                'primary': p_norm,
                'secondary': s_norm,
                'tertiary': t_norm
            }
            
            # Add warning
            if 'warnings' not in ollama_result:
                ollama_result['warnings'] = []
            ollama_result['warnings'].append(f"Emotion normalized from {primary}/{secondary}/{tertiary} to {p_norm}/{s_norm}/{t_norm}")
            
            print(f"[*] Normalized to: {p_norm} -> {s_norm} -> {t_norm}")
        else:
            print(f"[OK] Emotion valid: {primary} -> {secondary} -> {tertiary}")
        
        # 2.6. MAP BACKEND TO FRONTEND LABELS
        # Backend uses: sad, angry, fearful, happy, peaceful, strong (from willcox_wheel.json)
        # Frontend expects: sad, mad, scared, joyful, peaceful, powerful (from zones.ts)
        # This mapping happens AFTER validation so validator can check canonical wheel
        print(f"[*] Mapping backend emotions to frontend labels...")
        backend_to_frontend = {
            'happy': 'joyful',
            'sad': 'sad',
            'angry': 'mad',
            'fearful': 'scared',
            'peaceful': 'peaceful',
            'strong': 'powerful',
            # Capitalized versions (just in case)
            'Happy': 'joyful',
            'Sad': 'sad',
            'Angry': 'mad',
            'Fearful': 'scared',
            'Peaceful': 'peaceful',
            'Strong': 'powerful',
        }
        
        current_primary = ollama_result['wheel'].get('primary')
        if current_primary:
            mapped_primary = backend_to_frontend.get(current_primary, current_primary.lower())
            if current_primary != mapped_primary:
                print(f"   [MAPPED] {current_primary} → {mapped_primary} (for frontend zone compatibility)")
                ollama_result['wheel']['primary'] = mapped_primary
        
        # 3. Build Stage-1 enriched fields for Redis
        enriched_stage1 = {
            'timezone_used': TIMEZONE,
            'final': {
                'invoked': ollama_result['invoked'],
                'expressed': ollama_result['expressed'],
                'expressed_text': None,
                'wheel': ollama_result['wheel'],
                'valence': ollama_result['valence'],
                'arousal': ollama_result['arousal'],
                'confidence': ollama_result['confidence'],
                'events': ollama_result['events'],
                'warnings': ollama_result['warnings'],
            },
            'congruence': ollama_result['congruence'],
            'temporal': ollama_result['temporal'],
            'willingness': ollama_result['willingness'],
            'willingness_cues': ollama_result['willingness_cues'],
            'comparator': ollama_result['comparator'],
            'recursion': ollama_result['recursion'],
            'state': ollama_result['state'],
            'quality': ollama_result['quality'],
            'risk_signals_weak': ollama_result['risk_signals_weak'],
            'provenance': ollama_result['provenance'],
            'meta': ollama_result['meta'],
            'status': 'stage1_complete',  # Mark as Stage-1 complete
        }
        
        # 4. Save Stage-1 results immediately to Upstash
        print(f"\n{'='*60}")
        print(f"[S] SAVING STAGE-1 TO UPSTASH NOW...")
        print(f"{'='*60}")
        success_stage1 = redis_client.set_enriched(rid, enriched_stage1)
        
        if not success_stage1:
            print(f"[X] Failed to write Stage-1 data for {rid}")
            return None
        
        stage1_time = int((time.time() - start_time) * 1000)
        print(f"[OK] STAGE-1 SAVED TO UPSTASH in {stage1_time}ms")
        print(f"   -> Key: reflections:enriched:{rid}")
        print(f"   -> Status: stage1_complete")
        print(f"   -> Frontend can query Upstash NOW for analytical data")
        print(f"{'='*60}\n")
        
        # 4.4. Update original reflection with 'final' data for song worker
        print(f"[*] Adding 'final' data to reflection:{rid}...")
        try:
            reflection_key = f'reflection:{rid}'
            reflection_json = redis_client.get(reflection_key)
            if reflection_json:
                reflection = json.loads(reflection_json)
                reflection['final'] = enriched_stage1['final']
                write_success = redis_client.set(reflection_key, json.dumps(reflection), ex=30 * 24 * 60 * 60)
                if write_success:
                    print(f"[OK] Added 'final' data to reflection:{rid}")
                    print(f"   Primary: {enriched_stage1['final']['wheel']['primary']}")
                    print(f"   Wheel: {enriched_stage1['final']['wheel']['primary']} → {enriched_stage1['final']['wheel'].get('secondary')} → {enriched_stage1['final']['wheel'].get('tertiary')}")
                else:
                    print(f"[!] Redis write failed for reflection:{rid}")
            else:
                print(f"[!] Could not fetch reflection:{rid} to update with final data")
        except Exception as update_err:
            print(f"[!] Failed to update reflection with final data: {update_err}")
            import traceback
            traceback.print_exc()
        
        # 4.5. Start Song Generation in Background (parallel with Stage-2)
        print(f"[*] Starting song generation in background thread...")
        song_thread = threading.Thread(target=generate_songs_async, args=(rid,), daemon=True)
        song_thread.start()
        print(f"[OK] Song generation started (non-blocking)")
        
        # 5. Stage-2: Post-Enrichment (creative content) - runs PARALLEL with songs
        print(f"[*] Stage-2: Post-Enricher (background)...")
        try:
            ollama_result['status'] = 'stage1_complete'
            final_result = post_enricher.run_post_enrichment(ollama_result)
            
            # Add post_enrichment to existing enriched data
            enriched_stage1['post_enrichment'] = final_result['post_enrichment']
            enriched_stage1['status'] = 'complete'  # Both stages done
            
            # 6. Update Upstash with Stage-2 results
            print(f"\n{'='*60}")
            print(f"[S] UPDATING UPSTASH WITH STAGE-2...")
            print(f"{'='*60}")
            success_stage2 = redis_client.set_enriched(rid, enriched_stage1)
            
            if success_stage2:
                total_time = int((time.time() - start_time) * 1000)
                print(f"[OK] STAGE-2 SAVED TO UPSTASH in {total_time - stage1_time}ms")
                print(f"   -> Key: reflections:enriched:{rid}")
                print(f"   -> Status: complete")
                print(f"   -> Added: post_enrichment (poems, tips, closing)")
                print(f"[OK] FULL PIPELINE COMPLETE in {total_time}ms")
                print(f"{'='*60}\n")
                
                # 7. Check if micro-dream should be generated (after post-enrichment complete)
                # Note: Guests are excluded - micro-dreams only for signed-in users
                try:
                    # Fetch the full reflection from Upstash to get owner_id
                    reflection_key = f'reflection:{rid}'
                    reflection_json = redis_client.get(reflection_key)
                    
                    if not reflection_json:
                        print(f"[!] Could not fetch reflection:{rid} for micro-dream check")
                    else:
                        import json as json_lib
                        full_reflection = json_lib.loads(reflection_json)
                        owner_id = full_reflection.get('owner_id')
                        
                        if owner_id:
                            # Skip micro-dream generation for guest users
                            if owner_id.startswith('guest:'):
                                print(f"🚫 Skipping micro-dream for guest session: {owner_id}")
                            else:
                                print(f"🌙 Checking micro-dream trigger for owner: {owner_id}")
                                
                                # Import micro-dream agent
                                import sys
                                sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
                                from micro_dream_agent import MicroDreamAgent, UpstashClient, OllamaClient
                                
                                # Initialize clients
                                upstash_client_md = UpstashClient(
                                    os.getenv('UPSTASH_REDIS_REST_URL'),
                                    os.getenv('UPSTASH_REDIS_REST_TOKEN')
                                )
                                ollama_client_md = OllamaClient()
                                
                                # Run micro-dream agent
                                agent = MicroDreamAgent(upstash_client_md, ollama_client_md)
                                
                                # Generate micro-dream after moment #3 post-enrichment (will increment signin_count)
                                # Will display at signin #4, 6, 8, 11, 13... (pattern: +2, +2, +3, +2, +3...)
                                result = agent.run(owner_id, force_dream=False, skip_ollama=False)
                                
                                if result and result.get('should_display'):
                                    print(f"[OK] Micro-dream generated and stored for next signin")
                                else:
                                    print(f"   Not eligible for display yet (signin #{result['signin_count'] if result else 'unknown'})")
                        else:
                            print(f"[!] No owner_id found in reflection:{rid}")
                    
                except Exception as micro_err:
                    print(f"[!] Micro-dream generation failed (non-fatal): {micro_err}")
                    import traceback
                    traceback.print_exc()
                    # Non-fatal - enrichment is already complete
                
            else:
                print(f"[!] Failed to write Stage-2 data, but Stage-1 is saved")
                
        except Exception as e:
            print(f"[!] Stage-2 failed: {e}")
            print(f"   Stage-1 data is already saved and usable")
            # Don't return None - Stage-1 is already saved
        
        return enriched_stage1
        
    except Exception as e:
        print(f"[X] Error processing {rid}: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    """Main worker loop"""
    print("[*] Enrichment Worker Starting...")
    print(f"   Poll interval: {POLL_MS}ms")
    
    # Print Ollama info
    print(f"   Ollama: {ollama_client.ollama_base_url}")
    print(f"   Model: {ollama_client.ollama_model}")
    print(f"   Timezone: {TIMEZONE}")
    print(f"   Baseline blend: {BASELINE_BLEND}")
    
    # Check health
    health = check_health()
    print(f"\n[+] Health Check:")
    print(f"   Ollama: {health['ollama']}")
    print(f"   Redis: {health['redis']}")
    print(f"   Status: {health['status']}")
    
    if health['status'] != 'healthy':
        print(f"\n[!] WARNING: System not fully healthy!")
        redis_client.set_worker_status('degraded', health)
    else:
        redis_client.set_worker_status('healthy', health)
    
    print(f"\n[~] Watching {NORMALIZED_KEY} for reflections...\n")
    
    # Main loop
    processed_count = 0
    
    while True:
        try:
            # Check queue length
            queue_len = redis_client.llen(NORMALIZED_KEY)
            
            if queue_len > 0:
                print(f"[<] Queue length: {queue_len}")
                
                # Pop one reflection
                reflection = redis_client.lpop_normalized(NORMALIZED_KEY)
                
                if reflection:
                    # Process it
                    result = process_reflection(reflection)
                    
                    if result:
                        processed_count += 1
                        print(f"[=] Total processed: {processed_count}")
                    
                    # Update worker status
                    redis_client.set_worker_status('healthy', {
                        'processed_count': processed_count,
                        'queue_length': queue_len - 1,
                    })
            
            # Sleep
            time.sleep(POLL_MS / 1000.0)
            
        except KeyboardInterrupt:
            print("\n\n[*] Worker shutting down...")
            redis_client.set_worker_status('down', {'reason': 'manual_shutdown'})
            break
        except Exception as e:
            print(f"[X] Worker error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            redis_client.set_worker_status('degraded', {'reason': str(e)})
            time.sleep(5)  # Back off on error


if __name__ == '__main__':
    main()
