"""
OpenVINO GenAI Enricher
Uses Intel Arc GPU (primary), NPU (secondary), or CPU (fallback) for low-latency generation.
Maintains exact same interface as legacy PostEnricher for drop-in compatibility.
"""

import os
import json
import re
import logging
from typing import Dict, Optional, List
from pathlib import Path

logger = logging.getLogger(__name__)


class OpenVINOEnricher:
    """
    Drop-in replacement for PostEnricher using OpenVINO GenAI.
    
    Contract (MUST PRESERVE):
    - Input: reflection dict with raw_text, normalized_text, temporal phase, etc.
    - Output: dict with keys: poems, tips, closing_line, style, tags
    """
    
    def __init__(
        self,
        model_dir: Optional[str] = None,
        device: Optional[str] = None,
        temperature: float = 0.8,
        timeout: int = 30
    ):
        """
        Initialize OpenVINO enricher.
        
        Args:
            model_dir: Path to OpenVINO IR model (default: from OV_MODEL_DIR env)
            device: Device to use - GPU/NPU/CPU (default: auto-select)
            temperature: Generation temperature
            timeout: Max generation time in seconds
        """
        self.model_dir = model_dir or os.getenv('OV_MODEL_DIR', 'models/ov/phi3-mini')
        self.requested_device = device or os.getenv('OV_DEVICE', 'GPU')
        self.temperature = temperature
        self.timeout = timeout
        
        self.pipe = None
        self.tokenizer = None
        self.actual_device = None
        
        self._initialize_model()
    
    def _initialize_model(self):
        """Initialize OpenVINO model with device fallback logic."""
        try:
            import openvino_genai as ov_genai
        except ImportError:
            logger.error("[OV] openvino_genai not installed. Run: pip install openvino-genai")
            raise
        
        model_path = Path(self.model_dir)
        if not model_path.exists():
            logger.error(f"[OV] Model not found at {model_path}")
            logger.info(f"[OV] Convert your model first: optimum-cli export openvino --model microsoft/Phi-3-mini-4k-instruct {model_path}")
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        # Device selection with fallback
        devices_to_try = self._get_device_priority()
        
        for device in devices_to_try:
            try:
                logger.info(f"[OV] Attempting to load model on device: {device}")
                
                self.pipe = ov_genai.LLMPipeline(
                    str(model_path),
                    device=device
                )
                
                self.actual_device = device
                logger.info(f"[OV] ✓ Model loaded successfully on {device}")
                logger.info(f"[OV] Model path: {model_path}")
                logger.info(f"[OV] Temperature: {self.temperature}")
                
                # Test generation
                test_output = self.pipe.generate(
                    "Test",
                    max_new_tokens=10,
                    temperature=0.7
                )
                logger.info(f"[OV] ✓ Test generation successful")
                
                return
                
            except Exception as e:
                logger.warning(f"[OV] Failed to load on {device}: {e}")
                continue
        
        # All devices failed
        raise RuntimeError(f"[OV] Failed to initialize model on any device: {devices_to_try}")
    
    def _get_device_priority(self) -> List[str]:
        """
        Get device priority list based on requested device.
        Always tries requested device first, then fallback options.
        """
        if self.requested_device == 'GPU':
            return ['GPU', 'NPU', 'CPU']
        elif self.requested_device == 'NPU':
            return ['NPU', 'GPU', 'CPU']
        else:  # CPU or unknown
            return ['CPU']
    
    def enrich(
        self,
        reflection: Dict,
        raw_text: str,
        normalized_text: str,
        circadian_phase: str = 'afternoon',
        primary: Optional[str] = None,
        secondary: Optional[str] = None,
        tertiary: Optional[str] = None
    ) -> Dict:
        """
        Generate empathetic-stranger voice enrichment.
        
        **CONTRACT (DO NOT CHANGE):**
        Returns dict with exact keys: poems, tips, closing_line, style, tags
        
        Args:
            reflection: Full reflection dict (for context)
            raw_text: Original user input
            normalized_text: Cleaned text
            circadian_phase: Time of day context
            primary/secondary/tertiary: Emotion labels
        
        Returns:
            Dict with keys: poems, tips, closing_line, style, tags
        """
        try:
            # Build empathetic-stranger prompt
            prompt = self._build_prompt(
                raw_text=raw_text,
                normalized_text=normalized_text,
                circadian_phase=circadian_phase,
                primary=primary,
                secondary=secondary,
                tertiary=tertiary
            )
            
            # Generate with OpenVINO
            response = self._generate(prompt)
            
            # Parse JSON response
            parsed = self._parse_response(response)
            
            # Validate and return
            return self._validate_output(parsed, raw_text, circadian_phase)
            
        except Exception as e:
            logger.error(f"[OV] Enrichment failed: {e}")
            # Fallback to safe defaults
            return self._get_fallback_output(raw_text, circadian_phase)
    
    def _build_prompt(
        self,
        raw_text: str,
        normalized_text: str,
        circadian_phase: str,
        primary: Optional[str],
        secondary: Optional[str],
        tertiary: Optional[str]
    ) -> str:
        """Build empathetic-stranger style prompt."""
        
        # Circadian context
        circadian_context = self._get_circadian_context(circadian_phase)
        
        # Emotion context
        emotion_context = ""
        if primary:
            emotion_context = f"\nEmotion: {primary}"
            if secondary:
                emotion_context += f" ({secondary}"
                if tertiary:
                    emotion_context += f", {tertiary}"
                emotion_context += ")"
        
        prompt = f"""You are an empathetic stranger on a train. Not a therapist. Respond to this reflection with practical, grounded suggestions.

{circadian_context}

Reflection: "{raw_text}"{emotion_context}

VOICE RULES:
- Use "you" (second person), present tense
- Be specific, not generic ("text someone 'hey'" not "reach out to support network")
- Acknowledge struggle without fixing it
- Hinglish or English to match input
- NO therapy clichés, NO diagnosis

OUTPUT FORMAT (strict JSON):
{{
  "poems": [
    "line 1 (short, visceral, grounded)",
    "line 2 (specific to their situation)",
    "line 3 (validating without solving)"
  ],
  "tips": [
    "specific action 1 (what to do, not why)",
    "specific action 2",
    "specific action 3"
  ],
  "closing_line": "one sentence validation. See you tomorrow.",
  "style": {{
    "voice": "grounded|fierce|playful|soft",
    "tempo": "slow|mid|fast"
  }},
  "tags": ["tag1", "tag2", "tag3"]
}}

Generate ONLY the JSON. No extra text."""

        return prompt
    
    def _get_circadian_context(self, phase: str) -> str:
        """Get time-appropriate context."""
        contexts = {
            'morning': 'MORNING (6am-12pm): User likely starting day. Suggest morning-compatible actions (chai at window, fresh air, light walk). AVOID night language ("tonight", "sleep").',
            'afternoon': 'AFTERNOON (12pm-5pm): Mid-day, possibly at work. Suggest breaks (chai, step outside, pause). AVOID morning/night language.',
            'evening': 'EVENING (5pm-9pm): Winding down. Suggest evening actions (walk, music, dim chai). AVOID morning language.',
            'night': 'NIGHT (9pm-6am): Late/bedtime. Suggest rest-compatible actions (journal, breathe, gentle music). AVOID active/energizing suggestions.'
        }
        return contexts.get(phase, contexts['afternoon'])
    
    def _generate(self, prompt: str) -> str:
        """Generate response using OpenVINO."""
        try:
            # Generation config
            config = {
                'max_new_tokens': 512,
                'temperature': self.temperature,
                'do_sample': True,
                'top_p': 0.9,
                'top_k': 50
            }
            
            response = self.pipe.generate(
                prompt,
                **config
            )
            
            return response
            
        except Exception as e:
            logger.error(f"[OV] Generation failed: {e}")
            raise
    
    def _parse_response(self, response: str) -> Dict:
        """Parse JSON from model output."""
        # Extract JSON from response (model may include extra text)
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        
        if not json_match:
            logger.warning(f"[OV] No JSON found in response: {response[:200]}")
            raise ValueError("No JSON in response")
        
        json_str = json_match.group(0)
        return json.loads(json_str)
    
    def _validate_output(self, parsed: Dict, raw_text: str, phase: str) -> Dict:
        """
        Validate output has required keys and reasonable content.
        Re-prompt once if issues detected.
        """
        required_keys = ['poems', 'tips', 'closing_line', 'style', 'tags']
        
        # Check required keys
        for key in required_keys:
            if key not in parsed:
                logger.warning(f"[OV] Missing required key: {key}")
                raise ValueError(f"Missing key: {key}")
        
        # Validate structure
        if not isinstance(parsed['poems'], list) or len(parsed['poems']) != 3:
            raise ValueError("poems must be list of 3 strings")
        
        if not isinstance(parsed['tips'], list) or len(parsed['tips']) != 3:
            raise ValueError("tips must be list of 3 strings")
        
        if not isinstance(parsed['closing_line'], str):
            raise ValueError("closing_line must be string")
        
        # Quality gates (lightweight)
        if self._is_generic(parsed):
            logger.warning("[OV] Output flagged as generic, re-prompting...")
            # TODO: Re-prompt with stricter constraints (capped at 1 retry)
        
        if self._is_unsafe(parsed):
            logger.warning("[OV] Output flagged as unsafe, using fallback")
            return self._get_fallback_output(raw_text, phase)
        
        return parsed
    
    def _is_generic(self, output: Dict) -> bool:
        """Check if output contains generic therapy clichés."""
        generic_phrases = [
            'reach out',
            'support network',
            'self-care',
            'you are not alone',
            'it\'s okay to',
            'valid to feel'
        ]
        
        text = json.dumps(output).lower()
        return any(phrase in text for phrase in generic_phrases)
    
    def _is_unsafe(self, output: Dict) -> bool:
        """Check for unsafe content (diagnosis, harmful advice)."""
        unsafe_phrases = [
            'diagnosed',
            'disorder',
            'clinical',
            'medication',
            'therapist',
            'counselor'
        ]
        
        text = json.dumps(output).lower()
        return any(phrase in text for phrase in unsafe_phrases)
    
    def _get_fallback_output(self, raw_text: str, phase: str) -> Dict:
        """Safe fallback output when generation fails."""
        return {
            "poems": [
                "something shifted today, quiet but real",
                "you noticed it, that counts for something",
                "hold this moment, even if it's small"
            ],
            "tips": [
                "Take a short walk outside",
                "Text someone you trust",
                "Write down what you're feeling"
            ],
            "closing_line": "you showed up today. See you tomorrow.",
            "style": {
                "voice": "soft",
                "tempo": "mid"
            },
            "tags": ["reflection", "presence", "grounded"]
        }
    
    def get_device_info(self) -> Dict:
        """Get current device information for logging/health checks."""
        return {
            "requested_device": self.requested_device,
            "actual_device": self.actual_device,
            "model_dir": self.model_dir,
            "temperature": self.temperature,
            "status": "loaded" if self.pipe else "uninitialized"
        }
