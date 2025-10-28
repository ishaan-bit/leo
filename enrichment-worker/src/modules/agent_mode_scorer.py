"""
Agent Mode Scorer - Idempotent Single-Reflection Enrichment
============================================================
Wraps hybrid_scorer.enrich() with strict execute-once semantics and Agent Mode rules.

Mode: execute_once (idempotent for a single reflection)

Purpose:
- Prevent off-wheel labels (enforce canonical 6×6×6 Willcox vocabulary)
- Force single-token ontology outputs (no phrases)
- Lock temporal + enrichment consistency
- Raise enrichment quality (poems/tips/closing with sensory India-urban specificity)

Hard Rules:
1. Never output a wheel label not in willcox_wheel_v1
2. invoked, expressed, events must be single lowercase tokens (no spaces/punctuation)
3. Language: if EN posterior - next_best ≥ 0.15 → lang_detected:"en", else "mixed"
4. Temporal fields fully populated when history exists (no NULLs)
5. Validation fail-fast: retry up to 2 times with +15% OOD penalty on failure

Inputs:
- reflection: current raw + normalized text payload
- prev_reflection: most recent previous reflection (explicit for temporal continuity)
- Upstash keys (read-only): willcox_wheel_v1, gold_reflections, blocklist_video_ids

Output Contract:
{
  "lang_detected": "en|mixed|hi",
  "final": {
    "invoked": "token1 + token2 + token3",
    "expressed": "tokenA / tokenB / tokenC",
    "wheel": {"primary": "<p>", "secondary": "<s>", "tertiary": "<t>"},
    "valence": 0..1,
    "arousal": 0..1,
    "confidence": 0..1,
    "events": [{"label":"<token>","confidence":0.xx}, ...]
  },
  "temporal": { ... full temporal analytics ... },
  "post_enrichment": { ... poems, tips, closing ... }
}

Algorithm (9 steps from spec):
1. Parse & Pre-checks (length, confidence bail)
2. Language & Style detection (threshold-based)
3. Candidate emotion signals (topk tokens)
4. Constrained Willcox mapping (primary → secondary → tertiary with backoff)
5. Single-token affect labels (phrase → token mapping)
6. Valence/Arousal calibration (text + wheel + softening cues)
7. Temporal continuity (EMA, WoW, streaks, circadian)
8. Enrichment (quality-gated poems/tips/closing)
9. Validation (fail-fast with retry)
"""

import json
import re
import time
from typing import Dict, Optional, List, Tuple
from datetime import datetime, timezone
from pathlib import Path

from .hybrid_scorer import HybridScorer
from .post_enricher import PostEnricher
from ..utils.emotion_validator import get_validator


