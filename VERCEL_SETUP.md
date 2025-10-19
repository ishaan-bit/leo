# Vercel Environment Variable Setup

## Production URLs

- **Frontend**: https://leo-indol-theta.vercel.app
- **Backend**: https://strong-happiness-production.up.railway.app
- **Health Check**: https://strong-happiness-production.up.railway.app/health

## Add Railway Backend URL to Vercel

1. Go to https://vercel.com/dashboard
2. Select your **leo** project (leo-indol-theta)
3. Click **Settings** → **Environment Variables**
4. Add a new variable:
   - **Key**: `BEHAVIORAL_API_URL`
   - **Value**: `https://strong-happiness-production.up.railway.app`
   - **Environments**: Check all (Production, Preview, Development)
5. Click **Save**

## Redeploy Frontend

After adding the environment variable:

1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**

OR just push a new commit and Vercel will auto-deploy (recommended).

## Test the Integration

Once deployed, submit a reflection through your production URL and check:
- Vercel logs should show: `🧠 Calling behavioral analysis server for <rid>`
- Railway logs should show the `/enrich/<rid>` request
- OpenAI API should be called for emotion analysis

### Test Commands

```powershell
# Test backend health
Invoke-RestMethod -Uri "https://strong-happiness-production.up.railway.app/health"

# Submit test reflection (after frontend deployed)
# Go to: https://leo-indol-theta.vercel.app/p/testpig
# Type reflection and submit
```

## Integration Flow

```
User → Vercel Frontend → Next.js API Route (/api/reflect/analyze)
         ↓
      Railway Backend (/enrich/{rid})
         ↓
      OpenAI GPT-3.5 (emotion analysis)
         ↓
      Upstash Redis (store enriched reflection)
```
