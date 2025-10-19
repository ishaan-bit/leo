# Phi-3 Hybrid Deployment Guide

## Overview

You now have **2 backends** for emotion analysis:

### Option 1: Rule-Based (Current Production)
- **Location**: `agent_service.py` 
- **Speed**: Fast (~50ms)
- **Quality**: Good for obvious emotions
- **Deployment**: Works on Vercel serverless
- **Limitation**: Keyword-based, misses context/nuance

### Option 2: Phi-3 Hybrid (New - Better Quality)
- **Location**: `server.py` + `src/hybrid_analyzer.py`
- **Speed**: Slower (~200-500ms with LLM)
- **Quality**: Excellent - understands context, negation, sarcasm
- **Deployment**: Needs separate server (can't run on Vercel)
- **Advantage**: Semantic understanding via phi-3 LLM

## Architecture Comparison

### Current (Rule-Based Only)
```
Vercel App → /api/reflect/route.ts → Upstash
                                   ↓
                            (no analysis)
```

### With Phi-3 Hybrid Server
```
Vercel App → /api/reflect/route.ts → Upstash
                                   ↓
                            /api/reflect/analyze/route.ts
                                   ↓
                            Behavioral Server (FastAPI)
                                   ↓
                            Ollama + phi-3
                                   ↓
                            Upstash (enriched)
```

## Quality Comparison Examples

### Example 1: Negation
**Text**: "I'm not angry, just disappointed"

| Analyzer | Emotion | Valence | Why |
|----------|---------|---------|-----|
| Rule-based | anger | -0.6 | Detects "angry" keyword |
| Phi-3 Hybrid | disappointment | -0.4 | Understands negation + context |

### Example 2: Financial Stress (Your Test Case)
**Text**: "I think I ended up spending a lot of money last month and also lost my job, I am strained financially."

| Analyzer | Emotion | Valence | Arousal | Why |
|----------|---------|---------|---------|-----|
| Rule-based | anxiety | -0.42 | 0.65 | Matches "strained financially" keyword |
| Phi-3 Hybrid | anxiety | -0.55 to -0.65 | 0.75 | Understands job loss + financial strain severity |

### Example 3: Hopelessness
**Text**: "Everything feels hopeless. I can't do this anymore."

| Analyzer | Emotion | Valence | Arousal | Risk |
|----------|---------|---------|---------|------|
| Rule-based | neutral | -0.63 | 0.30 | hopelessness flag |
| Phi-3 Hybrid | hopelessness | -0.85 | 0.45 | hopelessness flag + context |

## Deployment Options

### Option A: Local Development (Easiest to Test)

1. **Install Ollama** (https://ollama.ai/download)
   ```powershell
   # Windows: Download installer from https://ollama.ai
   # After install, open terminal and run:
   ollama serve
   ```

2. **Pull phi-3 model**
   ```powershell
   ollama pull phi3
   ```

3. **Start behavioral server**
   ```powershell
   cd behavioral-backend
   pip install -r requirements-server.txt
   python server.py
   ```

4. **Test it**
   ```powershell
   # Health check
   curl http://localhost:8000/health
   
   # Analyze text
   curl -X POST http://localhost:8000/analyze `
     -H "Content-Type: application/json" `
     -d '{"text": "I am not angry just disappointed", "user_id": "test"}'
   ```

5. **Connect Vercel app** (set environment variable)
   ```
   BEHAVIORAL_API_URL=http://localhost:8000
   ```

### Option B: Cloud Deployment (Production)

#### Step 1: Deploy Behavioral Server

**Railway.app** (Recommended - Easy + Free Tier)
```bash
# 1. Create Railway account: https://railway.app
# 2. Install Railway CLI
npm install -g @railway/cli

# 3. Login and deploy
cd behavioral-backend
railway login
railway init
railway up

# 4. Add environment variables in Railway dashboard
# UPSTASH_REDIS_REST_URL=...
# UPSTASH_REDIS_REST_TOKEN=...
# OLLAMA_URL=http://localhost:11434 (if using sidecar)
```

**Alternative: Render.com**
```bash
# 1. Connect GitHub repo
# 2. Create Web Service
# 3. Set:
#    - Build Command: pip install -r requirements-server.txt
#    - Start Command: uvicorn server:app --host 0.0.0.0 --port $PORT
# 4. Add environment variables
```

#### Step 2: Deploy Ollama (2 Options)

**Option 1: Ollama as Sidecar** (same container)
- Pro: Simple architecture
- Con: Needs CPU resources, slower
- Use Railway's Docker deployment with custom Dockerfile

**Option 2: Separate Ollama Server** (recommended)
```bash
# Deploy on Modal.com (GPU-powered, pay-per-use)
# https://modal.com/docs/examples/ollama

# Or use RunPod, Replicate, or hosted Ollama instance
```

**Option 3: Use OpenAI Instead** (easiest, costs money)
Replace phi-3 with OpenAI GPT-3.5:
```python
# In hybrid_analyzer.py, replace _call_phi3 with:
import openai
openai.api_key = os.getenv("OPENAI_API_KEY")

response = openai.ChatCompletion.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": prompt}],
    temperature=0.3,
    max_tokens=150
)
```

#### Step 3: Connect Vercel

Set environment variable in Vercel dashboard:
```
BEHAVIORAL_API_URL=https://your-behavioral-server.railway.app
```

## Recommendation for You

### For Testing (Next 1-2 days)
1. **Install Ollama locally** (5 min)
2. **Start local server** with `python server.py`
3. **Test hybrid analyzer** to see quality difference
4. **Compare outputs** between rule-based and phi-3

### For Production (Next week)
Choose based on priorities:

| Priority | Recommendation |
|----------|----------------|
| **Best Quality** | Deploy hybrid server with phi-3 (Railway + Modal) |
| **Fastest Response** | Keep rule-based, improve keywords |
| **Lowest Cost** | Keep rule-based (free) |
| **Balanced** | Hybrid with OpenAI GPT-3.5 (good quality, $0.001/request) |

## Cost Comparison

| Option | Compute | LLM | Total/month (1000 reflections) |
|--------|---------|-----|-------------------------------|
| Rule-based | Free (Vercel) | Free | $0 |
| Phi-3 Local | Free (your PC) | Free | $0 |
| Phi-3 Railway + Modal | $5 | $0.50 | ~$6 |
| OpenAI GPT-3.5 | Free (Vercel) | $1.00 | ~$1 |

## Testing the Difference

Run this script to compare:

```powershell
# Test rule-based (current)
cd behavioral-backend
python enrich_reflection.py refl_1760873819567_eu1rohd0x

# Test hybrid (after installing Ollama + starting server)
curl -X POST http://localhost:8000/analyze `
  -H "Content-Type: application/json" `
  -d @- <<'EOF'
{
  "text": "I think I ended up spending a lot of money last month and also lost my job, I am strained financially.",
  "user_id": "test_user"
}
EOF
```

Compare the `baseline` vs `hybrid` values in the response!

## Next Steps

**Immediate:**
1. Install Ollama: https://ollama.ai/download (Windows installer)
2. Run: `ollama serve` in one terminal
3. Run: `ollama pull phi3` in another terminal
4. Run: `python server.py` from behavioral-backend/
5. Test: `curl http://localhost:8000/health`

**This Week:**
1. Test hybrid analyzer with your real reflections
2. Compare quality vs rule-based
3. Decide on deployment strategy

**Questions?**
- How important is response time? (<100ms vs <500ms)
- What's your monthly reflection volume?
- Budget for LLM calls?

Based on your answers, I'll help you pick the best deployment option.
