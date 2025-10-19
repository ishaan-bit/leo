"""
Cloud LLM Provider - OpenAI fallback for production
When Ollama is not available, use OpenAI GPT-3.5-turbo
"""

import os
import json
import requests
from typing import Optional, Dict


class CloudLLMProvider:
    """
    Cloud LLM provider supporting multiple backends:
    - OpenAI GPT-3.5-turbo (production)
    - OpenAI GPT-4 (premium)
    - Anthropic Claude (alternative)
    """
    
    def __init__(self, provider: str = "openai", model: str = "gpt-3.5-turbo"):
        """
        Initialize cloud LLM provider.
        
        Args:
            provider: "openai" or "anthropic"
            model: Model name (e.g., "gpt-3.5-turbo", "gpt-4", "claude-3-haiku")
        """
        self.provider = provider
        self.model = model
        self.api_key = os.getenv("OPENAI_API_KEY") if provider == "openai" else os.getenv("ANTHROPIC_API_KEY")
        
    def is_available(self) -> bool:
        """Check if API key is configured."""
        return self.api_key is not None and len(self.api_key) > 0
    
    def call(self, prompt: str, max_tokens: int = 200, temperature: float = 0.3) -> Optional[str]:
        """
        Call cloud LLM API.
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum response length
            temperature: Sampling temperature (0.0-1.0)
            
        Returns:
            LLM response text or None if failed
        """
        if not self.is_available():
            print(f"⚠️  {self.provider.upper()} API key not configured")
            return None
        
        try:
            if self.provider == "openai":
                return self._call_openai(prompt, max_tokens, temperature)
            elif self.provider == "anthropic":
                return self._call_anthropic(prompt, max_tokens, temperature)
            else:
                print(f"⚠️  Unknown provider: {self.provider}")
                return None
        except Exception as e:
            print(f"⚠️  Cloud LLM call failed: {e}")
            return None
    
    def _call_openai(self, prompt: str, max_tokens: int, temperature: float) -> Optional[str]:
        """Call OpenAI API."""
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are an expert emotion analyst. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result["choices"][0]["message"]["content"].strip()
        else:
            print(f"⚠️  OpenAI API error: {response.status_code} - {response.text}")
            return None
    
    def _call_anthropic(self, prompt: str, max_tokens: int, temperature: float) -> Optional[str]:
        """Call Anthropic API."""
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result["content"][0]["text"].strip()
        else:
            print(f"⚠️  Anthropic API error: {response.status_code}")
            return None
