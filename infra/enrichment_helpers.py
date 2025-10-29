"""
Integration Wrapper for Enrichment Worker
Drop-in replacement functions to add caching without changing existing code
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from infra.optimized_ollama import OptimizedOllamaClient
from infra.metrics import timer
import os


class CachedHybridScorer:
    """
    Wrapper for HybridScorer that adds caching
    Can be used as drop-in replacement
    """
    
    def __init__(self, hf_token=None, ollama_base_url=None, use_ollama=True, ollama_model="phi3:latest"):
        self.ollama_base_url = ollama_base_url or "http://localhost:11434"
        self.ollama_model = ollama_model
        self.use_ollama = use_ollama
        
        # Initialize optimized client
        self.client = OptimizedOllamaClient(
            base_url=self.ollama_base_url,
            model=self.ollama_model,
            use_cache=True
        )
    
    def score(self, text: str, method: str = "hybrid"):
        """
        Score emotions with caching
        Original signature preserved for compatibility
        """
        from src.modules.hybrid_scorer import HybridScorer
        
        with timer("stage1_hybrid_score"):
            # Use original scorer but with optimized Ollama calls
            original_scorer = HybridScorer(
                ollama_base_url=self.ollama_base_url,
                use_ollama=self.use_ollama
            )
            
            # Patch the client if it uses ollama_client
            if hasattr(original_scorer, 'ollama_client'):
                # Replace generate method with cached version
                original_generate = original_scorer.ollama_client.generate
                
                def cached_generate(prompt, **kwargs):
                    result = self.client.generate(
                        prompt=prompt,
                        temperature=kwargs.get('temperature', 0.3),
                        max_tokens=kwargs.get('max_tokens', 120),
                        cache_type="emotion_scoring"
                    )
                    return result['response']
                
                original_scorer.ollama_client.generate = cached_generate
            
            return original_scorer.score(text, method=method)
    
    def is_available(self):
        """Check if Ollama is available"""
        return self.client.is_available()


class CachedPostEnricher:
    """
    Wrapper for PostEnricher that adds caching
    Can be used as drop-in replacement
    """
    
    def __init__(self, ollama_base_url=None, ollama_model="phi3:latest", temperature=0.8, timeout=360):
        self.ollama_base_url = ollama_base_url or "http://localhost:11434"
        self.ollama_model = ollama_model
        self.temperature = temperature
        self.timeout = timeout
        
        # Initialize optimized client
        self.client = OptimizedOllamaClient(
            base_url=self.ollama_base_url,
            model=self.ollama_model,
            use_cache=True
        )
    
    def enrich(self, *args, **kwargs):
        """
        Enrich with caching
        Original signature preserved
        """
        from src.modules.post_enricher import PostEnricher
        
        with timer("stage2_enrichment"):
            # Use original enricher but with optimized Ollama calls
            original_enricher = PostEnricher(
                ollama_base_url=self.ollama_base_url,
                ollama_model=self.ollama_model,
                temperature=self.temperature,
                timeout=self.timeout
            )
            
            # Patch if it uses ollama_client
            if hasattr(original_enricher, 'ollama_client'):
                original_generate = original_enricher.ollama_client.generate
                
                def cached_generate(prompt, **kwargs):
                    result = self.client.generate(
                        prompt=prompt,
                        temperature=kwargs.get('temperature', self.temperature),
                        max_tokens=kwargs.get('max_tokens', 160),
                        cache_type="post_enrichment"
                    )
                    return result['response']
                
                original_enricher.ollama_client.generate = cached_generate
            
            return original_enricher.enrich(*args, **kwargs)


# Helper function to monkey-patch existing worker
def enable_caching_for_worker():
    """
    Call this at the start of worker.py to enable caching globally
    No code changes needed - just add this one line
    """
    import sys
    from pathlib import Path
    
    # Add infra to path
    worker_dir = Path(__file__).parent
    sys.path.insert(0, str(worker_dir.parent))
    
    print("[PERF] Caching enabled for enrichment worker")
    print("[PERF] See infra/README.md for monitoring")
    
    return {
        "HybridScorer": CachedHybridScorer,
        "PostEnricher": CachedPostEnricher
    }
