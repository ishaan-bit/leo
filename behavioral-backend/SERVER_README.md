# Hybrid Behavioral Analysis Server

FastAPI microservice providing **phi-3 enhanced emotion analysis** with temporal state tracking.

## Architecture

```
┌─────────────────┐
│  Vercel App     │
│  (Next.js)      │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐      ┌──────────────┐
│  FastAPI Server │─────→│ Ollama+phi3  │
│  (this repo)    │      │ (localhost)  │
└────────┬────────┘      └──────────────┘
         │
         ↓
┌─────────────────┐
│ Upstash Redis   │
│ (temporal state)│
└─────────────────┘
```

## Features

- **Baseline Analysis**: Rule-based emotion detection (TextBlob + keywords)
- **LLM Enhancement**: phi-3 semantic understanding via Ollama (optional)
- **Temporal Tracking**: Time-series state evolution with EMA smoothing
- **Risk Detection**: Suicide ideation, hopelessness, withdrawal patterns
- **Full Agent Pipeline**: History loading, baseline computation, event extraction, insights

## Prerequisites

1. **Ollama** with phi-3 model:
   ```bash
   # Install Ollama: https://ollama.ai
   ollama pull phi3
   ollama serve
   ```

2. **Upstash Redis** credentials:
   ```bash
   # Get from https://console.upstash.com
   export UPSTASH_REDIS_REST_URL="https://..."
   export UPSTASH_REDIS_REST_TOKEN="..."
   ```

3. **Python 3.11+**

## Local Development

### Option 1: Direct Python

```bash
# Install dependencies
pip install -r requirements-server.txt
python -m textblob.download_corpora

# Set environment variables
cp .env.example .env
# Edit .env with your Upstash credentials

# Start server
python server.py

# Or with uvicorn directly
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Server will run at `http://localhost:8000`

### Option 2: Docker Compose

```bash
# Create .env file with Upstash credentials
cp .env.example .env

# Build and start
docker-compose up -d

# View logs
docker-compose logs -f behavioral-api

# Stop
docker-compose down
```

## API Endpoints

### POST /analyze
Analyze reflection text with hybrid phi-3 enhancement.

**Request:**
```json
{
  "text": "I feel anxious about work deadlines approaching.",
  "user_id": "user123"
}
```

**Response:**
```json
{
  "ok": true,
  "baseline": {
    "invoked": {
      "emotion": "anxiety",
      "valence": -0.42,
      "arousal": 0.65,
      "confidence": 0.75
    },
    "risk_flags": []
  },
  "hybrid": {
    "invoked": {
      "emotion": "anxiety",
      "valence": -0.48,
      "arousal": 0.70,
      "confidence": 0.88
    },
    "risk_flags": [],
    "temporal_after": {
      "regime": "NORMAL",
      "S": {"v": -0.48, "a": 0.70},
      "B": {"v": -0.32, "a": 0.55},
      "R": 0.095
    }
  },
  "llm_used": true,
  "latency_ms": 245
}
```

### POST /enrich/{rid}
Enrich existing reflection by RID (runs full agent pipeline).

**Request:**
```bash
curl -X POST http://localhost:8000/enrich/refl_1760873819567_eu1rohd0x
```

**Response:**
```json
{
  "ok": true,
  "rid": "refl_1760873819567_eu1rohd0x",
  "analysis_version": "1.0.0",
  "latency_ms": 156
}
```

### GET /health
Health check.

**Response:**
```json
{
  "status": "healthy",
  "llm_available": true,
  "temporal_available": true,
  "upstash_available": true
}
```

## Deployment

### Cloud Deployment (Railway, Render, Fly.io)

1. **Build Docker image:**
   ```bash
   docker build -t behavioral-api .
   ```

2. **Push to registry:**
   ```bash
   docker tag behavioral-api registry.example.com/behavioral-api
   docker push registry.example.com/behavioral-api
   ```

3. **Deploy to platform:**
   - Set environment variables: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - Set `OLLAMA_URL` to external Ollama instance (or disable LLM with `use_llm=False`)
   - Expose port 8000

### Connect Vercel Frontend

Update `apps/web/app/api/reflect/analyze/route.ts`:

```typescript
// Replace Vercel serverless function URL with your deployed server
const BEHAVIORAL_API_URL = process.env.BEHAVIORAL_API_URL || 'http://localhost:8000';

const enrichResponse = await fetch(`${BEHAVIORAL_API_URL}/enrich/${rid}`, {
  method: 'POST',
});
```

Set environment variable in Vercel:
```bash
BEHAVIORAL_API_URL=https://your-server.railway.app
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST API token |
| `OLLAMA_URL` | No | Ollama API endpoint (default: http://localhost:11434) |

## Testing

```bash
# Test hybrid analyzer directly
python src/hybrid_analyzer.py

# Test server endpoints
curl http://localhost:8000/health

curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "I feel anxious", "user_id": "test"}'
```

## Performance

- **Baseline only**: ~50ms
- **With phi-3 LLM**: ~200-500ms (depends on Ollama hardware)
- **With temporal**: +10-20ms

## Troubleshooting

**"Could not connect to Ollama"**
- Ensure Ollama is running: `ollama serve`
- Check Ollama port: `curl http://localhost:11434/api/tags`
- Install phi3: `ollama pull phi3`

**"Upstash credentials not found"**
- Set environment variables in `.env` file
- Verify credentials at https://console.upstash.com

**"phi3 model not found"**
- Pull model: `ollama pull phi3`
- Verify: `ollama list`

## Architecture Notes

### Why Separate Server?

Vercel serverless functions have limitations:
- No persistent connections (Ollama requires HTTP)
- 10s max execution (LLM can be slow)
- No GPU support (phi-3 is CPU-friendly but still benefits from dedicated compute)

This FastAPI server runs as a **separate microservice** that:
- Maintains persistent Ollama connection
- Handles longer LLM inference times
- Can be deployed on GPU-enabled infrastructure
- Provides WebSocket support (future)

### Hybrid vs Rule-Based

The `HybridAnalyzer` provides **better emotion detection** than pure rules:
- **Rules**: Fast, deterministic, keyword-based (current production)
- **Hybrid**: Slower, contextual, understands nuance (this server)

Example:
```
Text: "I'm not angry, just disappointed"

Rules: emotion=anger (detects "angry" keyword)
Hybrid: emotion=disappointment (understands negation + context)
```

## License

MIT
