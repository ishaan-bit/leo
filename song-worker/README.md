# Song Recommendation Worker

LLM-powered song recommendation service using Ollama phi3 with GPU acceleration.

## Features

- 🎵 Generates fresh, contextual song suggestions from 1960-1975 era
- 🧠 Uses local Ollama phi3 with GPU for emotional analysis
- 💾 Caches recommendations in Upstash Redis (24h TTL)
- 🌍 Returns both Hindi and English songs
- 🔗 YouTube search URLs for easy playback

## Setup

### 1. Install Dependencies

```bash
cd song-worker
pip install -r requirements.txt
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Or copy from main app:

```powershell
Copy-Item "../apps/web/.env.local" ".env"
```

Required variables:
- `OLLAMA_URL` - Ollama API endpoint (default: http://localhost:11434)
- `UPSTASH_REDIS_REST_URL` - Your Upstash Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Your Upstash Redis token
- `PORT` - Service port (default: 5051)

### 3. Ensure Ollama is Running

```powershell
# Test Ollama
ollama run phi3:latest "Hello"
```

### 4. Run the Worker

```bash
# Development
python main.py

# Or with uvicorn directly
uvicorn main:app --reload --port 5051
```

## API Endpoints

### POST /recommend

Generate song recommendations for a reflection.

**Request:**
```json
{
  "rid": "reflection-uuid",
  "refresh": false
}
```

**Response:**
```json
{
  "rid": "reflection-uuid",
  "tracks": {
    "en": {
      "title": "Here Comes the Sun",
      "artist": "The Beatles",
      "year": 1969,
      "youtube_url": "https://www.youtube.com/results?search_query=...",
      "why": "Warm, hopeful melody matching positive low-arousal emotion"
    },
    "hi": {
      "title": "Lag Jaa Gale",
      "artist": "Lata Mangeshkar",
      "year": 1964,
      "youtube_url": "https://www.youtube.com/results?search_query=...",
      "why": "Tender ghazal with soothing emotional resonance"
    }
  },
  "meta": {
    "valence_bucket": "positive",
    "arousal_bucket": "low",
    "mood_cell": "positive-low",
    "version": "song-worker-v2-llm"
  }
}
```

### GET /health

Health check endpoint.

```json
{
  "status": "healthy",
  "service": "song-worker",
  "version": "2.0-llm",
  "ollama": "ok",
  "upstash": "configured"
}
```

## Deployment

### Local Development

```bash
python main.py
# Service runs on http://localhost:5051
```

### Production (Railway/Render)

1. Push to GitHub
2. Connect to Railway/Render
3. Set environment variables
4. Deploy

**Note:** Requires GPU support for optimal Ollama performance. Railway offers GPU instances.

## Integration with Next.js

Update `apps/web/app/api/recommend-songs/route.ts`:

```typescript
const SONG_WORKER_URL = process.env.SONG_WORKER_URL || 'http://localhost:5051';

const response = await fetch(`${SONG_WORKER_URL}/recommend`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rid, refresh }),
});
```

## Architecture

```
User opens moment
    ↓
Next.js API route (/api/recommend-songs)
    ↓
Song Worker (FastAPI) ← Checks Upstash cache
    ↓
Ollama phi3 (GPU) ← Generates contextual songs
    ↓
YouTube search URLs ← Returns to UI
    ↓
User clicks "Listen on YouTube"
```

## Troubleshooting

**Ollama not responding:**
```bash
# Check Ollama service
curl http://localhost:11434/api/tags

# Restart Ollama
ollama serve
```

**Slow generation:**
- Ensure GPU is available
- Check Ollama GPU usage: `nvidia-smi` (NVIDIA) or `rocm-smi` (AMD)
- Reduce `num_predict` in prompt options

**Cache not working:**
- Verify Upstash credentials in `.env`
- Check Upstash dashboard for connection issues
