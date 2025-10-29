"""
Example: How to integrate performance optimizations into enrichment-worker

TWO OPTIONS:
1. Quick Integration (no code changes) - Use cached wrappers
2. Full Integration - Replace Ollama calls with OptimizedOllamaClient

Choose Option 1 for fastest deployment with zero code changes.
"""

# ============================================================
# OPTION 1: QUICK INTEGRATION (RECOMMENDED - NO CODE CHANGES)
# ============================================================
# Add these 3 lines at the top of enrichment-worker/worker.py:

"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))  # Add parent to path

from infra.enrichment_helpers import enable_caching_for_worker
cached_classes = enable_caching_for_worker()

# Then replace your imports with cached versions:
# from src.modules.hybrid_scorer import HybridScorer  # OLD
# from src.modules.post_enricher import PostEnricher  # OLD

HybridScorer = cached_classes["HybridScorer"]  # NEW - with caching
PostEnricher = cached_classes["PostEnricher"]  # NEW - with caching

# Rest of your code stays exactly the same!
"""

# ============================================================
# OPTION 2: FULL INTEGRATION (MORE CONTROL)
# ============================================================

# Replace direct Ollama calls with OptimizedOllamaClient

# Example for Stage 1 (hybrid_scorer.py):
from infra.optimized_ollama import OptimizedOllamaClient
from infra.metrics import timer

class HybridScorer:
    def __init__(self, ollama_base_url="http://localhost:11434", ollama_model="phi3:latest"):
        # Replace requests.post with OptimizedOllamaClient
        self.ollama_client = OptimizedOllamaClient(
            base_url=ollama_base_url,
            model=ollama_model,
            use_cache=True  # Enable caching
        )
    
    def score(self, text: str):
        with timer("stage1_emotion_scoring"):
            # Build your prompt
            prompt = f"Analyze emotions in: {text}"
            
            # Call with caching enabled
            result = self.ollama_client.generate(
                prompt=prompt,
                temperature=0.3,  # Deterministic for better caching
                max_tokens=120,   # Limit generation
                cache_type="emotion_scoring"  # For tracking hit rate
            )
            
            response_text = result['response']
            
            # Parse emotions from response
            # ... your existing parsing logic ...
            
            return parsed_emotions


# Example for Stage 2 (post_enricher.py):
class PostEnricher:
    def __init__(self, ollama_base_url="http://localhost:11434"):
        self.ollama_client = OptimizedOllamaClient(
            base_url=ollama_base_url,
            model="phi3:latest",
            use_cache=True
        )
    
    def enrich(self, reflection_text: str, primary: str, secondary: str, tertiary: str):
        with timer("stage2_enrichment"):
            # Build your enrichment prompt
            messages = [
                {"role": "system", "content": "You are a mindful reflection assistant."},
                {"role": "user", "content": f"Enrich this: {reflection_text}"}
            ]
            
            # Call chat API with caching
            result = self.ollama_client.chat(
                messages=messages,
                temperature=0.7,
                max_tokens=160,
                cache_type="post_enrichment"
            )
            
            enriched_text = result['message']['content']
            return enriched_text


# ============================================================
# OPTION 3: ADD CACHING TO IMAGE WORKER
# ============================================================

# In image-worker/worker.py, cache vision results by image hash:

from infra.cache import get_cache
import hashlib

def process_image_reflection(rid: str, image_base64: str):
    cache = get_cache()
    
    # Generate cache key from image
    image_hash = hashlib.sha256(image_base64.encode()).hexdigest()
    
    # Check cache first
    cached_result = cache.get(
        content={"image_hash": image_hash, "model": "llava:latest"},
        cache_type="vision_inference"
    )
    
    if cached_result:
        print(f"[CACHE HIT] Image {rid} → using cached narrative")
        narrative = cached_result['narrative']
    else:
        # Call image-captioning service
        response = requests.post(
            f'{IMAGE_CAPTIONING_URL}/caption-base64',
            json={'image_base64': image_base64}
        )
        narrative = response.json()['narrative']
        
        # Cache result (30 days)
        cache.set(
            content={"image_hash": image_hash, "model": "llava:latest"},
            value={"narrative": narrative},
            ttl=2592000,
            cache_type="vision_inference"
        )
        print(f"[CACHE MISS] Image {rid} → generated & cached")
    
    return narrative


# ============================================================
# MONITORING EXAMPLE
# ============================================================

# Add health endpoint to enrichment-worker/health_server.py:

from infra.metrics import get_metrics
from infra.cache import get_cache

@app.get("/metrics")
def get_performance_metrics():
    return {
        "performance": get_metrics().get_stats(),
        "cache": get_cache().get_stats(),
        "status": "ok"
    }

# Then check metrics:
# curl http://localhost:8000/metrics

# Example response:
# {
#   "performance": {
#     "stage1_emotion_scoring": {
#       "count": 150,
#       "p50_ms": 280,
#       "p95_ms": 1200,
#       "avg_ms": 450
#     },
#     "cache": {
#       "emotion_scoring": {
#         "hits": 120,
#         "misses": 30,
#         "hit_rate": 80.0
#       }
#     }
#   }
# }


# ============================================================
# CONFIGURATION TUNING
# ============================================================

# Edit config/perf_config.json to optimize for your hardware:

{
  "inference": {
    "num_threads": 6,  # Tune based on your CPU cores
    "text_max_new_tokens_stage1": 120,  # Lower = faster
    "temperature_stage1": 0.3  # Lower = more deterministic = better caching
  },
  "caching": {
    "enabled": true,
    "ttl_text_inference": 2592000,  # 30 days
    "cache_dir": "./cache"
  }
}

# See infra/README.md for full documentation
