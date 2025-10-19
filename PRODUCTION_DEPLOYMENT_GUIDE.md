# Production Deployment Guide - Leo Behavioral Analysis

## Current Setup (Working)

**Stack:**
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Python FastAPI)
- **LLM**: OpenAI GPT-3.5-turbo (cloud)
- **Database**: Upstash Redis

**URLs:**
- Frontend: https://leo-indol-theta.vercel.app
- Backend: https://strong-happiness-production.up.railway.app
- Health: https://strong-happiness-production.up.railway.app/health

---

## How to Use Production

### 1. Submit a Reflection

Go to: https://leo-indol-theta.vercel.app/p/testpig

1. Type your reflection in the notebook
2. Click submit
3. The reflection is saved to Upstash
4. Backend enriches it with AI analysis (takes 2-5 seconds)

### 2. View Enriched Data

**In Upstash Console:**
1. Go to: https://console.upstash.com
2. Select your Redis database
3. Search for key: `reflection:refl_*`
4. Click on a reflection key
5. You'll see the full JSON with `analysis` object added

**What's in the analysis:**
```json
{
  "analysis": {
    "version": "1.0.0",
    "generated_at": "2025-10-19T...",
    "event": {
      "summary": "User expressing frustration about...",
      "entities": ["patience", "frustration"],
      "context_type": "emotional_state"
    },
    "feelings": {
      "invoked": {
        "primary": "frustration",
        "secondary": "impatience",
        "score": 0.8
      },
      "expressed": {
        "valence": -0.6,
        "arousal": 0.7,
        "confidence": 0.85
      }
    },
    "self_awareness": {
      "metacognition_score": 0.7,
      "reflection_depth": "moderate"
    },
    "temporal_context": {
      "time_references": ["now"],
      "tense": "present"
    }
  }
}
```

### 3. Monitor Usage

**OpenAI Usage:**
- Go to: https://platform.openai.com/usage
- Check your API usage
- You have $5 free credit (good for ~3,300 reflections)

**Railway Logs:**
- Go to: https://railway.app/dashboard
- Click your project
- View Deploy Logs to see enrichment requests

---

## Using phi-3 in Production (Advanced)

Railway's free tier is too small to run Ollama + phi-3. Here are alternatives:

### Option 1: Hugging Face Inference API (Recommended)

**Pros:**
- ✅ Actually uses phi-3 model
- ✅ Free tier available
- ✅ Easy to integrate

**Setup:**

1. Get Hugging Face API key: https://huggingface.co/settings/tokens

2. Modify `behavioral-backend/src/cloud_llm.py`:

```python
from huggingface_hub import InferenceClient

class CloudLLMProvider:
    def __init__(self, provider="huggingface", model="microsoft/phi-3-mini-4k-instruct"):
        self.provider = provider
        self.model = model
        if provider == "huggingface":
            hf_token = os.getenv("HUGGINGFACE_API_KEY")
            self.client = InferenceClient(token=hf_token)
    
    def call(self, prompt: str, max_tokens: int = 200) -> Optional[str]:
        if self.provider == "huggingface":
            response = self.client.text_generation(
                prompt,
                model=self.model,
                max_new_tokens=max_tokens
            )
            return response
```

3. Add to Railway environment variables:
```
HUGGINGFACE_API_KEY=hf_xxxxx
```

4. Update `hybrid_analyzer.py` to use Hugging Face instead of OpenAI

### Option 2: Fly.io with GPU (Best Quality)

**Pros:**
- ✅ Can run Ollama + phi-3 natively
- ✅ Best performance
- ✅ GPU acceleration available

**Cons:**
- ❌ More expensive (~$20-40/month for GPU)
- ❌ More complex setup

**Setup:**

1. Install Fly CLI:
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

2. Create `fly.toml`:
```toml
app = "leo-behavioral-backend"

[build]
  dockerfile = "Dockerfile.ollama"

[[vm]]
  gpu_kind = "a100-pcie-40gb"
  size = "a100-40gb"

[env]
  PORT = "8000"
```

