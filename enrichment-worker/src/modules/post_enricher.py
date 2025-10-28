"""
Stage-2 Post-Enrichment Module
================================
Calls Ollama to generate creative user-facing content from hybrid enrichment.
"""

import requests
import json
import re
from typing import Dict, Optional, List
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from prompts.stage2_prompt import STAGE2_SYSTEM_PROMPT
from utils.reliable_fields import pick_reliable_fields


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


class PostEnricher:
    """
    Stage-2 post-processor using Ollama for creative content generation.
    """
    
    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:latest",
        temperature: float = 0.8,
        timeout: int = 360  # 6 minutes for CPU inference (no GPU acceleration available)
    ):
        """
        Args:
            ollama_base_url: Ollama server URL
            ollama_model: Model name (phi3:latest recommended)
            temperature: Sampling temperature (0.7-0.9 for creativity)
            timeout: Request timeout in seconds
        """
        self.ollama_base_url = ollama_base_url.rstrip('/')
        self.ollama_model = ollama_model
        self.temperature = temperature
        self.timeout = timeout
        
        print(f"[*] PostEnricher initialized")
        print(f"   Model: {ollama_model}")
        print(f"   Temperature: {temperature}")
    
    def is_available(self) -> bool:
        """Check if Ollama is reachable"""
        try:
            response = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False
    
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
        
        # Extract reliable fields only
        print(f"   [1/3] Extracting reliable fields...")
        reliable = pick_reliable_fields(hybrid_result)
        
        print(f"   [2/3] Calling Ollama ({self.ollama_model})...")
        print(f"      Input: {reliable['normalized_text'][:60]}...")
        
        # Call Ollama
        try:
            payload = {
                "model": self.ollama_model,
                "options": {
                    "temperature": self.temperature,
                    "top_p": 0.9,
                    "repeat_penalty": 1.05,
                    "num_predict": 1024,  # Increased from 600 - need full response for poems+tips+closing
                    "num_ctx": 4096,  # Explicit context window
                    "num_thread": 8  # Use all CPU cores for faster inference
                },
                "keep_alive": "30m",  # Keep model loaded for 30 minutes
                "messages": [
                    {"role": "system", "content": STAGE2_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps({"HYBRID_RESULT": reliable})}
                ],
                "stream": False
            }
            
            response = requests.post(
                f"{self.ollama_base_url}/api/chat",
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                raise RuntimeError(f"Ollama API error: {response.status_code}")
            
            data = response.json()
            content = data.get('message', {}).get('content', '')
            
            if not content:
                raise RuntimeError("Empty response from Ollama")
            
            print(f"   [3/3] Parsing response...")
            
            # Parse JSON with fallback
            parsed = self._safe_parse_json(content)
            
            if not parsed or 'post_enrichment' not in parsed:
                raise RuntimeError("Missing post_enrichment in response")
            
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
            print(f"[X] Ollama timeout after {self.timeout}s")
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
