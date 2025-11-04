"""
Stage-2 Post-Enrichment Module
================================
Calls Ollama to generate creative user-facing content from hybrid enrichment.
OR matches pre-generated content based on emotion + context.
"""

import requests
import json
import re
from typing import Dict, Optional, List
from pathlib import Path
import sys
import os
import signal
from contextlib import contextmanager

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from prompts.stage2_prompt import STAGE2_SYSTEM_PROMPT
from prompts.pig_window_prompt import generate_pig_window_prompt
from utils.reliable_fields import pick_reliable_fields


class TimeoutException(Exception):
    pass


@contextmanager
def time_limit(seconds):
    """Context manager for hard timeout using signals (Unix-like systems)"""
    def signal_handler(signum, frame):
        raise TimeoutException("Timed out!")
    
    # Try to use signal-based timeout (doesn't work on Windows)
    try:
        signal.signal(signal.SIGALRM, signal_handler)
        signal.alarm(seconds)
        try:
            yield
        finally:
            signal.alarm(0)
    except AttributeError:
        # Windows doesn't have SIGALRM, just use requests timeout
        yield


def cosine_similarity(text1: str, text2: str) -> float:
    """
    Simple word-overlap based similarity (0-1).
    For production, use sentence-transformers embeddings.
    
    Args:
        text1: First text
        text2: Second text
    
    Returns:
        Similarity score 0-1
    """
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    if not words1 or not words2:
        return 0.0
    
    intersection = words1 & words2
    union = words1 | words2
    
    return len(intersection) / len(union) if union else 0.0


def get_circadian_prompt_additions(phase: str) -> str:
    """
    E4: Generate phase-specific guidance for Ollama to avoid time-inappropriate suggestions
    
    Args:
        phase: 'morning', 'afternoon', 'evening', or 'night'
    
    Returns:
        Additional prompt text with phase-specific constraints and examples
    """
    if phase == 'morning':
        return """
CIRCADIAN CONTEXT: MORNING (6am-12pm)
- User is likely waking up, starting their day, or mid-morning
- PREFER: morning-compatible actions (chai at window, fresh air, walk/commute reflection, light planning)
- AVOID: night language ("tonight", "rest now", "sleep", "dim lights", "wind down")
- Closing line examples: "carry this lightness into the day. See you tomorrow." / "the morning holds space for this feeling. See you tomorrow."
"""
    elif phase == 'afternoon':
        return """
CIRCADIAN CONTEXT: AFTERNOON (12pm-5pm)
- User is mid-day, possibly at work/study, lunch break, or afternoon lull
- PREFER: afternoon actions (chai break, step outside, quick pause, brief walk)
- AVOID: morning language ("sunrise", "start of day") AND night language ("tonight", "rest now", "sleep")
- Closing line examples: "the afternoon carries this quietly. See you tomorrow." / "let the day unfold at its own pace. See you tomorrow."
"""
    elif phase == 'evening':
        return """
CIRCADIAN CONTEXT: EVENING (5pm-9pm)
- User is transitioning from day, possibly commuting home, winding down work
- PREFER: evening actions (walk/terrace visit, music, dim chai, reflection before night)
- AVOID: morning language ("sunrise", "start fresh") AND deep night language ("sleep", "bed")
- Closing line examples: "let the evening hold this gently. See you tomorrow." / "the day's weight can settle now. See you tomorrow."
"""
    else:  # night
        return """
CIRCADIAN CONTEXT: NIGHT (9pm-6am)
- User is late evening or nighttime, possibly preparing for sleep or awake late
- PREFER: night-compatible actions (lying down, dim lights, quiet music, journaling before sleep, rest)
- AVOID: morning language ("sunrise yoga", "fresh start", "morning walk", "wake up early")
- AVOID: high-energy suggestions (exercise, planning, social activities)
- Closing line examples: "rest now—nothing needs solving tonight. See you tomorrow." / "let tonight's weight settle where it will. See you tomorrow."
"""


