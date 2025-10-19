"""
Hybrid Behavioral Analyzer
Combines rule-based analysis with LLM for enhanced emotion detection.

Architecture:
1. Baseline: Rule-based analyzer (TextBlob + keywords)
2. LLM Enhancement: phi-3 (Ollama local) OR GPT-3.5 (OpenAI cloud)
3. Temporal Integration: Time-series state tracking
"""

import os
import sys
import json
import time
import requests
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from analyzer import analyze_reflection as baseline_analyze
from temporal_state import TemporalStateManager
from persistence import TemporalPersistence, UpstashStore
from src.cloud_llm import CloudLLMProvider


class HybridAnalyzer:
    """
    Hybrid emotion analyzer combining rule-based + LLM + temporal features.
    """
    
    def __init__(
        self,
        use_llm: bool = True,
        enable_temporal: bool = True,
        ollama_url: str = "http://localhost:11434"
    ):
        """
        Initialize hybrid analyzer.
        
        Args:
            use_llm: Whether to use LLM enhancement
            enable_temporal: Whether to track temporal state evolution
            ollama_url: Ollama API endpoint (for local phi-3)
        """
        self.use_llm = use_llm
        self.enable_temporal = enable_temporal
        self.ollama_url = ollama_url
        self.phi3_model = "phi3:latest"
        
        # Initialize LLM providers (try Ollama first, fallback to HuggingFace phi-3)
        self.llm_provider = "ollama"  # "ollama", "huggingface", or "openai"
        self.cloud_llm = CloudLLMProvider(provider="huggingface", model="microsoft/Phi-3-mini-4k-instruct")
        
        # Initialize temporal manager if enabled
        self.temporal_manager = None
        if self.enable_temporal:
            try:
                # Try to use Upstash for production
                upstash_url = os.getenv("UPSTASH_REDIS_REST_URL") or os.getenv("KV_REST_API_URL")
                upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN") or os.getenv("KV_REST_API_TOKEN")
                
                if upstash_url and upstash_token:
                    upstash_store = UpstashStore()  # Reads from environment variables
                    temporal_persistence = TemporalPersistence(upstash_store)
                    self.temporal_manager = TemporalStateManager(temporal_persistence)
                    print("✓ Temporal state manager initialized with Upstash")
                else:
                    print("⚠️  Upstash credentials not found - temporal features disabled")
                    self.enable_temporal = False
            except Exception as e:
                print(f"⚠️  Could not initialize temporal manager: {e}")
                self.enable_temporal = False
        
        # Check LLM availability: Try Ollama first, fallback to Hugging Face phi-3
        if self.use_llm:
            print(f"🔍 Checking LLM availability...", flush=True)
            print(f"   Ollama URL: {self.ollama_url}", flush=True)
            print(f"   Cloud LLM provider: {self.cloud_llm.provider}", flush=True)
            print(f"   HF API key set: {bool(os.getenv('HUGGINGFACE_API_KEY'))}", flush=True)
            
            if self._check_ollama_connection():
                self.llm_provider = "ollama"
                print("✓ Using Ollama phi-3 (local)", flush=True)
            elif self.cloud_llm.is_available():
                self.llm_provider = "huggingface"
                print("✓ Using Hugging Face phi-3 (cloud)", flush=True)
            else:
                print("⚠️  No LLM available - install Ollama or set HUGGINGFACE_API_KEY", flush=True)
                print(f"   Cloud LLM available: {self.cloud_llm.is_available()}", flush=True)
                self.use_llm = False
    
    def _check_ollama_connection(self) -> bool:
        """Test if Ollama is running and phi-3 is available."""
        try:
            response = requests.get(f"{self.ollama_url}/api/tags", timeout=2)
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [m.get("name", "") for m in models]
                
                if any("phi3" in name.lower() for name in model_names):
                    return True
                else:
                    print(f"⚠️  phi3 model not found in Ollama. Available: {model_names}")
                    print(f"   Install with: ollama pull phi3")
                    return False
            else:
                return False
        except Exception as e:
            return False
    
    def _call_llm(self, prompt: str, max_tokens: int = 200) -> Optional[str]:
        """
        Call LLM (Ollama phi-3 or OpenAI GPT-3.5).
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum response length
            
        Returns:
            LLM response text or None if failed
        """
        if self.llm_provider == "ollama":
            return self._call_phi3(prompt, max_tokens)
        elif self.llm_provider == "openai":
            return self.cloud_llm.call(prompt, max_tokens)
        else:
            return None
    
    def _call_phi3(self, prompt: str, max_tokens: int = 200) -> Optional[str]:
        """
        Call phi-3 via Ollama API (local).
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum response length
            
        Returns:
            LLM response text or None if failed
        """
        try:
            payload = {
                "model": self.phi3_model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,  # Low temperature for consistency
                    "num_predict": max_tokens,
                }
            }
            
            response = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload,
                timeout=30  # Increased timeout for phi-3
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("response", "").strip()
            else:
                print(f"⚠️  Ollama API error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"⚠️  LLM call failed: {e}")
            return None
    
    def _enhance_with_llm(self, text: str, baseline_output: Dict) -> Dict:
        """
        Enhance baseline analysis using phi-3 LLM.
        
        Prompt phi-3 to:
        1. Detect primary emotion with confidence
        2. Estimate valence and arousal
        3. Identify risk signals
        
        Args:
            text: Reflection text
            baseline_output: Rule-based analysis
            
        Returns:
            Enhanced analysis dict
        """
        # Build prompt for phi-3
        baseline_emotion = baseline_output.get("invoked", {}).get("emotion", "neutral")
        baseline_valence = baseline_output.get("invoked", {}).get("valence", 0.0)
        
        prompt = f"""Analyze emotional content of this text and respond ONLY with valid JSON:

Text: "{text}"

Provide JSON with these exact fields:
{{"emotion": "primary_emotion", "valence": -1.0_to_1.0, "arousal": 0.0_to_1.0, "confidence": 0.0_to_1.0, "risk_flags": []}}

Emotions: joy, sadness, anger, anxiety, fear, disgust, surprise, pride, shame, guilt, disappointment, relief, hopelessness, neutral
Valence: -1 (very negative) to 1 (very positive)
Arousal: 0 (calm) to 1 (intense)
Risk flags: self_harm, hopelessness, withdrawal, substance_use, or empty list

JSON only, no explanation:"""

        llm_response = self._call_llm(prompt, max_tokens=100)
        
        if not llm_response:
            # LLM failed - return baseline
            return baseline_output
        
        # Parse LLM response
        try:
            # Extract JSON from response (phi-3 sometimes adds explanation)
            json_start = llm_response.find("{")
            json_end = llm_response.rfind("}") + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = llm_response[json_start:json_end]
                llm_output = json.loads(json_str)
                
                # Merge LLM output with baseline
                enhanced = dict(baseline_output)
                enhanced["invoked"] = {
                    "emotion": llm_output.get("emotion", baseline_emotion),
                    "valence": float(llm_output.get("valence", baseline_valence)),
                    "arousal": float(llm_output.get("arousal", 0.5)),
                    "confidence": float(llm_output.get("confidence", 0.8)),
                }
                enhanced["risk_flags"] = llm_output.get("risk_flags", baseline_output.get("risk_flags", []))
                enhanced["llm_enhanced"] = True
                
                return enhanced
            else:
                print(f"⚠️  Could not parse LLM JSON response: {llm_response}")
                return baseline_output
                
        except json.JSONDecodeError as e:
            print(f"⚠️  LLM response not valid JSON: {e}")
            print(f"   Response: {llm_response}")
            return baseline_output
    
    def analyze_reflection(self, text: str, user_id: str) -> Dict[str, Any]:
        """
        Main analysis pipeline.
        
        Steps:
        1. Run baseline rule-based analyzer
        2. Optionally enhance with phi-3 LLM
        3. Optionally integrate temporal state tracking
        
        Args:
            text: Reflection text to analyze
            user_id: User identifier for temporal tracking
            
        Returns:
            {
                "baseline": {...},       # Rule-based analysis
                "hybrid": {...},         # Enhanced analysis (+ temporal_after if enabled)
                "llm_used": bool,        # Whether LLM was used
            }
        """
        # Step 1: Baseline analysis
        baseline_output = baseline_analyze(text)
        
        # Step 2: LLM enhancement (if enabled and available)
        llm_used = False
        if self.use_llm:
            llm_output = self._enhance_with_llm(text, baseline_output)
            llm_used = llm_output.get("llm_enhanced", False)
        else:
            llm_output = baseline_output
        
        # Step 3: Temporal processing (if enabled)
        final_output = llm_output
        if self.enable_temporal and self.temporal_manager:
            try:
                augmented_output = self.temporal_manager.process_observation(
                    user_id=user_id,
                    observation=llm_output,
                    now_ts=time.time()
                )
                # augmented_output is llm_output with temporal_after added
                final_output = augmented_output
            except Exception as e:
                print(f"⚠️  Temporal processing failed: {e}")
                # Continue without temporal features
        
        return {
            "baseline": baseline_output,
            "hybrid": final_output,
            "llm_used": llm_used,
        }


# Test CLI
if __name__ == "__main__":
    import sys
    
    # Test cases
    test_texts = [
        "I feel anxious about work deadlines approaching.",
        "Had a great day with friends! Feeling so happy.",
        "Everything feels hopeless. I can't do this anymore.",
        "Boss rebuked me in front of everyone. So angry.",
        "I think I ended up spending a lot of money last month and also lost my job, I am strained financially.",
    ]
    
    print("=== HYBRID ANALYZER TEST ===\n")
    
    analyzer = HybridAnalyzer(use_llm=True, enable_temporal=False)
    
    for i, text in enumerate(test_texts):
        print(f"\n--- Test {i+1}/{len(test_texts)} ---")
        print(f"Text: {text}")
        
        result = analyzer.analyze_reflection(text, "test_user")
        
        baseline = result["baseline"]
        hybrid = result["hybrid"]
        llm_used = result["llm_used"]
        
        print(f"\nBaseline:")
        print(f"  Emotion: {baseline['invoked']['emotion']}")
        print(f"  Valence: {baseline['invoked']['valence']:.2f}")
        print(f"  Arousal: {baseline['invoked']['arousal']:.2f}")
        
        print(f"\nHybrid (LLM={llm_used}):")
        print(f"  Emotion: {hybrid['invoked']['emotion']}")
        print(f"  Valence: {hybrid['invoked']['valence']:.2f}")
        print(f"  Arousal: {hybrid['invoked']['arousal']:.2f}")
        print(f"  Confidence: {hybrid['invoked']['confidence']:.2f}")
        print(f"  Risk flags: {hybrid.get('risk_flags', [])}")
        
        print()
