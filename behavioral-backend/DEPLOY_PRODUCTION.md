# Production Deployment with OpenAI

## ✅ Solution: Hybrid LLM Support

Your backend now supports **TWO LLM modes**:

### **Local Development** (Ollama phi-3)
- ✅ Free, unlimited
- ✅ Private (runs on your PC)
- ✅ Fast after model loads
- ❌ Requires Ollama installed

### **Production** (OpenAI GPT-3.5-turbo)
- ✅ Works on Railway/Render
- ✅ No setup needed (cloud API)
- ✅ $0.001 per analysis (~$1 for 1000 reflections)
- ❌ Requires API key + costs money

**The system auto-detects:** If Ollama available → use phi-3, else → use OpenAI

---

## Step 1: Get OpenAI API Key (5 minutes)

1. **Create account**: https://platform.openai.com/signup
2. **Add payment method**: https://platform.openai.com/account/billing
   - $5 minimum credit
   - Free $5 credit for new users (expires 3 months)
3. **Create API key**: https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Name it "Leo Behavioral Backend"
   - Copy the key (starts with `sk-proj-...`)
   - ⚠️ **Save it now** - you can't see it again!

**Cost estimate:**
- Each reflection analysis: ~200 tokens = $0.0003
- 1000 reflections/month: ~$0.30
- 10,000 reflections/month: ~$3.00

---

## Step 2: Deploy to Railway (10 minutes)

### A. Login and Initialize

```powershell
cd behavioral-backend

# Login to Railway
railway login
# Opens browser - sign in with GitHub

# Create new project
railway init
# Enter project name: "leo-behavioral"
```

### B. Set Environment Variables

```powershell
# Upstash credentials (from your .env)
railway variables set UPSTASH_REDIS_REST_URL="https://ultimate-pika-17842.upstash.io"
railway variables set UPSTASH_REDIS_REST_TOKEN="AUWyAAIncDI0ZWIwZmY3Nzc4MGI0NmMzYWIxODM4ZTBmMGFjMTM3M3AyMTc4NDI"

# OpenAI API key (from Step 1)
railway variables set OPENAI_API_KEY="sk-proj-YOUR_KEY_HERE"
```

### C. Deploy

```powershell
# Deploy to Railway
railway up

# Wait ~2-3 minutes for build

# Get your production URL
railway domain
# Example: https://leo-behavioral-production.up.railway.app
```

### D. Verify Deployment

```powershell
# Health check
Invoke-RestMethod -Uri "https://your-app.railway.app/health"

# Should return:
# {
#   "status": "healthy",
#   "llm_available": true,
#   "llm_provider": "openai",
#   "upstash_available": true
# }
```

---

## Step 3: Update Vercel (2 minutes)

### Option A: Via Dashboard (Easier)

1. Go to https://vercel.com/dashboard
2. Select your "Leo" project
3. Settings → Environment Variables
4. Add new variable:
   - **Name**: `BEHAVIORAL_API_URL`
   - **Value**: `https://your-app.railway.app` (from Railway)
   - **Environments**: Production, Preview, Development
5. Click "Save"
6. Go to Deployments tab → Latest deployment → "Redeploy"

### Option B: Via CLI

```powershell
# Install Vercel CLI if not already
npm install -g vercel

# Login
vercel login

# Set environment variable
vercel env add BEHAVIORAL_API_URL production
# Paste: https://your-app.railway.app

# Redeploy
vercel --prod
```

---

## Step 4: Deploy Frontend (1 minute)

```powershell
cd C:\Users\Kafka\Documents\Leo

# Check what's changed
git status

# Add all changes
git add .

# Commit
git commit -m "Add OpenAI-powered phi-3 hybrid analyzer for production"

# Push (triggers Vercel auto-deploy)
git push origin main
```

**Wait 2-3 minutes** for Vercel to build and deploy.

---

## Step 5: Test Production (3 minutes)

### A. Health Check Railway Backend

```powershell
$railwayUrl = "https://your-app.railway.app"

# Check health
Invoke-RestMethod -Uri "$railwayUrl/health"

# Test analysis
$body = @{
    text = "I feel anxious about work deadlines"
    user_id = "test_production"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$railwayUrl/analyze" -Method POST -Body $body -ContentType "application/json"
```

Expected response:
```json
{
  "baseline": {
    "invoked": {
      "emotion": "anxiety",
      "valence": -0.5,
      "arousal": 0.7
    }
  },
  "hybrid": {
    "invoked": {
      "emotion": "anxiety",
      "valence": -0.68,
      "arousal": 0.82,
      "confidence": 0.85
    },
    "llm_enhanced": true
  },
  "llm_used": true,
  "llm_provider": "openai"
}
```

### B. Test Frontend Production

1. Visit: https://your-app.vercel.app/reflect/testpig
2. Type reflection: "I feel stressed about my job"
3. Watch loading animation: 🧠 "Phi-3 is thinking deeply..."
4. Check Upstash for enriched analysis

---

## Troubleshooting

### Railway deployment failed?

```powershell
# View logs
railway logs

# Common issues:
# - Missing OPENAI_API_KEY → Set it with `railway variables set`
# - Wrong Python version → railway.json specifies 3.9+
# - Port binding → Check Procfile uses $PORT
```

### Frontend can't reach backend?

```powershell
# Check Vercel env variable
vercel env ls

# Should show BEHAVIORAL_API_URL
# If missing:
vercel env add BEHAVIORAL_API_URL production
# Paste Railway URL
vercel --prod
```

### OpenAI API errors?

```powershell
# Check API key validity
Invoke-RestMethod -Uri "https://api.openai.com/v1/models" `
  -Headers @{"Authorization"="Bearer YOUR_KEY"}

# Check balance
# Visit: https://platform.openai.com/account/usage
```

### LLM not working?

Check Railway logs:
```powershell
railway logs --tail

# Look for:
# ✓ Using OpenAI GPT-3.5 (cloud fallback)  ← Good
# ⚠️  No LLM available                      ← Bad (missing OPENAI_API_KEY)
```

---

## Cost Monitoring

### Railway Costs
- **Free tier**: $5/month credit
- **Compute**: ~$5/month for small API
- **Total**: Likely free or <$5/month

### OpenAI Costs
- **Free credit**: $5 for 3 months (new users)
- **Per reflection**: ~$0.0003
- **1000 reflections**: ~$0.30
- **Monitor**: https://platform.openai.com/account/usage

### Total Cost Estimate
- **Month 1-3**: $0 (free credits)
- **After**: $5-10/month (Railway + OpenAI)

---

## Rollback Plan

If production breaks:

```powershell
# Rollback Railway
railway rollback

# Rollback Vercel (via dashboard)
# Go to Deployments → Previous deployment → "Promote to Production"

# Or revert git
git revert HEAD
git push origin main
```

---

## Next Steps

1. ✅ Get OpenAI API key
2. ✅ Deploy to Railway
3. ✅ Update Vercel env
4. ✅ Deploy frontend
5. ✅ Test production
6. 📊 Monitor costs and performance

**Ready to start?** Run Step 1 to get your OpenAI API key!