3. Create `Dockerfile.ollama`:
```dockerfile
FROM ollama/ollama:latest

WORKDIR /app

# Install Python
RUN apt-get update && apt-get install -y python3 python3-pip

# Copy requirements and install
COPY requirements-server.txt .
RUN pip3 install -r requirements-server.txt

# Copy app
COPY . .

# Pull phi-3
RUN ollama pull phi3

# Start both Ollama and the app
CMD ollama serve & python3 app.py
```

4. Deploy:
```powershell
fly deploy
```

### Option 3: Self-Hosted VPS (Full Control)

**Use a VPS with GPU** (DigitalOcean, Linode, AWS EC2 g4dn instances):

1. Rent a GPU VPS (~$30-50/month)
2. Install Ollama and phi-3
3. Run the backend with Ollama
4. Point Vercel's `BEHAVIORAL_API_URL` to your VPS

---

## Comparison: OpenAI vs phi-3

### OpenAI GPT-3.5-turbo (Current)
- **Pros**: Reliable, fast, no infrastructure
- **Cons**: Costs money, less emotional nuance than phi-3
- **Best for**: Production MVP, testing
- **Cost**: $0.0015 per 1K tokens (~$0.001 per reflection)

### phi-3 via Hugging Face
- **Pros**: Free tier, actually uses phi-3, better emotion detection
- **Cons**: Slower, rate limits on free tier
- **Best for**: Small-scale production, testing
- **Cost**: Free (with limits)

### phi-3 via Ollama (Local/VPS)
- **Pros**: Best quality, full control, no API limits, private
- **Cons**: Infrastructure costs, GPU needed for speed
- **Best for**: Production at scale, privacy-sensitive data
- **Cost**: VPS rental ($30-50/month)

---

## Recommendation

**For now (MVP stage):**
- ✅ Keep using OpenAI GPT-3.5 on Railway
- Your $5 credit will last for months

**When ready to scale:**
- Switch to Hugging Face Inference API (free tier)
- If quality matters more than cost: Get GPU VPS with Ollama

**For production at scale:**
- Deploy on Fly.io with GPU
- Or use AWS Lambda with GPU (more complex)

---

## Cost Breakdown

### Current Setup (OpenAI)
- Railway: Free tier
- Vercel: Free tier
- Upstash: Free tier
- OpenAI: $5 free credit → then $0.001/reflection
- **Total**: FREE for ~3,300 reflections, then ~$1 per 1,000 reflections

### With Hugging Face
- Railway: Free tier
- Vercel: Free tier
- Upstash: Free tier
- Hugging Face: FREE (rate limited)
- **Total**: FREE

### With Fly.io GPU
- Fly.io GPU: ~$40/month
- Vercel: Free tier
- Upstash: Free tier
- **Total**: ~$40/month (unlimited reflections)

---

## Next Steps

1. **Test current setup**: Submit reflections, verify enrichment works
2. **Monitor OpenAI costs**: Check usage dashboard
3. **When $5 runs out**: Add payment method OR switch to Hugging Face
4. **For better quality**: Consider GPU VPS with Ollama phi-3

---

## Troubleshooting

### Enrichment not working
1. Check Railway logs for errors
2. Verify environment variables in Railway
3. Test health endpoint: https://strong-happiness-production.up.railway.app/health

### Reflection saved but not enriched
1. Check Upstash - reflection should have `analysis` field
2. If missing, Railway might have failed - check logs
3. Try resubmitting or manually trigger: `POST /enrich/{rid}`

### OpenAI errors
1. Check API key is valid
2. Check you haven't exceeded rate limits
3. Verify $5 credit hasn't run out

---

**Created**: October 19, 2025  
**Last Updated**: October 19, 2025  
**Status**: ✅ Production Ready