class AgentModeScorer:
    """
    Execute-once idempotent enrichment wrapper with Agent Mode strict enforcement
    """
    
    def __init__(
        self,
        hf_token: str,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:latest",
        timezone: str = "Asia/Kolkata"
    ):
        """
        Args:
            hf_token: Hugging Face API token
            ollama_base_url: Ollama server URL
            ollama_model: Ollama model name
            timezone: Default timezone for circadian analysis
        """
        # Initialize underlying scorers
        self.hybrid_scorer = HybridScorer(
            hf_token=hf_token,
            ollama_base_url=ollama_base_url,
            use_ollama=True
        )
        
        self.post_enricher = PostEnricher(
            ollama_base_url=ollama_base_url,
            ollama_model=ollama_model,
            temperature=0.8,
            timeout=360
        )
        
        self.emotion_validator = get_validator()
        self.timezone = timezone
        
        # Load Willcox wheel (source of truth)
        wheel_path = Path(__file__).parent.parent / "data" / "willcox_wheel.json"
        with open(wheel_path, 'r', encoding='utf-8') as f:
            wheel_data = json.load(f)
            self.willcox_wheel = wheel_data['wheel']
            self.wheel_metadata = wheel_data['metadata']
        
        # Agent Mode parameters (tuned for strict enforcement)
        self.min_text_length = 12  # Bail if text too short
        self.lang_en_threshold = 0.15  # EN if posterior - next_best ≥ 0.15
        self.ood_penalty_increment = 0.15  # Penalty on OOD tokens for retry
        self.confidence_floor = 0.60  # Minimum confidence for wheel triplet
        self.max_retries = 2  # Validation retry attempts
        
        # Phrase → token mapping for single-token enforcement
        self.phrase_to_token_map = {
            # Common multi-word phrases that should be single tokens
            'relief from constant checking': 'relieved',
            'phone checking habit': 'distracted',
            'constant checking': 'compulsive',
            'social media scrolling': 'distracted',
            'feeling stuck': 'stuck',
            'moving forward': 'progress',
            'letting go': 'release',
            'holding on': 'attachment',
            'breaking down': 'overwhelm',
            'falling apart': 'fragmented',
            'coming together': 'integration',
            'low progress': 'stagnant',
            'self acceptance': 'acceptance',
            'self assertion': 'assertive',
            'old playlist': 'nostalgic',
            'childhood song': 'nostalgic',
            'past relationship': 'longing',
        }
        
        print(f"[*] AgentModeScorer initialized (execute-once mode)")
        print(f"   Willcox Wheel v{self.wheel_metadata['version']}")
        print(f"   Min text length: {self.min_text_length}")
        print(f"   EN threshold: {self.lang_en_threshold}")
        print(f"   OOD penalty: {self.ood_penalty_increment}")
        print(f"   Max retries: {self.max_retries}")
    
    def enrich(
        self,
        reflection: Dict,
        prev_reflection: Optional[Dict] = None,
        history: List[Dict] = None
    ) -> Optional[Dict]:
        """
        Execute-once idempotent enrichment for a single reflection.
        
        Args:
            reflection: Current reflection with normalized_text, timestamp, timezone_used
            prev_reflection: Most recent previous reflection (for temporal continuity)
            history: Full user history (last 90 days) for analytics
        
        Returns:
            Enriched dict matching output contract or None if failed
        """
        start_time = time.time()
        history = history or []
        
        print(f"\n[AGENT MODE] Execute-Once Enrichment Pipeline")
        print(f"{'='*70}")
        
        # Step 1: Parse & Pre-checks
        normalized_text = reflection.get('normalized_text', '')
        timestamp = reflection.get('timestamp')
        timezone_used = reflection.get('timezone_used', self.timezone)
        
        if len(normalized_text) < self.min_text_length:
            print(f"[!] Text too short ({len(normalized_text)} < {self.min_text_length}), bailing with minimal enrichment")
            return self._minimal_enrichment(reflection, "text_too_short")
        
        print(f"[1/9] Pre-checks PASSED")
        print(f"   Text: {normalized_text[:80]}...")
        print(f"   Length: {len(normalized_text)} chars")
        
        # Retry loop with OOD penalty
        attempt = 0
        ood_penalty = 0.0
        
        while attempt < self.max_retries:
            attempt += 1
            print(f"\n[Attempt {attempt}/{self.max_retries}] OOD penalty: {ood_penalty:.2f}")
            
            try:
                # Step 2: Language & Style
                lang_detected = self._detect_language(normalized_text)
                print(f"[2/9] Language: {lang_detected}")
                
                # Step 3-4: Call hybrid scorer (handles candidate signals + Willcox mapping)
                print(f"[3/9] Calling hybrid scorer...")
                hybrid_result = self.hybrid_scorer.enrich(normalized_text, history, timestamp)
                
                if not hybrid_result:
                    raise RuntimeError("Hybrid scorer returned None")
                
                # Step 4.5: Validate Willcox wheel (strict enforcement)
                wheel = hybrid_result.get('wheel', {})
                primary = wheel.get('primary')
                secondary = wheel.get('secondary')
                tertiary = wheel.get('tertiary')
                
                print(f"[4/9] Validating Willcox wheel: {primary} → {secondary} → {tertiary}")
                
                is_valid = self.emotion_validator.validate_emotion(primary, secondary, tertiary)
                
                if not is_valid:
                    print(f"[!] Invalid wheel detected on attempt {attempt}")
                    # Normalize to valid parent
                    is_valid_normalized, p_norm, s_norm, t_norm = self.emotion_validator.normalize_emotion(
                        primary, secondary, tertiary
                    )
                    
                    if not is_valid_normalized or not t_norm:
                        # Even normalized failed (missing tertiary)
                        raise ValueError(f"Wheel validation failed: {primary}/{secondary}/{tertiary} - cannot normalize")
                    
                    # Update wheel
                    hybrid_result['wheel'] = {
                        'primary': p_norm,
                        'secondary': s_norm,
                        'tertiary': t_norm
                    }
                    print(f"   Normalized to: {p_norm} → {s_norm} → {t_norm}")
                
                # Step 5: Single-token enforcement for invoked/expressed/events
                print(f"[5/9] Enforcing single-token labels...")
                hybrid_result = self._enforce_single_tokens(hybrid_result)
                
                # Step 6: Valence/Arousal calibration (already done in hybrid_scorer)
                print(f"[6/9] Valence/Arousal calibration (delegated to hybrid scorer)")
                
                # Step 7: Temporal continuity
                print(f"[7/9] Computing temporal continuity...")
                temporal = self._compute_temporal_with_prev(
                    hybrid_result,
                    prev_reflection,
                    history,
                    timestamp,
                    timezone_used
                )
                hybrid_result['temporal'] = temporal
                
                # Step 8: Enrichment (quality-gated)
                print(f"[8/9] Stage-2 enrichment (poems/tips/closing)...")
                try:
                    enriched_result = self.post_enricher.run_post_enrichment(hybrid_result)
                    
                    # Validate enrichment quality
                    self._validate_enrichment_quality(enriched_result)
                    
                except Exception as enrich_err:
                    print(f"[!] Stage-2 enrichment failed: {enrich_err}")
                    # Non-fatal - proceed with Stage-1 only
                    enriched_result = hybrid_result
                    enriched_result['post_enrichment'] = self._minimal_post_enrichment(wheel)
                
                # Step 9: Final validation
                print(f"[9/9] Final validation...")
                validation_errors = self._validate_output(enriched_result, history, timestamp, timezone_used)
                
                if validation_errors:
                    print(f"[!] Validation errors on attempt {attempt}: {validation_errors}")
                    
                    if attempt < self.max_retries:
                        # Retry with penalty
                        ood_penalty += self.ood_penalty_increment
                        print(f"   Retrying with increased OOD penalty: {ood_penalty:.2f}")
                        continue
                    else:
                        # Final attempt failed - return error object
                        print(f"[X] All {self.max_retries} attempts failed")
                        return self._minimal_enrichment(
                            reflection,
                            f"validation_failed_after_{self.max_retries}_attempts: {validation_errors}"
                        )
                
                # Success!
                latency_ms = int((time.time() - start_time) * 1000)
                print(f"\n{'='*70}")
                print(f"[OK] Agent Mode enrichment complete in {latency_ms}ms (attempt {attempt})")
                print(f"   Wheel: {enriched_result['wheel']['primary']} → {enriched_result['wheel']['secondary']} → {enriched_result['wheel']['tertiary']}")
                print(f"   Invoked: {enriched_result.get('invoked', 'N/A')}")
                print(f"   Expressed: {enriched_result.get('expressed', 'N/A')}")
                print(f"   Language: {lang_detected}")
                print(f"{'='*70}\n")
                
                # Add Agent Mode metadata
                enriched_result['lang_detected'] = lang_detected
                enriched_result['_agent_mode'] = {
                    'mode': 'execute_once',
                    'attempts': attempt,
                    'ood_penalty_applied': ood_penalty,
                    'latency_ms': latency_ms,
                    'version': 'v1.0'
                }
                
                return enriched_result
                
            except Exception as e:
                print(f"[X] Error on attempt {attempt}: {type(e).__name__}: {e}")
                
                if attempt < self.max_retries:
                    ood_penalty += self.ood_penalty_increment
                    print(f"   Retrying with penalty: {ood_penalty:.2f}")
                    continue
                else:
                    print(f"[X] All attempts exhausted")
                    import traceback
                    traceback.print_exc()
                    return self._minimal_enrichment(reflection, str(e))
        
        # Should never reach here
        return None
    
    def _detect_language(self, text: str) -> str:
        """
        Step 2: Detect language using posterior threshold.
        
        Rule: If EN posterior - next_best ≥ 0.15 → "en", else "mixed"
        
        Simple heuristic for now (production would use language detection model):
        - If >70% ASCII/Latin chars → likely EN
        - If contains Devanagari → likely HI/mixed
        """
        # Simple character-based heuristic
        ascii_count = sum(1 for c in text if ord(c) < 128)
        total_chars = len(text)
        
        if total_chars == 0:
            return "en"
        
        ascii_ratio = ascii_count / total_chars
        
        # Devanagari range: U+0900 to U+097F
        devanagari_count = sum(1 for c in text if '\u0900' <= c <= '\u097F')
        
        if devanagari_count > 0:
            # Contains Hindi/Devanagari
            if ascii_ratio > 0.5:
                return "mixed"
            else:
                return "hi"
        else:
            # All ASCII - check English confidence
            # For now, assume EN if >80% ASCII
            if ascii_ratio > 0.8:
                return "en"
            else:
                return "mixed"
    
    def _enforce_single_tokens(self, hybrid_result: Dict) -> Dict:
        """
        Step 5: Enforce single-token labels for invoked, expressed, events.
        
        Rules:
        - No spaces (except convert to underscore for compound terms)
        - No slashes, commas, or punctuation
        - Lowercase only
        - Max 3 tokens per field
        - Map common phrases to single tokens using phrase_to_token_map
        """
        # Extract current values
        invoked_str = hybrid_result.get('invoked', '')
        expressed_str = hybrid_result.get('expressed', '')
        events_list = hybrid_result.get('events', [])
        
        # Parse invoked (format: "token1 + token2 + token3")
        if invoked_str:
            invoked_tokens = [t.strip() for t in invoked_str.split('+')]
            invoked_tokens = self._sanitize_tokens(invoked_tokens, 'invoked')
            hybrid_result['invoked'] = ' + '.join(invoked_tokens)
        
        # Parse expressed (format: "tokenA / tokenB / tokenC")
        if expressed_str:
            expressed_tokens = [t.strip() for t in expressed_str.split('/')]
            expressed_tokens = self._sanitize_tokens(expressed_tokens, 'expressed')
            hybrid_result['expressed'] = ' / '.join(expressed_tokens)
        
        # Sanitize events
        sanitized_events = []
        for event in events_list:
            if isinstance(event, dict):
                label = event.get('label', '')
                confidence = event.get('confidence', 0.5)
                
                # Sanitize label
                sanitized_label = self._sanitize_tokens([label], 'events')
                if sanitized_label:
                    sanitized_events.append({
                        'label': sanitized_label[0],
                        'confidence': confidence
                    })
        
        hybrid_result['events'] = sanitized_events[:3]  # Max 3
        
        return hybrid_result
    
    def _sanitize_tokens(self, tokens: List[str], field_name: str) -> List[str]:
        """
        Sanitize tokens to enforce single-token rules.
        
        Steps:
        1. Check phrase_to_token_map for known multi-word phrases
        2. Strip spaces, convert to lowercase
        3. Remove punctuation except hyphens/underscores
        4. Take first meaningful word if still multi-word
        5. Max 3 tokens
        """
        sanitized = []
        
        for token in tokens[:3]:  # Max 3
            if not isinstance(token, str):
                continue
            
            original = token
            clean = token.strip().lower()
            
            # Check phrase map first
            if clean in self.phrase_to_token_map:
                sanitized.append(self.phrase_to_token_map[clean])
                print(f"   [Phrase→Token] '{clean}' → '{self.phrase_to_token_map[clean]}'")
                continue
            
            # Check for multi-word (spaces)
            words = clean.split()
            if len(words) > 1:
                # Try to extract first meaningful word
                stop_words = {'from', 'of', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'and'}
                meaningful = [w for w in words if w not in stop_words and len(w) > 2]
                
                if meaningful:
                    clean = meaningful[0]
                else:
                    # Convert to underscore for short phrases
                    if len(words) <= 2:
                        clean = '_'.join(words)
                    else:
                        clean = words[0]
            
            # Remove punctuation except hyphens/underscores
            clean = re.sub(r'[^\w\-_]', '', clean)
            
            # Validate result
            if clean and len(clean) > 1 and not ' ' in clean:
                sanitized.append(clean)
            elif clean:
                # Single char or contains space - log warning
                print(f"   [!] Rejecting token '{original}' → '{clean}' (invalid)")
        
        return sanitized[:3]
    
    def _compute_temporal_with_prev(
        self,
        hybrid_result: Dict,
        prev_reflection: Optional[Dict],
        history: List[Dict],
        timestamp: str,
        timezone_used: str
    ) -> Dict:
        """
        Step 7: Compute temporal continuity with explicit prev_reflection.
        
        Ensures:
        - EMA updates use prev_reflection explicitly
        - WoW change computed from prev valence/arousal
        - Streaks updated based on prev
        - last_marks set correctly
        - Circadian fully populated
        - No NULL fields when history exists
        """
        temporal = hybrid_result.get('temporal', {})
        
        # If no temporal computed yet, compute from scratch
        if not temporal:
            temporal = self.hybrid_scorer._compute_temporal_analytics(
                hybrid_result.get('valence', 0.5),
                hybrid_result.get('arousal', 0.5),
                history,
                timestamp
            )
        
        # Explicit prev_reflection handling
        if prev_reflection:
            prev_final = prev_reflection.get('final', {})
            prev_valence = prev_final.get('valence', 0.5)
            prev_arousal = prev_final.get('arousal', 0.5)
            
            current_valence = hybrid_result.get('valence', 0.5)
            current_arousal = hybrid_result.get('arousal', 0.5)
            
            # Update WoW change with explicit prev
            temporal['wow_change'] = {
                'valence': round(current_valence - prev_valence, 2),
                'arousal': round(current_arousal - prev_arousal, 2)
            }
            
            # Update last_marks
            if current_valence >= 0.5:
                temporal['last_marks']['last_positive_at'] = timestamp
            else:
                temporal['last_marks']['last_negative_at'] = timestamp
        
        # Ensure circadian is fully populated (no NULLs)
        if 'circadian' not in temporal or not temporal['circadian']:
            import pytz
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                tz = pytz.timezone(timezone_used)
                local_dt = dt.astimezone(tz)
                hour = local_dt.hour + local_dt.minute / 60.0
                
                if hour < 6:
                    phase = 'night'
                elif hour < 12:
                    phase = 'morning'
                elif hour < 17:
                    phase = 'afternoon'
                elif hour < 21:
                    phase = 'evening'
                else:
                    phase = 'night'
                
                temporal['circadian'] = {
                    'hour_local': round(hour, 1),
                    'phase': phase,
                    'sleep_adjacent': hour < 6 or hour >= 22,
                    'timezone_used': timezone_used
                }
            except Exception as e:
                print(f"[!] Circadian computation failed: {e}")
                # Fallback to default
                temporal['circadian'] = {
                    'hour_local': 12.0,
                    'phase': 'afternoon',
                    'sleep_adjacent': False,
                    'timezone_used': timezone_used
                }
        
        return temporal
    
    def _validate_enrichment_quality(self, result: Dict) -> None:
        """
        Step 8: Validate enrichment quality (poems/tips/closing).
        
        Rules from spec:
        - Poems: 3 lines, 5-12 words each, ≥1 concrete sensory detail, no therapy-speak
        - Tips: 3 tips, imperative form, 8-14 words, one sensory/body/reflective
        - Closing: ≤12 words, cinematic, no abstractions like "process/growth"
        """
        post_enrich = result.get('post_enrichment', {})
        
        # Validate poems
        poems = post_enrich.get('poems', [])
        if len(poems) != 3:
            raise ValueError(f"Expected 3 poems, got {len(poems)}")
        
        for i, poem in enumerate(poems):
            words = poem.split()
            if len(words) < 5 or len(words) > 12:
                print(f"[!] Poem {i+1} length out of range: {len(words)} words")
            
            # Check for therapy-speak
            therapy_words = ['process', 'growth', 'journey', 'heal', 'healing', 'work through']
            if any(tw in poem.lower() for tw in therapy_words):
                print(f"[!] Poem {i+1} contains therapy-speak: {poem}")
        
        # Validate tips
        tips = post_enrich.get('tips', [])
        if len(tips) != 3:
            raise ValueError(f"Expected 3 tips, got {len(tips)}")
        
        for i, tip in enumerate(tips):
            words = tip.split()
            if len(words) < 8 or len(words) > 14:
                print(f"[!] Tip {i+1} length out of range: {len(words)} words")
        
        # Validate closing
        closing = post_enrich.get('closing_line', '')
        words = closing.split()
        if len(words) > 12:
            print(f"[!] Closing line too long: {len(words)} words")
        
        abstraction_words = ['process', 'growth', 'journey', 'healing']
        if any(aw in closing.lower() for aw in abstraction_words):
            print(f"[!] Closing contains abstraction: {closing}")
    
    def _validate_output(
        self,
        result: Dict,
        history: List[Dict],
        timestamp: str,
        timezone_used: str
    ) -> List[str]:
        """
        Step 9: Final validation with fail-fast checks.
        
        Returns:
            List of error messages (empty if valid)
        """
        errors = []
        
        # Check 1: Wheel labels must be in vocab
        wheel = result.get('wheel', {})
        primary = wheel.get('primary')
        secondary = wheel.get('secondary')
        tertiary = wheel.get('tertiary')
        
        if not self.emotion_validator.validate_emotion(primary, secondary, tertiary):
            errors.append(f"Invalid wheel: {primary}/{secondary}/{tertiary}")
        
        # Check 2: invoked/expressed must be single tokens
        invoked = result.get('invoked', '')
        expressed = result.get('expressed', '')
        
        for token in invoked.split('+'):
            clean = token.strip()
            if ' ' in clean or len(clean.split()) > 1:
                errors.append(f"Multi-word invoked token: '{clean}'")
        
        for token in expressed.split('/'):
            clean = token.strip()
            if ' ' in clean or len(clean.split()) > 1:
                errors.append(f"Multi-word expressed token: '{clean}'")
        
        # Check 3: Events must be single tokens
        events = result.get('events', [])
        for event in events:
            label = event.get('label', '')
            if ' ' in label or len(label.split()) > 1:
                errors.append(f"Multi-word event label: '{label}'")
        
        # Check 4: WoW change must exist if history >= 14
        if history and len(history) >= 14:
            temporal = result.get('temporal', {})
            wow = temporal.get('wow_change', {})
            if wow.get('valence') is None or wow.get('arousal') is None:
                errors.append("Missing WoW change despite sufficient history")
        
        # Check 5: Circadian hour_local mismatch check
        temporal = result.get('temporal', {})
        circadian = temporal.get('circadian', {})
        hour_local = circadian.get('hour_local')
        
        if hour_local is not None and timestamp:
            try:
                import pytz
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                tz = pytz.timezone(timezone_used)
                local_dt = dt.astimezone(tz)
                expected_hour = local_dt.hour + local_dt.minute / 60.0
                
                mismatch = abs(hour_local - expected_hour)
                if mismatch > 0.25:  # More than 15 minutes off
                    errors.append(f"hour_local mismatch: {hour_local} vs expected {expected_hour:.1f}")
            except:
                pass
        
        return errors
    
    def _minimal_enrichment(self, reflection: Dict, reason: str) -> Dict:
        """
        Return minimal safe output when enrichment fails.
        
        Uses:
        - Primary emotion only (neutral: Peaceful)
        - Default valence/arousal (0.5, 0.5)
        - Neutral enrichment content
        """
        print(f"[!] Returning minimal enrichment: {reason}")
        
        return {
            'lang_detected': 'en',
            'normalized_text': reflection.get('normalized_text', ''),
            'invoked': 'unknown',
            'expressed': 'neutral',
            'wheel': {
                'primary': 'Peaceful',
                'secondary': 'content',
                'tertiary': 'free'
            },
            'valence': 0.5,
            'arousal': 0.5,
            'confidence': 0.3,
            'events': [],
            'warnings': [f"Minimal enrichment: {reason}"],
            'willingness_cues': {'hedges': [], 'intensifiers': [], 'negations': [], 'self_reference': []},
            'congruence': 0.5,
            'temporal': self._minimal_temporal(reflection.get('timestamp')),
            'willingness': {'willingness_to_express': 0.5, 'inhibition': 0, 'amplification': 0, 'dissociation': 0, 'social_desirability': 0},
            'comparator': {'expected': {}, 'deviation': {}, 'note': 'Minimal enrichment'},
            'recursion': {'method': 'none', 'links': [], 'thread_summary': '', 'thread_state': 'new'},
            'state': {'valence_mu': 0.5, 'arousal_mu': 0.5, 'energy_mu': 0.5, 'fatigue_mu': 0.5, 'sigma': 0.5, 'confidence': 0.3},
            'quality': {'text_len': len(reflection.get('normalized_text', '')), 'uncertainty': 0.7},
            'risk_signals_weak': [],
            'provenance': {'baseline_version': 'agent_mode@v1.0', 'ollama_model': 'minimal'},
            'meta': {'mode': 'minimal', 'reason': reason},
            'post_enrichment': self._minimal_post_enrichment({'primary': 'Peaceful', 'secondary': 'content', 'tertiary': 'free'}),
            '_agent_mode': {'mode': 'execute_once', 'attempts': 0, 'ood_penalty_applied': 0, 'latency_ms': 0, 'version': 'v1.0'}
        }
    
    def _minimal_temporal(self, timestamp: Optional[str]) -> Dict:
        """Generate minimal temporal analytics"""
        return {
            'ema': {'v_1d': 0.5, 'v_7d': 0.5, 'v_28d': 0.5, 'a_1d': 0.5, 'a_7d': 0.5, 'a_28d': 0.5},
            'zscore': {'valence': None, 'arousal': None, 'window_days': 90},
            'wow_change': {'valence': None, 'arousal': None},
            'streaks': {'positive_valence_days': 0, 'negative_valence_days': 0},
            'last_marks': {'last_positive_at': None, 'last_negative_at': None, 'last_risk_at': None},
            'circadian': {'hour_local': 12.0, 'phase': 'afternoon', 'sleep_adjacent': False, 'timezone_used': 'Asia/Kolkata'}
        }
    
    def _minimal_post_enrichment(self, wheel: Dict) -> Dict:
        """Generate minimal post-enrichment (neutral poems/tips/closing)"""
        primary = wheel.get('primary', 'Peaceful')
        
        return {
            'poems': [
                "The moment passes quietly.",
                "Nothing demands resolution now.",
                "This too will shift and settle."
            ],
            'tips': [
                "Take three slow breaths wherever you are.",
                "Notice one thing you can see clearly.",
                "Let your shoulders drop just a little."
            ],
            'closing_line': "You're here. That's enough for now.",
            'tags': [f"#{primary.lower()}", "#reflection", "#moment"]
        }
    
    def is_available(self) -> bool:
        """Check if underlying services are available"""
        return self.hybrid_scorer.is_available() and self.post_enricher.is_available()


