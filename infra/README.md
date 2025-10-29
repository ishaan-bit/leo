# Performance Optimization Guide

## Overview

This directory contains performance infrastructure to optimize the Leo backend on Intel Core Ultra 7 hardware:

- **Content-addressable caching**: Eliminates redundant inference compute
- **Optimized Ollama client**: Tuned parameters for low-latency text generation
- **Async network client**: Connection pooling and retry logic for external APIs
- **Metrics tracking**: Monitor latency, cache hit rates, and throughput

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Performance Layer                        │
├─────────────────────────────────────────────────────────┤
│  Cache (SQLite)     │  Metrics      │  Async Client     │
│  SHA-256 keys       │  Latency P50  │  Connection pool  │
│  TTL per type       │  Cache hits   │  Retry + backoff  │
└─────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Existing Workers (unchanged)                │
├─────────────────────────────────────────────────────────┤
│  image-worker       │  enrichment-worker  │  song-worker│
│  Vision → caption   │  Stage 1 + 2 text   │  YouTube API│
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Configuration

Edit `config/perf_config.json` to tune for your hardware:

```json
{
  "inference": {
    "num_threads": 6,           // CPU threads for Ollama
    "text_max_new_tokens_stage1": 120,  // Limit token generation
    "temperature_stage1": 0.3    // Deterministic outputs
  },
  "caching": {
    "enabled": true,             // Enable caching
    "ttl_text_inference": 2592000  // 30 days for text
  }
}
```

### 2. Integration Examples

#### Enrichment Worker (Stage 1/2)

Replace direct Ollama calls with `OptimizedOllamaClient`:

```python
from infra.optimized_ollama import OptimizedOllamaClient
from infra.metrics import timer, get_metrics

# Initialize
client = OptimizedOllamaClient(
    base_url="http://localhost:11434",
    model="phi3:latest",
    use_cache=True  # Enable caching
)

# Use with timing
with timer("stage1_inference"):
    result = client.generate(
        prompt="Analyze: feeling overwhelmed and stressed",
        temperature=0.3,
        max_tokens=120,
        cache_type="text_inference"
    )
    text = result['response']

# Get stats
stats = get_metrics().get_stats()
print(f"Stage 1 p50: {stats['stage1_inference']['p50_ms']}ms")
print(f"Cache hit rate: {stats['cache']['text_inference']['hit_rate']}%")
```

#### Image Worker

Cache vision inference results:

```python
from infra.cache import get_cache
import hashlib

cache = get_cache()

# Generate cache key from image
image_hash = hashlib.sha256(image_base64.encode()).hexdigest()

# Check cache
cached_narrative = cache.get(
    content={"image_hash": image_hash, "model": "llava:latest"},
    cache_type="vision_inference"
)

if cached_narrative:
    return cached_narrative

# Generate if not cached
narrative = call_ollama_vision(image_base64)

# Store in cache (30 day TTL)
cache.set(
    content={"image_hash": image_hash, "model": "llava:latest"},
    value=narrative,
    ttl=2592000,
    cache_type="vision_inference"
)
```

#### Song Worker

Use async client for YouTube API calls:

```python
from infra.async_client import get_async_client
import asyncio

client = get_async_client()

async def get_song_recommendations(vibe: str, emotion: str):
    # Concurrent API calls with automatic retry
    results = await asyncio.gather(
        client.get(f"https://youtube.googleapis.com/..."),
        client.get(f"https://api.other-service.com/..."),
        return_exceptions=True
    )
    return results

# Run async code
recommendations = asyncio.run(get_song_recommendations("peaceful", "calm"))
```

## Performance Targets

### Current Baseline (no optimization)
- Image → narrative: ~5-15s (cold), ~3-8s (warm)
- Stage 1 text: ~2-5s
- Stage 2 text: ~3-8s
- Song fetch: ~2-4s
- **Total E2E**: ~15-30s

### Target (with optimizations)
- Image → narrative: ~800ms (cache hit), ~3-5s (cold)
- Stage 1 text: ~250ms (cache hit), ~1-2s (cold)
- Stage 2 text: ~250ms (cache hit), ~2-4s (cold)
- Song fetch: ~500ms (cache hit), ~1-2s (cold)
- **Total E2E p50**: <900ms (warm), <2500ms (cold)

### Expected Cache Hit Rates
- Text inference: 60-80% (similar reflections)
- Vision inference: 20-40% (unique images but some re-uploads)
- Song recommendations: 70-90% (popular emotion combos)

## Monitoring

### View Real-time Stats

```python
from infra.metrics import get_metrics
from infra.cache import get_cache

# Get performance metrics
stats = get_metrics().get_stats()
print(json.dumps(stats, indent=2))

# Get cache stats
cache_stats = get_cache().get_stats()
print(f"Total cache entries: {cache_stats['total_entries']}")
print(f"Cache size: {cache_stats['total_bytes'] / 1024 / 1024:.2f} MB")
```

### Health Endpoint

Add to your health server:

```python
from infra.metrics import get_metrics
from infra.cache import get_cache

@app.get("/metrics")
def metrics():
    return {
        "performance": get_metrics().get_stats(),
        "cache": get_cache().get_stats()
    }
```

## Maintenance

### Clear Expired Cache Entries

```python
from infra.cache import get_cache

deleted = get_cache().clear_expired()
print(f"Deleted {deleted} expired entries")
```

### Reset Metrics

```python
from infra.metrics import get_metrics

get_metrics().reset()
```

## Best Practices

1. **Always use cache_type parameter**: Helps track hit rates per operation
2. **Set appropriate TTLs**: 30 days for inference, 24h for API data
3. **Monitor cache hit rates**: >50% means caching is effective
4. **Limit max_tokens**: Faster generation, lower latency
5. **Use deterministic sampling**: temperature ≤0.3 for cacheable outputs
6. **Batch when possible**: Process multiple items in parallel

## Troubleshooting

### Cache not working?
```python
from infra.cache import get_cache
cache = get_cache()
print(f"Cache enabled: {cache.enabled}")
print(f"Cache stats: {cache.get_stats()}")
```

### Slow inference?
```python
from infra.metrics import get_metrics
stats = get_metrics().get_stats()
print(f"P95 latency: {stats['stage1_inference']['p95_ms']}ms")
# If >3000ms, check Ollama settings and CPU usage
```

### Network timeouts?
Check `config/perf_config.json`:
```json
{
  "networking": {
    "timeout_read": 180,  // Increase if timing out
    "retry_attempts": 3
  }
}
```

## Files

- `cache.py` - SQLite-backed content-addressable cache
- `optimized_ollama.py` - Ollama client with caching + tuned params
- `async_client.py` - Async HTTP client with retry logic
- `metrics.py` - Latency and throughput tracking
- `../config/perf_config.json` - Performance configuration

## Next Steps

1. Integrate `OptimizedOllamaClient` into enrichment-worker
2. Add caching to image-worker vision calls
3. Convert song-worker network calls to async
4. Monitor cache hit rates and adjust TTLs
5. Run benchmarks to validate <900ms p50 target
