"""
Ollama Client
Handles phi3 enrichment with JSON-only prompts
"""

import requests
import json
from typing import Optional, Dict
import time


class OllamaClient:
    """Client for Ollama API with phi3 model"""
    
    PROMPT_TEMPLATE = """You enrich a normalized daily reflection. Use ONLY the text below. Return STRICT JSON.

Normalized:
<<<
{normalized_text}
>>>

Respond with EXACTLY this structure:
{{
  "invoked": "short label(s) for internal feeling (e.g., 'fatigue + frustration')",
  "expressed": "short label(s) for outward tone (e.g., 'irritated / deflated')",
  "wheel": {{ 
    "primary": "MUST be ONE of: joy, sadness, anger, fear, trust, disgust, surprise, anticipation",
    "secondary": "MUST be ONE of: joy, sadness, anger, fear, trust, disgust, surprise, anticipation (different from primary)"
  }},
  "valence": 0.5,
  "arousal": 0.5,
  "confidence": 0.75,
  "events": ["fatigue","irritation","low_progress"],
  "warnings": [],
  "willingness_cues": {{
    "hedges": [],
    "intensifiers": [],
    "negations": [],
    "self_reference": []
  }}
}}

CRITICAL RULES:
1. wheel.primary and wheel.secondary MUST be lowercase single Plutchik emotions
2. Valid emotions ONLY: joy, sadness, anger, fear, trust, disgust, surprise, anticipation
3. NO combinations like "Sadness + Disappointment" - pick ONE primary emotion
4. NO phrases like "Trust - Betrayal" - pick ONE secondary emotion
5. valence and arousal are numbers between 0 and 1
6. Return ONLY valid JSON, no explanations"""
    
    def __init__(
        self, 
        base_url: str = "http://localhost:11434",
        model: str = "phi3:latest",
        timeout: int = 30
    ):
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.timeout = timeout
    
    def is_available(self) -> bool:
        """Check if Ollama is reachable"""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except:
            return False
    
    def enrich(self, normalized_text: str) -> Optional[Dict]:
        """
        Call Ollama for enrichment
        
        Args:
            normalized_text: Normalized reflection text
        
        Returns:
            Parsed JSON response or None if failed
        """
        prompt = self.PROMPT_TEMPLATE.format(normalized_text=normalized_text)
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 300,
            }
        }
        
        start_time = time.time()
        
        try:
            print(f"🔍 Calling Ollama API: {self.base_url}/api/generate")
            print(f"   Model: {self.model}")
            print(f"   Text preview: {normalized_text[:60]}...")
            
            response = requests.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            if response.status_code != 200:
                print(f"[X] Ollama API error {response.status_code}: {response.text}")
                return None
            
            result = response.json()
            raw_response = result.get('response', '')
            
            print(f"[R] Ollama raw response ({latency_ms}ms): {raw_response[:200]}...")
            
            # Parse JSON from response
            parsed = self._parse_json(raw_response)
            
            if parsed:
                print(f"[OK] Ollama enrichment successful: {len(parsed)} fields")
                parsed['_latency_ms'] = latency_ms
                return parsed
            else:
                print(f"[!] Failed to parse JSON from Ollama response")
                return None
            
        except requests.Timeout:
            print(f"[!] Ollama timeout after {self.timeout}s")
            return None
        except Exception as e:
            print(f"[X] Ollama error: {type(e).__name__}: {e}")
            return None
    
    def _parse_json(self, raw_text: str) -> Optional[Dict]:
        """
        Parse JSON from LLM response (handles backticks, prose)
        
        Args:
            raw_text: Raw LLM response
        
        Returns:
            Parsed dict or None
        """
        # Remove markdown code blocks if present
        cleaned = raw_text.strip()
        
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        elif cleaned.startswith('```'):
            cleaned = cleaned[3:]
        
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        
        cleaned = cleaned.strip()
        
        # Try to find JSON object
        try:
            # Direct parse
            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Try to extract JSON from text
            start_idx = cleaned.find('{')
            end_idx = cleaned.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_str = cleaned[start_idx:end_idx+1]
                try:
                    return json.loads(json_str)
                except:
                    pass
        
        return None
    
    def validate_and_clamp(self, data: Dict) -> Dict:
        """
        Validate LLM output and clamp scores to [0, 1]
        
        Args:
            data: Parsed LLM response
        
        Returns:
            Validated and clamped dict
        """
        validated = {}
        
        # Valid Plutchik emotions
        VALID_EMOTIONS = ['joy', 'sadness', 'anger', 'fear', 'trust', 'disgust', 'surprise', 'anticipation']
        OPPOSITES = {
            'joy': 'sadness', 'sadness': 'joy',
            'anger': 'fear', 'fear': 'anger',
            'trust': 'disgust', 'disgust': 'trust',
            'surprise': 'anticipation', 'anticipation': 'surprise'
        }
        
        # Required string fields
        validated['invoked'] = str(data.get('invoked', 'unknown')).strip()
        validated['expressed'] = str(data.get('expressed', 'unknown')).strip()
        
        # Wheel (validate emotions)
        wheel = data.get('wheel', {})
        if isinstance(wheel, dict):
            primary = str(wheel.get('primary', '')).lower().strip()
            secondary = str(wheel.get('secondary', '')).lower().strip()
            
            # Clean up primary - extract first valid emotion
            if primary not in VALID_EMOTIONS:
                # Try to extract from phrases like "sadness + disappointment"
                for emotion in VALID_EMOTIONS:
                    if emotion in primary.lower():
                        primary = emotion
                        break
                else:
                    primary = 'sadness'  # Default fallback
            
            # Clean up secondary
            if secondary not in VALID_EMOTIONS or secondary == primary:
                # Use opposite of primary
                secondary = OPPOSITES.get(primary, 'surprise')
            
            validated['wheel'] = {
                'primary': primary,
                'secondary': secondary
            }
        else:
            validated['wheel'] = {
                'primary': 'sadness',
                'secondary': 'joy'
            }
        
        # Required float fields (clamped to [0, 1])
        validated['valence'] = max(0.0, min(1.0, float(data.get('valence', 0.5))))
        validated['arousal'] = max(0.0, min(1.0, float(data.get('arousal', 0.5))))
        validated['confidence'] = max(0.0, min(1.0, float(data.get('confidence', 0.5))))
        
        # Events (list of strings)
        events = data.get('events', [])
        if isinstance(events, list):
            validated['events'] = [str(e).strip() for e in events if e]
        else:
            validated['events'] = []
        
        # Warnings (list of strings)
        warnings = data.get('warnings', [])
        if isinstance(warnings, list):
            validated['warnings'] = [str(w).strip() for w in warnings if w]
        else:
            validated['warnings'] = []
        
        # Willingness cues (optional nested object)
        cues = data.get('willingness_cues', {})
        if isinstance(cues, dict):
            validated['willingness_cues'] = {
                'hedges': cues.get('hedges', []),
                'intensifiers': cues.get('intensifiers', []),
                'negations': cues.get('negations', []),
                'self_reference': cues.get('self_reference', []),
            }
        else:
            validated['willingness_cues'] = {
                'hedges': [],
                'intensifiers': [],
                'negations': [],
                'self_reference': [],
            }
        
        # Copy latency if present
        if '_latency_ms' in data:
            validated['_latency_ms'] = data['_latency_ms']
        
        return validated