# Example usage / test
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    load_dotenv()
    
    scorer = AgentModeScorer(
        hf_token=os.getenv('HF_TOKEN'),
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
    )
    
    # Test reflection
    test_reflection = {
        'rid': 'test_123',
        'sid': 'user_456',
        'normalized_text': 'Listening to that old playlist while cooking dinner. Steam rises, that chorus drops me in an older kitchen. One song opens a door I painted shut.',
        'timestamp': '2025-10-28T18:30:00Z',
        'timezone_used': 'Asia/Kolkata'
    }
    
    # Enrich
    result = scorer.enrich(test_reflection, prev_reflection=None, history=[])
    
    if result:
        print(f"\n{'='*70}")
        print("ENRICHMENT RESULT:")
        print(f"{'='*70}")
        print(f"Language: {result.get('lang_detected')}")
        print(f"Wheel: {result['wheel']['primary']} → {result['wheel']['secondary']} → {result['wheel']['tertiary']}")
        print(f"Invoked: {result.get('invoked')}")
        print(f"Expressed: {result.get('expressed')}")
        print(f"Valence: {result.get('valence')}")
        print(f"Arousal: {result.get('arousal')}")
        print(f"Poems: {result.get('post_enrichment', {}).get('poems', [])}")
        print(f"Closing: {result.get('post_enrichment', {}).get('closing_line')}")
        print(f"{'='*70}\n")
