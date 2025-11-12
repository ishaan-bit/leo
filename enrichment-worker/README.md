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

### Core Enrichment Pipeline (v2.2)

- **6 Primary Emotions**: Happy, Sad, Angry, Fearful, Surprised, Disgusted
- **36 Secondary Emotions**: Canonical normalized taxonomy (e.g., Peaceful, Content, Excited)
- **197 Tertiary Emotions**: Fine-grain emotion states for nuanced analysis
- **Neutral Detection**: Distinguishes true neutral affect from Peaceful/Calm
- **Dual Valence**: Separate emotion_valence and event_valence [0, 1]
- **Arousal Dimension**: Activation level [0, 1]
- **Domain Classification**: Self, Work, Relationship, Health, Finance, Life
- **Control & Polarity**: High/Low control, Positive/Negative polarity

### Advanced Language Understanding (v2.2)

- **Graded Negation**: 4-level negation strength (weak 0.15 → strong 0.60)
- **Litotes Detection**: "not bad" → positive flip (+0.40), "not terrible" → positive flip (+0.45)
- **Profanity-Angry Coupling**: Profanity keywords boost Angry emotion scoring
- **Sarcasm Integration**: Context-aware sarcasm detection affects valence
- **Emotion Keywords**: 60+ keyword patterns for primary emotion detection

### Analytics & Intelligence

- **Temporal Analytics**: EMAs (1d/7d/28d), z-scores, WoW changes, streaks
- **Circadian Analysis**: Time-of-day patterns, sleep adjacency
- **Willingness-to-Express**: Linguistic cues, inhibition, amplification
- **Latent State Tracking**: EMA-based state estimation
- **Recursion Detection**: Thread linking with hybrid similarity
- **Comparator**: Event class norms with deviation analysis
- **Risk Signals**: Weak risk detection (anergy, persistent irritation)

### Observability & Quality (v2.2)

- **Confidence Calibration**: 3 methods (temperature scaling, Platt scaling, isotonic regression)
- **Expected Calibration Error (ECE)**: Target ≤ 0.08 for reliable confidence scores
- **Structured Logging**: JSON logs with ISO timestamps, service tags, request IDs
- **PII Masking**: Automatic masking of emails, phone numbers, SSN, credit cards
- **Metrics Aggregation**: P50/P95/P99 latency tracking, confidence distributions
- **Feature Flags**: A/B testing infrastructure for controlled rollouts

### LLM Integration

- **Ollama Integration**: phi3 for emotion labeling and contextual analysis

## Setup

### 1. Install Dependencies

```powershell
cd enrichment-worker
pip install -r requirements.txt
```

**v2.2 Dependencies:**
- `numpy`: For numerical computations in calibration
- `scipy`: For optimization in temperature scaling
- `scikit-learn`: For Platt scaling and isotonic regression
- Standard dependencies: `requests`, `python-dotenv`, `upstash-redis`

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

### v2.2 Enrichment Result

```json
{
  "rid": "refl_...",
  "sid": "sess_...",
  "timestamp": "2025-10-20T12:00:00Z",
  "timezone_used": "Asia/Kolkata",
  "normalized_text": "...",
  
  "final": {
    "primary": "Sad",
    "secondary": "Melancholic",
    "tertiary": "Wistful",
    "emotion_valence": 0.22,
    "event_valence": 0.35,
    "arousal": 0.52,
    "domain": "Life",
    "control": "Low",
    "polarity": "Negative",
    "is_emotion_neutral": false,
    "is_event_neutral": false,
    "confidence": 0.74,
    "flags": {
      "has_negation": true,
      "negation_strength": 0.40,
      "is_litotes": false,
      "has_profanity": false,
      "has_sarcasm": false
    }
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
  
  "calibration": {
    "method": "temperature_scaling",
    "pre_calibration_confidence": 0.62,
    "post_calibration_confidence": 0.74,
    "ece": 0.045
  },
  
  "observability": {
    "request_id": "req_abc123",
    "latency_ms": 85.3,
    "pii_masked": true,
    "feature_flags": {
      "neutral_detection": true,
      "tertiary_emotions": true,
      "confidence_calibration": true
    }
  },
  
  "provenance": {...},
  "meta": {...}
}
```

**v2.2 New Fields:**
- `tertiary`: Fine-grain emotion (197 states)
- `emotion_valence`: Separate from event_valence
- `is_emotion_neutral`, `is_event_neutral`: Neutral detection flags
- `flags.has_negation`, `flags.negation_strength`: Graded negation
- `flags.is_litotes`: Litotes detection ("not bad" → positive)
- `flags.has_profanity`: Profanity detection
- `calibration`: Confidence calibration metrics
- `observability`: Logging, PII masking, feature flags

See `docs/API_CONTRACT.md` for full schema documentation.

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
├── RUNBOOK.md                   # Operations guide (v2.2)
├── API_CONTRACT.md              # API schema documentation (v2.2)
├── MIGRATION_v2.0_to_v2.2.md    # Upgrade guide (v2.2)
├── src/
│   ├── enrich/
│   │   ├── pipeline_v2_2.py         # v2.2 enrichment pipeline
│   │   ├── negation.py              # Graded negation & litotes
│   │   ├── neutral_detection.py     # Neutral emotion detection
│   │   ├── sarcasm.py               # Sarcasm detection
│   │   ├── secondary_emotions.py    # 36 canonical secondary emotions
│   │   ├── tertiary_emotions.py     # 197 fine-grain emotions
│   │   ├── domain_taxonomy.py       # 6 life domains
│   │   ├── dual_valence.py          # Emotion + event valence
│   │   ├── observability.py         # Logging, PII masking, metrics (v2.2)
│   │   └── calibration.py           # Confidence calibration (v2.2)
│   └── modules/
│       ├── analytics.py         # Temporal, circadian, willingness, state, risk
│       ├── comparator.py        # Event norms & deviations
│       ├── ollama_client.py     # Ollama API client
│       ├── recursion.py         # Thread detection
│       └── redis_client.py      # Redis wrapper
└── tests/
    ├── test_observability.py    # 9 tests (v2.2)
    ├── test_calibration.py      # 10 tests (v2.2)
    ├── test_negation.py         # Negation & litotes tests
    ├── test_neutral.py          # Neutral detection tests
    └── test_pipeline_v2_2.py    # Integration tests
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

# Test v2.2 modules
pytest tests/test_observability.py -v   # 9 tests, all passing
pytest tests/test_calibration.py -v     # 10 tests, all passing
pytest tests/test_pipeline_v2_2.py -v   # Integration tests

# Run all tests
pytest tests/ -v
```

### v2.2 Features

For detailed documentation on v2.2 features, see:
- **API_CONTRACT.md**: Complete v2.2 schema documentation
- **MIGRATION_v2.0_to_v2.2.md**: Upgrade guide from v2.0/v2.1
- **RUNBOOK.md**: Operational procedures and troubleshooting

## License

MIT