class PostEnricher:
    """
    Stage-2 post-processor using pre-generated content DB or Ollama fallback.
    """
    
    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:latest",
        temperature: float = 0.8,
        timeout: int = 360,  # 6 minutes for CPU inference (no GPU acceleration available)
        use_pregenerated: bool = True
    ):
        """
        Args:
            ollama_base_url: Ollama server URL
            ollama_model: Model name (phi3:latest recommended)
            temperature: Sampling temperature (0.7-0.9 for creativity)
            timeout: Request timeout in seconds
            use_pregenerated: If True, use pre-generated content database (FAST)
        """
        self.ollama_base_url = ollama_base_url.rstrip('/')
        self.ollama_model = ollama_model
        self.temperature = temperature
        self.timeout = timeout
        self.use_pregenerated = use_pregenerated
        
        # Load pre-generated content database
        self.pregenerated_db = []
        if use_pregenerated:
            try:
                db_path = Path(__file__).parent.parent / "data" / "post_enrichment_db.json"
                if db_path.exists():
                    with open(db_path, 'r', encoding='utf-8') as f:
                        self.pregenerated_db = json.load(f)
                    print(f"[*] Loaded {len(self.pregenerated_db)} pre-generated post-enrichment entries")
                else:
                    print(f"[!] Pre-generated DB not found at {db_path}, will use Ollama fallback")
                    self.use_pregenerated = False
            except Exception as e:
                print(f"[!] Failed to load pre-generated DB: {e}, will use Ollama fallback")
                self.use_pregenerated = False
        
        print(f"[*] PostEnricher initialized")
        print(f"   Model: {ollama_model}")
        print(f"   Temperature: {temperature}")
        print(f"   Mode: {'Pre-generated DB' if self.use_pregenerated else 'Ollama generation'}")
    
    def is_available(self) -> bool:
        """Check if Ollama is reachable"""
        try:
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def _extract_context(self, text: str) -> str:
        """
        Extract 1-2 word context from the reflection text using Ollama.
        Examples: "work", "relationship", "family", "loss", "achievement", "conflict"
        
        Args:
            text: Normalized reflection text
        
        Returns:
            1-2 word context descriptor
        """
        try:
            prompt = f"""Extract the primary situational context from this reflection in 1-2 words ONLY.

Examples:
- "My boss criticized my presentation today" → "work"
- "Had a fight with my partner about money" → "relationship"
- "Mom's health is getting worse" → "family"
- "Lost my job after 5 years" → "loss"
- "Finally finished my thesis!" → "achievement"
- "Friend didn't show up again" → "friendship"
- "Stuck in traffic for 2 hours" → "commute"

Reflection: {text}

Context (1-2 words only):"""

            payload = {
                "model": self.ollama_model,
                "prompt": prompt,
                "options": {
                    "temperature": 0.1,  # Low temperature for consistency
                    "num_predict": 3,  # Only need 1-2 words
                    "num_thread": 2  # Light CPU usage
                },
                "stream": False
            }
            
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=payload,
                timeout=30  # INCREASED from 10s - CPU is slow
            )
            
            if response.status_code == 200:
                data = response.json()
                context = data.get('response', '').strip().lower()
                # Clean up response (remove quotes, periods, etc.)
                context = context.replace('"', '').replace("'", '').replace('.', '').strip()
                # Take first 2 words max
                words = context.split()[:2]
                return ' '.join(words) if words else 'moment'
            else:
                return 'moment'  # Fallback
                
        except Exception as e:
            print(f"   [!] Context extraction failed: {e}, using fallback")
            return 'moment'  # Fallback
    
    def _generate_pig_window(self, headline: str, primary: str, secondary: str) -> Optional[Dict]:
        """
        Generate Pig-Window poetic dialogue using Phi3 mini.
        Format: Pig→Window→Pig→Window→Pig→Window (6 lines alternating)
        
        Args:
            headline: Event context/headline
            primary: Primary emotion
            secondary: Secondary emotion
        
        Returns:
            Dict with {'poems': [3 Pig lines], 'tips': [3 Window lines]} or None if failed
        """
        try:
            prompt = generate_pig_window_prompt(headline, primary, secondary)
            
            payload = {
                "model": "phi3:mini",
                "prompt": prompt,
                "options": {
                    "temperature": 0.8,  # Higher for creativity
                    "top_p": 0.9,
                    "num_predict": 200,  # ~6 lines
                    "num_ctx": 1024
                },
                "stream": False
            }
            
            print(f"   [PIG-WINDOW] Generating dialogue for {primary}→{secondary}...")
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=payload,
                timeout=120  # 2 min timeout as requested
            )
            
            if response.status_code != 200:
                print(f"   [!] Pig-Window generation failed: HTTP {response.status_code}")
                return None
            
            result = response.json()
            content = result.get('response', '').strip()
            
            # Parse the 6 alternating lines
            lines = [line.strip() for line in content.split('\n') if line.strip()]
            
            pig_lines = []
            window_lines = []
            
            for line in lines:
                if line.startswith('Pig:'):
                    pig_lines.append(line[4:].strip())
                elif line.startswith('Window:'):
                    window_lines.append(line[7:].strip())
            
            # Validate format (should be 3 Pig + 3 Window = 6 total, alternating)
            if len(pig_lines) != 3 or len(window_lines) != 3:
                print(f"   [!] Invalid Pig-Window format: {len(pig_lines)} Pig, {len(window_lines)} Window")
                print(f"   [DEBUG] Content: {content[:200]}")
                return None
            
            print(f"   [✓] Pig-Window generated: 3 inner voice + 3 micro-rituals")
            return {
                'poems': pig_lines,  # Pig lines → poems
                'tips': window_lines  # Window lines → tips
            }
            
        except Exception as e:
            print(f"   [!] Pig-Window generation error: {e}")
            return None
    
    def _match_pregenerated_content(self, primary: str, secondary: str, tertiary: str, context) -> Optional[Dict]:
        """
        Match pre-generated content based on exact emotion combination + context similarity.
        
        Args:
            primary: Primary emotion (e.g., "scared", "mad", "sad")
            secondary: Secondary emotion (e.g., "anxious", "frustrated")
            tertiary: Tertiary emotion (e.g., "worried", "annoyed")
            context: Context from Stage 1 - can be string (legacy) or Dict (new 4-field)
        
        Returns:
            Matched post_enrichment dict or None if no match
        """
        if not self.pregenerated_db:
            return None
        
        # Normalize inputs
        primary = primary.lower().strip()
        secondary = secondary.lower().strip()
        tertiary = tertiary.lower().strip()
        
        # Convert context to string for similarity matching
        if isinstance(context, dict):
            # New 4-field format: combine domain + headline for matching
            context_str = f"{context.get('event_domain', 'self')} {context.get('event_headline', 'moment')}"
        else:
            # Legacy 3-word string format
            context_str = str(context).lower().strip() if context else ""
        
        context_str = context_str.lower().strip()
        
        print(f"   [MATCH] Looking for: {primary} → {secondary} → {tertiary}, context='{context_str}'")
        
        # First pass: Exact emotion match
        exact_matches = []
        for entry in self.pregenerated_db:
            if (entry.get('primary', '').lower() == primary and
                entry.get('secondary', '').lower() == secondary and
                entry.get('tertiary', '').lower() == tertiary):
                exact_matches.append(entry)
        
        if not exact_matches:
            print(f"   [!] No exact emotion match found in database")
            return None
        
        print(f"   [OK] Found {len(exact_matches)} exact emotion matches")
        
        # Second pass: Find best context match
        if context_str:
            best_match = None
            best_score = 0.0
            
            for entry in exact_matches:
                entry_context = entry.get('context', '').lower()
                score = cosine_similarity(context_str, entry_context)
                if score > best_score:
                    best_score = score
                    best_match = entry
            
            if best_match:
                print(f"   [MATCHED] Best context: '{best_match.get('context')}' (similarity={best_score:.2f})")
                return best_match.get('post_enrichment')
        
        # Fallback: Return first exact emotion match
        print(f"   [FALLBACK] Using first exact emotion match")
        return exact_matches[0].get('post_enrichment')
    
    def enrich(self, reflection: Dict, raw_text: str, normalized_text: str, circadian_phase: str) -> Dict:
        """
        Compatibility wrapper for enrichment_dispatcher.
        Converts dispatcher's interface to run_post_enrichment's interface.
        
        Args:
            reflection: Full reflection dict (contains hybrid_result data)
            raw_text: Original user text (unused, for compatibility)
            normalized_text: Cleaned text (unused, for compatibility)
            circadian_phase: Time of day (unused, for compatibility)
        
        Returns:
            Enriched reflection dict
        """
        # reflection already contains the hybrid_result data
        # Just run post-enrichment on it
        return self.run_post_enrichment(reflection)
    
    def run_post_enrichment(self, hybrid_result: Dict) -> Dict:
        """
        Run Stage-2 post-enrichment on hybrid scorer output.
        
        Args:
            hybrid_result: Full JSON from hybrid_scorer.enrich()
        
        Returns:
            Same dict with added post_enrichment field and status="complete"
        """
        print(f"\n[*] Stage-2: Post-Enrichment Pipeline")
        
        # Skip if already post-enriched
        if 'post_enrichment' in hybrid_result:
            print(f"   [!]  Already post-enriched, skipping")
            return hybrid_result
        
        # Try to use cache
        try:
            import sys
            from pathlib import Path
            sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))
            from infra.cache import get_cache
            from infra.metrics import timer
            
            cache = get_cache()
            
            # Build cache key from wheel emotions + invoked
            wheel = hybrid_result.get('wheel', {})
            cache_key_content = {
                "primary": wheel.get('primary'),
                "secondary": wheel.get('secondary'),
                "tertiary": wheel.get('tertiary'),
                "invoked": hybrid_result.get('invoked')
            }
            
            # Check cache
            if cache.enabled:
                cached = cache.get(
                    content=cache_key_content,
                    cache_type="stage2_enrichment"
                )
                if cached:
                    print(f"[CACHE HIT] Stage 2: {wheel.get('primary')}/{wheel.get('secondary')} → cached")
                    # Merge cached result
                    hybrid_result['post_enrichment'] = cached['post_enrichment']
                    hybrid_result['status'] = 'complete'
                    return hybrid_result
            
            # Execute with timing
            with timer("stage2_enrichment"):
                result = self._run_post_enrichment_impl(hybrid_result)
            
            # Cache just the post_enrichment part
            if cache.enabled and result.get('post_enrichment'):
                cache.set(
                    content=cache_key_content,
                    value={"post_enrichment": result['post_enrichment']},
                    ttl=2592000,  # 30 days
                    cache_type="stage2_enrichment"
                )
                print(f"[CACHE MISS] Stage 2: {wheel.get('primary')}/{wheel.get('secondary')} → generated & cached")
            
            return result
            
        except ImportError:
            # Cache not available
            return self._run_post_enrichment_impl(hybrid_result)
    
    def _run_post_enrichment_impl(self, hybrid_result: Dict) -> Dict:
        """Internal implementation of run_post_enrichment (separated for caching)"""
        
        try:
            # Extract wheel emotions and context from Stage 1
            wheel = hybrid_result.get('wheel', {})
            primary = wheel.get('primary', '').lower()
            secondary = wheel.get('secondary', '').lower()
            tertiary = wheel.get('tertiary', '').lower()
            
            # Get context from meta (extracted in Stage 1)
            context = hybrid_result.get('meta', {}).get('context', '')
            
            print(f"   [EMOTIONS] {primary} → {secondary} → {tertiary}")
            print(f"   [CONTEXT] '{context}'")
            print(f"   [DB STATUS] use_pregenerated={self.use_pregenerated}, db_entries={len(self.pregenerated_db)}")
            
            # DEBUG: Show what we're looking for
            if not primary:
                print(f"   [DEBUG] wheel dict: {wheel}")
                print(f"   [DEBUG] meta dict: {hybrid_result.get('meta', {})}")
            
            # Try to match pre-generated content first
            if self.use_pregenerated and primary and secondary and tertiary:
                print(f"   [MATCHING] Attempting to match pre-generated content...")
                matched_content = self._match_pregenerated_content(primary, secondary, tertiary, context)
                
                if matched_content:
                    print(f"   [✓] Using pre-generated content (FAST)")
                    hybrid_result['post_enrichment'] = matched_content
                    hybrid_result['status'] = 'complete'
                    return hybrid_result
                else:
                    print(f"   [!] No pre-generated match, falling back to Ollama generation")
            else:
                if not self.use_pregenerated:
                    print(f"   [!] Pre-generated DB disabled, using Ollama")
                elif not primary or not secondary or not tertiary:
                    print(f"   [!] Missing emotions (p={primary}, s={secondary}, t={tertiary}), using Ollama")
            
            # Fallback to Ollama generation
            print(f"   [OLLAMA] Generating creative content...")
            
            # Extract reliable fields only
            print(f"   [1/4] Extracting reliable fields...")
            reliable = pick_reliable_fields(hybrid_result)
            
            # E4: Extract circadian phase for phase-aware prompting
            circadian_phase = hybrid_result.get('temporal', {}).get('circadian', {}).get('phase', 'afternoon')
            hour_local = hybrid_result.get('temporal', {}).get('circadian', {}).get('hour_local', 12.0)
            
            # NEW: Extract context from the moment (1-2 words)
            print(f"   [2/4] Extracting moment context...")
            ollama_context = self._extract_context(reliable['normalized_text'])
            print(f"      Context: '{ollama_context}'")
            
            # NEW: Generate Pig-Window dialogue
            print(f"   [2.5/4] Generating Pig-Window dialogue...")
            pig_window = self._generate_pig_window(
                context if isinstance(context, str) else context.get('event_headline', 'moment'),
                reliable['wheel']['primary'],
                reliable['wheel']['secondary']
            )
            if pig_window:
                print(f"      ✓ {len(pig_window['poems'])} Pig lines (→poems), {len(pig_window['tips'])} Window lines (→tips)")
                # Use Pig-Window as poems and tips instead of generating with Ollama
                use_pig_window = True
            else:
                print(f"      ✗ Pig-Window generation failed, will use Ollama for poems/tips")
                use_pig_window = False
            
            print(f"   [3/4] Generating poems + tips...")
            print(f"      Input: {reliable['normalized_text'][:60]}...")
            
            # E4: Build circadian-aware system prompt
            circadian_addition = get_circadian_prompt_additions(circadian_phase)
            phase_aware_prompt = STAGE2_SYSTEM_PROMPT + circadian_addition
            
            # Add context to reliable fields for prompt
            reliable_with_context = {**reliable, 'moment_context': context}
            
            # Build prompt
            full_prompt = f"{phase_aware_prompt}\n\nHYBRID_RESULT:\n{json.dumps(reliable_with_context, indent=2)}\n\nGenerate the post_enrichment JSON:"
            
            # Try Ollama first (with short timeout), fallback to HF API if it fails/times out
            content = None
            ollama_failed = False
            
            try:
                print(f"   [DEBUG] Trying Ollama ({self.ollama_model}) with 60s timeout...")
                
                payload = {
                    "model": self.ollama_model,
                    "prompt": full_prompt,
                    "options": {
                        "temperature": self.temperature,
                        "top_p": 0.9,
                        "repeat_penalty": 1.05,
                        "num_predict": 512,
                        "num_ctx": 2048,
                        "num_thread": 2
                    },
                    "stream": False
                }
                
                # Use SHORT timeout (60s) - if Ollama can't do it quickly, fallback to HF
                response = requests.post(
                    f"{self.ollama_base_url}/api/generate",
                    json=payload,
                    timeout=60  # Short timeout for Ollama attempt
                )
                
                if response.status_code == 200:
                    result = response.json()
                    content = result.get('response', '')
                    print(f"   [DEBUG] ✓ Ollama succeeded!")
                else:
                    print(f"   [DEBUG] ✗ Ollama returned HTTP {response.status_code}, falling back to HF API")
                    ollama_failed = True
                        
            except (requests.Timeout, requests.ConnectionError) as e:
                print(f"   [DEBUG] ✗ Ollama timeout/error ({type(e).__name__}), falling back to HF API")
                ollama_failed = True
            except Exception as e:
                print(f"   [DEBUG] ✗ Ollama error ({e}), falling back to HF API")
                ollama_failed = True
            
            # Fallback to HuggingFace Inference API if Ollama failed
            if ollama_failed or not content:
                print(f"   [DEBUG] Using HuggingFace API (Qwen/Qwen2.5-3B-Instruct)...")
                
                hf_token = os.getenv('HF_TOKEN')
                if not hf_token:
                    raise RuntimeError("HF_TOKEN not set, cannot fallback to HF API")
                
                hf_response = requests.post(
                    "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-3B-Instruct",
                    headers={"Authorization": f"Bearer {hf_token}"},
                    json={
                        "inputs": full_prompt,
                        "parameters": {
                            "max_new_tokens": 512,
                            "temperature": self.temperature,
                            "top_p": 0.9,
                            "return_full_text": False
                        }
                    },
                    timeout=30  # HF API is fast
                )
                
                if hf_response.status_code == 200:
                    hf_result = hf_response.json()
                    if isinstance(hf_result, list) and len(hf_result) > 0:
                        content = hf_result[0].get('generated_text', '')
                        print(f"   [DEBUG] ✓ HF API succeeded!")
                    else:
                        raise RuntimeError(f"Unexpected HF API response format: {hf_result}")
                else:
                    raise RuntimeError(f"HF API error: {hf_response.status_code} - {hf_response.text}")
            
            # Check we got content from either Ollama or HF API
            if not content:
                raise RuntimeError("Empty response from both Ollama and HF API")
            
            print(f"   [4/4] Parsing response...")
            print(f"   [DEBUG] Content preview: {content[:200]}...")
            
            # Parse JSON with fallback
            parsed = self._safe_parse_json(content)
            
            if not parsed or 'post_enrichment' not in parsed:
                raise RuntimeError("Missing post_enrichment in response")
            
            # Add context to the post_enrichment output
            parsed['post_enrichment']['context'] = context
            
            # Replace poems/tips with Pig-Window dialogue if available
            if pig_window:
                print(f"   [✓] Using Pig-Window for poems/tips (overriding Ollama generation)")
                parsed['post_enrichment']['poems'] = pig_window['poems']
                parsed['post_enrichment']['tips'] = pig_window['tips']
            
            # Validate schema
            self._validate_schema(parsed['post_enrichment'])
            
            # Validate we have exactly 3 poems
            poems = parsed['post_enrichment']['poems']
            if len(poems) != 3:
                print(f"[!]  Expected 3 poems, got {len(poems)}, padding with fallback")
                while len(poems) < 3:
                    poems.append("...")
                poems = poems[:3]  # Trim if more than 3
                parsed['post_enrichment']['poems'] = poems
            
            # Dedup check: ensure closing_line is different from poems
            closing_line = parsed['post_enrichment']['closing_line']
            closing_text = closing_line.replace("See you tomorrow.", "").strip().lower()
            
            max_similarity = 0.0
            for poem in poems:
                sim = cosine_similarity(closing_text, poem)
                max_similarity = max(max_similarity, sim)
            
            if max_similarity > 0.75:
                print(f"[!]  Closing line too similar to poems (sim={max_similarity:.2f}), regenerating...")
                # Regenerate closing line with penalty
                new_closing = self._regenerate_closing_line(
                    reliable,
                    poems,
                    reliable.get('normalized_text', '')
                )
                if new_closing:
                    parsed['post_enrichment']['closing_line'] = new_closing
                    print(f"   ✓ Regenerated: {new_closing}")
            
            # Merge into hybrid result
            hybrid_result['post_enrichment'] = parsed['post_enrichment']
            hybrid_result['status'] = 'complete'
            
            print(f"[OK] Stage-2 complete")
            print(f"   Poems: {len(parsed['post_enrichment']['poems'])}")
            print(f"   Tips: {len(parsed['post_enrichment']['tips'])}")
            print(f"   Style: {parsed['post_enrichment']['style']}")
            
            return hybrid_result
            
        except requests.Timeout:
            print(f"[X] Timeout during Stage 2 generation")
            # Add fallback empty post_enrichment
            hybrid_result['post_enrichment'] = self._fallback_response(reliable)
            hybrid_result['status'] = 'complete_with_fallback'
            return hybrid_result
            
        except Exception as e:
            print(f"[X] Post-enrichment error: {type(e).__name__}: {e}")
            hybrid_result['post_enrichment'] = self._fallback_response(reliable)
            hybrid_result['status'] = 'complete_with_fallback'
            return hybrid_result
    
    def _safe_parse_json(self, content: str) -> Optional[Dict]:
        """
        Parse JSON with fallback extraction.
        
        Args:
            content: Response text from Ollama
        
        Returns:
            Parsed dict or None
        """
        # Try direct parse
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Try extracting JSON block (find complete object with balanced braces)
        try:
            # Find first { and count braces to find matching }
            start = content.find('{')
            if start != -1:
                brace_count = 0
                for i in range(start, len(content)):
                    if content[i] == '{':
                        brace_count += 1
                    elif content[i] == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            # Found matching closing brace
                            json_str = content[start:i+1]
                            return json.loads(json_str)
        except Exception as e:
            print(f"[!]  JSON extraction failed: {e}")
        
        # Try stripping whitespace and trying again
        try:
            stripped = content.strip()
            return json.loads(stripped)
        except:
            pass
        
        print(f"[!]  Failed to parse JSON from: {content[:200]}...")
        return None
    
    def _split_single_poem(self, poem: str) -> str:
        """
        Split a single-line poem into two lines at a natural break point.
        
        Args:
            poem: Single line poem without comma
        
        Returns:
            Poem with comma separator added
        """
        words = poem.split()
        
        # REMOVED: _split_single_poem and _normalize_poems
        # Now expecting 3 separate poems directly from Ollama (no comma splitting)
    
    def _validate_schema(self, post_enrichment: Dict):
        """
        Validate post_enrichment schema.
        
        Raises:
            ValueError if schema invalid
        """
        required_keys = ['poems', 'tips', 'style', 'closing_line', 'tags']
        for key in required_keys:
            if key not in post_enrichment:
                raise ValueError(f"Missing required key: {key}")
        
        poems = post_enrichment['poems']
        tips = post_enrichment['tips']
        tags = post_enrichment['tags']
        
        if not isinstance(poems, list) or len(poems) != 3:
            raise ValueError("poems must be list with exactly 3 items")
        
        if not isinstance(tips, list) or len(tips) != 3:
            raise ValueError("tips must be list with exactly 3 items")
        
        if not isinstance(tags, list) or len(tags) != 3:
            raise ValueError("tags must be list with exactly 3 items")
        
        closing = post_enrichment['closing_line']
        if not closing.endswith("See you tomorrow."):
            raise ValueError("closing_line must end with 'See you tomorrow.'")
    
    def _regenerate_closing_line(
        self,
        reliable: Dict,
        poems: List[str],
        user_text: str
    ) -> Optional[str]:
        """
        Regenerate closing line with guardrails against poem repetition.
        
        Args:
            reliable: Reliable fields dict
            poems: List of existing poems
            user_text: User's original reflection text
        
        Returns:
            New closing line or None if failed
        """
        # Extract poem tokens to penalize
        poem_words = set()
        for poem in poems:
            poem_words.update(poem.lower().split())
        
        # Remove common words
        common_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'}
        penalize_words = list(poem_words - common_words)[:20]  # Top 20 non-common words
        
        prompt = f"""You are the City's soft voice. Generate a SINGLE, ORIGINAL closing line for this moment.

DATA:
- primary: {reliable['wheel']['primary']}
- secondary: {reliable['wheel']['secondary'] or ''}
- tertiary: {reliable['wheel']['tertiary'] or ''}
- invoked: {reliable['invoked'][:3] if reliable['invoked'] else []}
- expressed: {reliable['expressed'][:3] if reliable['expressed'] else []}
- valence: {reliable.get('valence', 0.5):.2f} (0=negative, 1=positive)
- arousal: {reliable.get('arousal', 0.5):.2f} (0=calm, 1=energized)

EXISTING POEMS (DO NOT REPEAT THESE):
{chr(10).join(f'- "{p}"' for p in poems)}

AVOID THESE WORDS: {', '.join(penalize_words[:10])}

RULES:
- NEVER copy, paraphrase, or summarize the user's reflection
- NEVER use "you felt" / "you experienced" / "you expressed"
- ONE sentence, 8-18 words, ending with "See you tomorrow."
- Use the wheel emotions (primary/secondary/tertiary) and drivers (invoked/expressed) metaphorically
- Address the feeling as a presence ("it", "tonight", "this moment")
- Warm, witnessing tone—not advice or analysis
- Always lowercase except "See"
- Respond TO the emotion, not ABOUT it

EXAMPLES (for inspiration, do not copy):
- Sad/ashamed/humiliated + hurt → "wounds speak their own language at night. See you tomorrow."
- Powerful/proud/confident + achievement → "pocket that light for harder days. See you tomorrow."
- Mad/frustrated/annoyed + disappointment → "your shoulders can drop now. See you tomorrow."
- Scared/anxious/worried + uncertainty → "not every knot untangles in one night. See you tomorrow."

Return ONLY the closing line, nothing else."""

        try:
            payload = {
                "model": self.ollama_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.75,
                    "top_p": 0.9,
                    "num_predict": 60,
                    "num_thread": 8,  # Use all CPU cores
                    "stop": ["\n\n", "Note:", "Explanation:"]
                },
                "keep_alive": "30m"  # Keep model loaded
            }
            
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=payload,
                timeout=120  # Increased from 30s - CPU inference needs more time
            )
            
            if response.status_code != 200:
                return None
            
            result = response.json()
            new_line = result.get('response', '').strip()
            
            # Validate format
            if not new_line.endswith("See you tomorrow."):
                new_line = new_line.rstrip('.') + ". See you tomorrow."
            
            # Check length
            words = new_line.replace("See you tomorrow.", "").strip().split()
            if len(words) < 8:
                return None
            
            return new_line
            
        except Exception as e:
            print(f"[!]  Failed to regenerate closing line: {e}")
            return None
    
    def _fallback_response(self, reliable: Dict) -> Dict:
        """
        Generate fallback post_enrichment when Ollama fails.
        
        Args:
            reliable: Reliable fields dict
        
        Returns:
            Minimal valid post_enrichment with exactly 3 poems
        """
        primary = reliable['wheel']['primary'] or 'Peaceful'
        invoked_0 = reliable['invoked'][0] if reliable['invoked'] else 'reflection'
        expressed_0 = reliable['expressed'][0] if reliable['expressed'] else 'calm'
        
        return {
            "poems": [
                "something shifted today, quiet but real",
                "you noticed it, that counts for something",
                "hold this moment, even if it's small"
            ],
            "tips": [
                "Take a short walk, let your mind wander",
                "Share this with someone you trust",
                "Check in with yourself tomorrow, same time"
            ],
            "style": {
                "voice": "grounded",
                "tempo": "mid"
            },
            "closing_line": "you showed up for yourself today. See you tomorrow.",
            "tags": [f"#{primary}", f"#{invoked_0}", f"#{expressed_0}"]
        }
