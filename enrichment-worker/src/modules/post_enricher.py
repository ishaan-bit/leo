"""
Stage-2 Post-Enrichment Module
================================
Calls Ollama to generate creative user-facing content from hybrid enrichment.
"""

import requests
import json
import re
from typing import Dict, Optional
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from prompts.stage2_prompt import STAGE2_SYSTEM_PROMPT
from utils.reliable_fields import pick_reliable_fields


class PostEnricher:
    """
    Stage-2 post-processor using Ollama for creative content generation.
    """
    
    def __init__(
        self,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:latest",
        temperature: float = 0.8,
        timeout: int = 120  # 2 minutes for creative generation
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
        
        print(f"🎨 PostEnricher initialized")
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
        print(f"\n🎨 Stage-2: Post-Enrichment Pipeline")
        
        # Skip if already post-enriched
        if 'post_enrichment' in hybrid_result:
            print(f"   ⚠️  Already post-enriched, skipping")
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
                    "repeat_penalty": 1.05
                },
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
            
            # Merge into hybrid result
            hybrid_result['post_enrichment'] = parsed['post_enrichment']
            hybrid_result['status'] = 'complete'
            
            print(f"✅ Stage-2 complete")
            print(f"   Poems: {len(parsed['post_enrichment']['poems'])}")
            print(f"   Tips: {len(parsed['post_enrichment']['tips'])}")
            print(f"   Style: {parsed['post_enrichment']['style']}")
            
            return hybrid_result
            
        except requests.Timeout:
            print(f"❌ Ollama timeout after {self.timeout}s")
            # Add fallback empty post_enrichment
            hybrid_result['post_enrichment'] = self._fallback_response(reliable)
            hybrid_result['status'] = 'complete_with_fallback'
            return hybrid_result
            
        except Exception as e:
            print(f"❌ Post-enrichment error: {type(e).__name__}: {e}")
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
        
        # Try extracting JSON block
        try:
            # Find first { to last }
            match = re.search(r'\{[\s\S]*\}', content)
            if match:
                return json.loads(match.group(0))
        except:
            pass
        
        print(f"⚠️  Failed to parse JSON from: {content[:200]}...")
        return None
    
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
        
        if not isinstance(poems, list) or len(poems) < 2:
            raise ValueError("poems must be list with ≥2 items")
        
        if not isinstance(tips, list) or len(tips) != 3:
            raise ValueError("tips must be list with exactly 3 items")
        
        if not isinstance(tags, list) or len(tags) != 3:
            raise ValueError("tags must be list with exactly 3 items")
        
        closing = post_enrichment['closing_line']
        if not closing.endswith("See you tomorrow."):
            raise ValueError("closing_line must end with 'See you tomorrow.'")
    
    def _fallback_response(self, reliable: Dict) -> Dict:
        """
        Generate fallback post_enrichment when Ollama fails.
        
        Args:
            reliable: Reliable fields dict
        
        Returns:
            Minimal valid post_enrichment
        """
        primary = reliable['wheel']['primary'] or 'Peaceful'
        invoked_0 = reliable['invoked'][0] if reliable['invoked'] else 'reflection'
        expressed_0 = reliable['expressed'][0] if reliable['expressed'] else 'calm'
        
        return {
            "poems": [
                "Something shifted today, quiet but real",
                "You noticed it—that counts for something"
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
            "closing_line": f"{reliable['normalized_text']} See you tomorrow.",
            "tags": [f"#{primary}", f"#{invoked_0}", f"#{expressed_0}"]
        }
