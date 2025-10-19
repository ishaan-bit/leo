# Reflection Analysis Agent - Integration Guide

## Overview
The Reflection Analysis Agent enriches saved reflections with behavioral analysis including:
- Event extraction
- Emotion/feeling analysis (Willcox wheel)
- Self-awareness scoring
- Temporal features (momentum, z-scores, seasonality)
- Recursion (event chaining)
- Risk detection
- Insights generation

## Setup

### 1. Install Python Dependencies
```powershell
cd behavioral-backend
pip install -r requirements.txt
```

### 2. Set Environment Variables
The agent needs Upstash credentials (same as your Vercel app):

```powershell
# In PowerShell
$env:UPSTASH_REDIS_REST_URL="your_url_here"
$env:UPSTASH_REDIS_REST_TOKEN="your_token_here"
```

Or create a `.env` file:
```
UPSTASH_REDIS_REST_URL=your_url_here
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

### 3. Deploy Frontend Changes
The `/api/reflect/route.ts` now automatically triggers analysis after saving a reflection.

```powershell
cd apps/web
npm run dev  # or vercel deploy
```

## Usage

### Option 1: Automatic (via Vercel App)
1. Go to your Vercel app
2. Enter a reflection in the notebook
3. Submit
4. The API will:
   - Save the reflection to Upstash
   - Trigger `/api/reflect/analyze` webhook
   - Add analysis block to the reflection

### Option 2: Manual Enrichment (Python CLI)
Process an existing reflection by its ID:

```powershell
cd behavioral-backend
python enrich_reflection.py refl_1760853676002_pxv98fkpp
```

This will:
- Fetch the reflection from Upstash
- Compute analysis
- Update the reflection with the `analysis` block

### Option 3: Batch Processing
Process all reflections for a user:

```powershell
# TODO: Create batch script
python batch_analyze.py --owner-id "guest:sess_xxx"
```

## Verification

### Check in Upstash Console
1. Go to https://console.upstash.com/
2. Find your Redis database
3. Search for key: `reflection:refl_xxx`
4. You should see the `analysis` block in the JSON

### Example Output Structure
```json
{
  "rid": "refl_xxx",
  "normalized_text": "It felt great to meet friends...",
  "valence": 0.27,
  "arousal": 0.003,
  "analysis": {
    "version": "1.0.0",
    "generated_at": "2025-10-19T...",
    "event": {
      "summary": "Met friends after many days",
      "entities": ["friends", "meetup"],
      "context_type": "social"
    },
    "feelings": {
      "invoked": {"primary": "joy", "score": 0.8},
      "expressed": {"valence": 0.7, "arousal": 0.5}
    },
    "self_awareness": {
      "clarity": 0.68,
      "composite": 0.64
    },
    "temporal": {
      "short_term_momentum": {"valence_delta_7": 0.18},
      "seasonality": {"day_of_week": "Saturday"}
    },
    "risk": {
      "level": "none",
      "signals": []
    },
    "insights": [
      "Positive social contact aligns with above-baseline valence."
    ],
    "provenance": {
      "latency_ms": 85
    }
  }
}
```

## Architecture

### Flow
```
User submits reflection
    ↓
POST /api/reflect (Next.js)
    ↓
Save to Upstash KV (reflection:rid)
    ↓
Trigger POST /api/reflect/analyze
    ↓
[In production: Call Python microservice]
[For now: Placeholder analysis in TypeScript]
    ↓
Fetch reflection from Upstash
    ↓
Compute analysis
    ↓
Merge analysis block
    ↓
Update reflection in Upstash
```

### Production Architecture (TODO)
For production, the Python agent should run as:
1. **Vercel Serverless Function** (Python runtime)
2. **AWS Lambda** triggered by SQS queue
3. **Background worker** (Railway, Render, Fly.io)
4. **Cloud Run** (Google Cloud)

The TypeScript `/api/reflect/analyze` endpoint would then call the Python service via HTTP.

## Troubleshooting

### "Module not found" errors
```powershell
pip install -r requirements.txt
```

### "Upstash connection failed"
Check environment variables:
```powershell
echo $env:UPSTASH_REDIS_REST_URL
echo $env:UPSTASH_REDIS_REST_TOKEN
```

### "Reflection not found"
The reflection might not be saved yet, or the key format might be wrong.
Check Upstash console for the actual key format (should be `reflection:{rid}`).

### Analysis not appearing
1. Check Vercel logs: `vercel logs`
2. Check if `/api/reflect/analyze` is being called
3. Verify the reflection exists in Upstash before analysis
4. Try manual enrichment with `enrich_reflection.py`

## Next Steps

1. **Deploy to Production**: Set up Python microservice on Vercel/AWS Lambda
2. **Queue System**: Use Upstash QStash or AWS SQS for reliable background processing
3. **Monitoring**: Add logging/metrics for analysis pipeline
4. **Advanced NLP**: Replace rule-based analysis with ML models (HuggingFace)
5. **Real-time Updates**: WebSocket to push analysis results to frontend

## Testing

### Test with Example Reflection
```powershell
# Go to your Vercel app
# Submit: "Kafi Dinon bad Doston Se Milkar bahut Achcha Laga"
# Expected: Translated to "It felt great to meet friends after many days."
# Analysis should detect: social context, positive valence, joy emotion
```

### Validate Schema
All reflections should have:
- `rid`, `sid`, `timestamp`, `owner_id`, `pig_id`
- `raw_text`, `normalized_text`
- `valence`, `arousal`
- `analysis` block after enrichment

## Files Modified

### Frontend (apps/web)
- `app/api/reflect/route.ts` - Added analysis trigger
- `app/api/reflect/analyze/route.ts` - New analysis webhook

### Backend (behavioral-backend)
- `agent_service.py` - Main analysis agent
- `src/persistence.py` - Added reflection read/write methods
- `enrich_reflection.py` - CLI tool for manual enrichment
- `requirements.txt` - Added pytz dependency

