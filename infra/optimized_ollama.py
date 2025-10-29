"""
Optimized Ollama Client - Adds caching and optimized inference parameters
Drop-in replacement for direct Ollama API calls
"""

import json
import requests
from typing import Optional, Dict, Any, List
from pathlib import Path
import sys

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from infra.cache import get_cache


class OptimizedOllamaClient:
    """Ollama client with intelligent caching and optimized parameters"""
    
    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "phi3:latest",
        use_cache: bool = True
    ):
        self.base_url = base_url.rstrip('/')
        self.model = model
        self.use_cache = use_cache
        self.cache = get_cache() if use_cache else None
        
        # Load performance config
        config_path = Path(__file__).parent.parent / "config" / "perf_config.json"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
                self.inference_config = config.get("inference", {})
                self.ollama_config = config.get("ollama", {})
        else:
            self.inference_config = {}
            self.ollama_config = {}
    
    def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        cache_type: str = "text_inference"
    ) -> Dict[str, Any]:
        """
        Generate text with caching
        
        Args:
            prompt: User prompt
            system: System prompt
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Max tokens to generate
            stream: Stream response (caching disabled for streaming)
            cache_type: Cache category for TTL
        
        Returns:
            Response dict with 'response' key
        """
        # Build cache key from prompt + params
        cache_key_content = {
            "prompt": prompt,
            "system": system,
            "model": self.model
        }
        
        cache_key_params = {
            "temperature": temperature or self.inference_config.get("temperature_stage1", 0.3),
            "max_tokens": max_tokens or self.inference_config.get("text_max_new_tokens_stage1", 120)
        }
        
        # Check cache (skip if streaming)
        if not stream and self.use_cache and self.cache:
            cached = self.cache.get(
                content=cache_key_content,
                params=cache_key_params,
                cache_type=cache_type
            )
            if cached:
                print(f"[CACHE HIT] {cache_type}: {len(prompt)} chars → cached")
                return cached
        
        # Build payload with optimized options
        options = {
            "temperature": cache_key_params["temperature"],
            "num_predict": cache_key_params["max_tokens"],
            "num_ctx": self.inference_config.get("num_ctx", 2048),
            "num_thread": self.inference_config.get("num_threads", 6),
            "num_parallel": self.ollama_config.get("num_parallel", 2),
        }
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": stream,
            "options": options,
            "keep_alive": self.ollama_config.get("keep_alive", "30m")
        }
        
        if system:
            payload["system"] = system
        
        # Make request
        try:
            response = requests.post(
                f'{self.base_url}/api/generate',
                json=payload,
                timeout=180,
                stream=stream
            )
            response.raise_for_status()
            
            if stream:
                return response
            
            result = response.json()
            
            # Cache result
            if self.use_cache and self.cache:
                # Get TTL from config
                ttl_key = f"ttl_{cache_type}"
                ttl = self.cache.enabled and self.inference_config.get(ttl_key, 2592000)  # 30 days default
                
                self.cache.set(
                    content=cache_key_content,
                    value=result,
                    params=cache_key_params,
                    ttl=ttl,
                    cache_type=cache_type
                )
                print(f"[CACHE MISS] {cache_type}: {len(prompt)} chars → generated & cached")
            
            return result
            
        except requests.RequestException as e:
            print(f"[ERROR] Ollama request failed: {e}")
            raise
    
    def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        cache_type: str = "text_inference"
    ) -> Dict[str, Any]:
        """
        Chat completion with caching
        
        Args:
            messages: List of {role, content} dicts
            temperature: Sampling temperature
            max_tokens: Max tokens to generate
            stream: Stream response
            cache_type: Cache category
        
        Returns:
            Response dict with 'message' key
        """
        # Build cache key
        cache_key_content = {
            "messages": messages,
            "model": self.model
        }
        
        cache_key_params = {
            "temperature": temperature or self.inference_config.get("temperature_stage1", 0.3),
            "max_tokens": max_tokens or self.inference_config.get("text_max_new_tokens_stage1", 120)
        }
        
        # Check cache
        if not stream and self.use_cache and self.cache:
            cached = self.cache.get(
                content=cache_key_content,
                params=cache_key_params,
                cache_type=cache_type
            )
            if cached:
                print(f"[CACHE HIT] {cache_type}: {len(messages)} messages → cached")
                return cached
        
        # Build payload
        options = {
            "temperature": cache_key_params["temperature"],
            "num_predict": cache_key_params["max_tokens"],
            "num_ctx": self.inference_config.get("num_ctx", 2048),
            "num_thread": self.inference_config.get("num_threads", 6),
        }
        
        payload = {
            "model": self.model,
            "messages": messages,
            "stream": stream,
            "options": options,
            "keep_alive": self.ollama_config.get("keep_alive", "30m")
        }
        
        # Make request
        try:
            response = requests.post(
                f'{self.base_url}/api/chat',
                json=payload,
                timeout=180,
                stream=stream
            )
            response.raise_for_status()
            
            if stream:
                return response
            
            result = response.json()
            
            # Cache result
            if self.use_cache and self.cache:
                ttl_key = f"ttl_{cache_type}"
                ttl = self.inference_config.get(ttl_key, 2592000)
                
                self.cache.set(
                    content=cache_key_content,
                    value=result,
                    params=cache_key_params,
                    ttl=ttl,
                    cache_type=cache_type
                )
                print(f"[CACHE MISS] {cache_type}: {len(messages)} messages → generated & cached")
            
            return result
            
        except requests.RequestException as e:
            print(f"[ERROR] Ollama chat request failed: {e}")
            raise
    
    def is_available(self) -> bool:
        """Check if Ollama is available"""
        try:
            response = requests.get(f'{self.base_url}/api/tags', timeout=5)
            return response.status_code == 200
        except:
            return False
