---
title: Leo Enrichment Worker
emoji: "🧠"
colorFrom: purple
colorTo: pink
sdk: docker
sdk_version: "1.0"
app_file: app.py
pinned: false
---

# Leo Enrichment Worker

Enrichment worker runs the 2-stage enrichment pipeline using Ollama (phi3). This Space uses a Docker container and requests a GPU (t4-small).

Environment variables (add in Settings → Repository secrets):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `HF_TOKEN`

The container starts `start.sh` which launches Ollama and the worker loop.
# Leo Enrichment Worker

Local worker that polls Upstash Redis for normalized reflections, enriches them with Ollama (phi3), and writes back enriched data with advanced analytics.

## Architecture

```
Frontend (Vercel) → Upstash Redis → Worker (Local) → Ollama (phi3)
                      ↓                   ↓
                 normalized_text    enriched_data
```

## Features

- **Temporal Analytics**: EMAs (1d/7d/28d), z-scores, WoW changes, streaks
- **Circadian Analysis**: Time-of-day patterns, sleep adjacency
- **Willingness-to-Express**: Linguistic cues, inhibition, amplification
- **Latent State Tracking**: EMA-based state estimation
- **Recursion Detection**: Thread linking with hybrid similarity
- **Comparator**: Event class norms with deviation analysis
- **Risk Signals**: Weak risk detection (anergy, persistent irritation)
- **Ollama Integration**: phi3 for emotion labeling

## Setup

### 1. Install Dependencies

```powershell
cd enrichment-worker
pip install -r requirements.txt
```

### 2. Setup Ollama

```powershell
# Install Ollama from https://ollama.ai
ollama pull phi3
ollama run phi3  # Test it works
```

### 3. Configure Environment

```powershell
# Copy example
cp .env.example .env

# Edit .env with your values:
# - UPSTASH_REDIS_REST_URL
# - UPSTASH_REDIS_REST_TOKEN
# - OLLAMA_BASE_URL (default: http://localhost:11434)
# - TIMEZONE (default: Asia/Kolkata)
```

### 4. Run Worker

```powershell
python worker.py
```

### 5. Run Health Server (Optional)

In another terminal:

```powershell
python health_server.py
```

Then visit: http://localhost:8001/healthz

## Environment Variables

See `.env.example` for full list. Key variables:

- `UPSTASH_REDIS_REST_URL`: Your Upstash Redis URL
- `UPSTASH_REDIS_REST_TOKEN`: Your Upstash token
- `OLLAMA_BASE_URL`: Ollama API URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Model name (default: phi3:latest)
- `WORKER_POLL_MS`: Poll interval in milliseconds (default: 500)
- `BASELINE_BLEND`: Blend factor for analytics (default: 0.35)
- `TIMEZONE`: Timezone for circadian analysis (default: Asia/Kolkata)

## How It Works

### 1. Poll Queue

Worker polls `reflections:normalized` list in Redis every 500ms.

### 2. Load History

Fetches user's past 90 reflections for temporal analytics.

### 3. Call Ollama

Sends normalized text to phi3 with JSON-only prompt:
- Invoked/expressed emotions
- Valence/arousal scores
- Event labels
- Warnings
- Willingness cues

### 4. Baseline Analytics

Computes locally:
- Temporal: EMAs, z-scores, WoW, circadian, streaks
- Recursion: Thread links with hybrid similarity
- Comparator: Event norm deviations
- Willingness: Linguistic cue analysis
- State: Latent state tracking (EMA)
- Quality: Input quality metrics
- Risk: Weak risk signal detection

### 5. Merge & Write

Combines Ollama output with baseline analytics into final enriched schema, writes to `reflections:enriched:{rid}`.

## Output Schema

```json
{
  "rid": "refl_...",
  "sid": "sess_...",
  "timestamp": "2025-10-20T12:00:00Z",
  "timezone_used": "Asia/Kolkata",
  "normalized_text": "...",
  
  "final": {
    "invoked": "tired",
    "expressed": "exhausted",
    "valence": 0.22,
    "arousal": 0.52,
    "confidence": 0.74,
    "events": [
      {"label": "fatigue", "confidence": 0.9}
    ],
    "warnings": []
  },
  
  "congruence": 0.80,
  
  "temporal": {
    "ema": {...},
    "zscore": {...},
    "wow_change": {...},
    "circadian": {...},
    "streaks": {...},
    "last_marks": {...}
  },
  
  "recursion": {...},
  "comparator": {...},
  "willingness": {...},
  "state": {...},
  "quality": {...},
  "risk_signals_weak": [],
  
  "provenance": {...},
  "meta": {...}
}
```

See full schema in main README.

## Monitoring

### Worker Status

Worker updates `worker:status` in Redis every 5 minutes with:
```json
{
  "status": "healthy|degraded|down",
  "timestamp": "...",
  "details": {
    "processed_count": 42,
    "queue_length": 0
  }
}
```

### Health Endpoint

If running health_server.py:

```bash
curl http://localhost:8001/healthz
```

Returns:
```json
{
  "ollama": "ok",
  "redis": "ok", 
  "status": "healthy",
  "model": "phi3:latest"
}
```

## Troubleshooting

### Ollama Not Found

```powershell
# Check Ollama is running
ollama list

# Start Ollama service
ollama serve
```

### Redis Connection Failed

Check `.env` has correct `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### Worker Stuck

Check logs for errors. Common issues:
- Ollama timeout (increase `OLLAMA_TIMEOUT`)
- Redis connection lost (check network)
- Invalid JSON from Ollama (check prompt template)

### Slow Processing

- Increase `WORKER_POLL_MS` to reduce polling frequency
- Use GPU for Ollama (faster inference)
- Reduce `ZSCORE_WINDOW_DAYS` and `EMA_WINDOWS` for lighter analytics

## Development

### Project Structure

```
enrichment-worker/
├── worker.py                    # Main worker loop
├── health_server.py             # Health check HTTP server
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment template
├── README.md                    # This file
└── src/
    └── modules/
        ├── analytics.py         # Temporal, circadian, willingness, state, risk
        ├── comparator.py        # Event norms & deviations
        ├── ollama_client.py     # Ollama API client
        ├── recursion.py         # Thread detection
        └── redis_client.py      # Redis wrapper
```

### Adding New Analytics

1. Create module in `src/modules/`
2. Import in `worker.py`
3. Call in `process_reflection()`
4. Add to enriched schema

### Testing

```powershell
# Test Ollama connection
python -c "from src.modules.ollama_client import OllamaClient; c = OllamaClient(); print(c.is_available())"

# Test Redis connection
python -c "from src.modules.redis_client import get_redis; r = get_redis(); print(r.ping())"

# Test analytics
python -c "from src.modules.analytics import TemporalAnalyzer; t = TemporalAnalyzer(); print(t.compute_ema(0.5, [], 7))"
```

## License

MIT
