# Deployment Guide - Leo Production

## Quick Deploy (Copy & Paste)

From `C:\Users\Kafka\Documents\Leo`:

```powershell
# 1. Check what changed
git status

# 2. Add all changes
git add .

# 3. Commit with message
git commit -m "Add phi-3 hybrid analyzer integration"

# 4. Push to main (triggers Vercel auto-deploy)
git push origin main
```

**That's it!** Vercel will automatically deploy in ~2-3 minutes.

---

## What Gets Deployed

### ✅ Automatically Deployed (Vercel)
- **Next.js App**: `apps/web/` → https://your-app.vercel.app
- **API Routes**: `/api/auth`, `/api/pig`, `/api/reflect`
- **Frontend**: All React components, loading animations
- **Environment Variables**: Already configured in Vercel dashboard

### ❌ NOT Automatically Deployed (Needs Separate Server)
- **Behavioral Backend**: `behavioral-backend/server.py` (phi-3 hybrid)
- **Ollama + phi-3**: Local model (2.2GB)
- **Python FastAPI**: Port 8000 server

---

## Two Deployment Scenarios

### Scenario A: Deploy Frontend Only (Without Phi-3)
**What works:**
- ✅ App loads and runs
- ✅ Reflections save to Upstash
- ✅ User authentication
- ✅ Basic features

**What doesn't work:**
- ❌ Phi-3 enhanced analysis (will fail silently)
- ❌ Loading animation shows but analysis doesn't happen

**Use this when:**
- Testing frontend changes
- Quick bug fixes
- Phi-3 server is down

```powershell
git add apps/web/
git commit -m "Update frontend"
git push origin main
```

---

### Scenario B: Deploy Everything (Frontend + Phi-3 Backend)

#### Step 1: Deploy Frontend to Vercel
```powershell
git add .
git commit -m "Deploy with phi-3 integration"
git push origin main
```

#### Step 2: Deploy Behavioral Backend (Choose One)

##### Option 1: Railway.app (Recommended - $5/month)

1. **Create Railway account**: https://railway.app
2. **Install Railway CLI**:
   ```powershell
   npm install -g @railway/cli
   ```

3. **Deploy**:
   ```powershell
   cd behavioral-backend
   railway login
   railway init
   railway up
   ```

4. **Add environment variables in Railway dashboard**:
   ```
   UPSTASH_REDIS_REST_URL=https://ultimate-pika-17842.upstash.io
   UPSTASH_REDIS_REST_TOKEN=AUWyAAIncDI0ZWIwZmY3Nzc4MGI0NmMzYWIxODM4ZTBmMGFjMTM3M3AyMTc4NDI
   OLLAMA_URL=http://localhost:11434
   ```

5. **Get your Railway URL** (e.g., `https://leo-behavioral.railway.app`)

6. **Update Vercel environment variable**:
   - Go to Vercel dashboard → Settings → Environment Variables
   - Set `BEHAVIORAL_API_URL=https://leo-behavioral.railway.app`
   - Redeploy: `vercel --prod`

##### Option 2: Render.com (Free tier available)

1. **Create Render account**: https://render.com
2. **Connect GitHub repo**
3. **Create Web Service**:
   - Root Directory: `behavioral-backend`
   - Build Command: `pip install -r requirements-server.txt`
   - Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. **Add environment variables** (same as above)
5. **Update Vercel** with your Render URL

##### Option 3: Keep Running Locally (Testing)

**For development/testing only:**

1. **Keep behavioral server running on your PC**:
   ```powershell
   cd behavioral-backend
   & "C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe" server.py
   ```

2. **Expose to internet with ngrok**:
   ```powershell
   # Install ngrok: https://ngrok.com/download
   ngrok http 8000
   ```

3. **Copy ngrok URL** (e.g., `https://abc123.ngrok.io`)

4. **Update Vercel environment variable**:
   ```
   BEHAVIORAL_API_URL=https://abc123.ngrok.io
   ```

**⚠️ Warning**: ngrok URL changes every restart. Only use for testing!

---

## Important Notes About Phi-3 Deployment

### The Challenge
- **Phi-3 model**: 2.2GB, needs GPU/CPU
- **Ollama**: Requires persistent server
- **Vercel limitations**: No long-running processes, 50MB limit

### The Solution
- **Vercel**: Hosts frontend + API routes
- **Separate server**: Hosts phi-3 + Ollama (Railway/Render)
- **Communication**: Vercel → HTTPS → Behavioral Server

### Cost Breakdown

| Service | Free Tier | Paid |
|---------|-----------|------|
| **Vercel** (frontend) | ✅ 100GB bandwidth | $20/month unlimited |
| **Railway** (phi-3) | ❌ None | $5/month + usage |
| **Render** (phi-3) | ✅ 750 hours/month | $7/month |
| **Modal.com** (phi-3 GPU) | ✅ $10 credit | $0.0001/second |

**Recommended for production**: Vercel (free) + Render (free tier) = $0/month

---

## Current Status Check

Before deploying, verify what's ready:

```powershell
# Check git status
git status

# Check current branch
git branch

# Check remote
git remote -v

# See recent commits
git log --oneline -5
```

---

## Post-Deployment Checklist

After `git push origin main`:

### 1. Monitor Vercel Deployment
- Visit: https://vercel.com/your-username/leo
- Check build logs for errors
- Usually takes 2-3 minutes

### 2. Test Production App
```powershell
# Health check (if behavioral server is deployed)
Invoke-RestMethod -Uri "https://your-behavioral-server.railway.app/health"

# Test reflection submission
# Visit: https://your-app.vercel.app/reflect/testpig
```

### 3. Verify Environment Variables
In Vercel dashboard:
- ✅ `BEHAVIORAL_API_URL` points to production server
- ✅ `KV_REST_API_URL` and `KV_REST_API_TOKEN` set
- ✅ `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set
- ✅ `NEXTAUTH_SECRET` set

### 4. Check Logs
```powershell
# Vercel logs
vercel logs --follow

# Railway logs (if deployed there)
railway logs
```

---

## Rollback (If Something Breaks)

```powershell
# See recent commits
git log --oneline -10

# Revert to previous commit
git revert HEAD

# Or force rollback
git reset --hard HEAD~1
git push origin main --force
```

In Vercel dashboard, you can also instantly revert to any previous deployment with one click.

---

## What to Deploy Right Now?

You have these new changes ready:

### Frontend Changes:
- ✅ `AnalysisLoading.tsx` - Loading animation
- ✅ `Scene_Reflect.tsx` - Integration with loading state
- ✅ `.env.local` - Local configuration

### Backend Changes:
- ✅ `behavioral-backend/` - Entire phi-3 server
- ✅ `src/hybrid_analyzer.py` - Phi-3 integration
- ✅ `server.py` - FastAPI microservice

### Documentation:
- ✅ `START_COMMANDS.md` - Startup guide
- ✅ `SETUP_COMPLETE.md` - Setup documentation
- ✅ Various status files

---

## Recommended Deployment Strategy

### Phase 1: Deploy Frontend (Now)
Deploy the loading animation and UI improvements:

```powershell
git add apps/web/src/components/atoms/AnalysisLoading.tsx
git add apps/web/src/components/scenes/Scene_Reflect.tsx
git commit -m "Add phi-3 analysis loading animation"
git push origin main
```

**Result**: Users see loading animation, but phi-3 doesn't run yet (graceful degradation)

### Phase 2: Deploy Backend (This Week)
Choose Railway or Render, deploy behavioral server:

```powershell
# After Railway/Render setup
vercel env add BEHAVIORAL_API_URL production
# Paste: https://your-behavioral-server.railway.app
vercel --prod
```

**Result**: Full phi-3 analysis working in production

### Phase 3: Monitor & Optimize (Ongoing)
- Watch server logs for errors
- Monitor response times
- Adjust timeout if needed
- Consider caching frequent analysis results

---

## Quick Commands Reference

```powershell
# Check changes
git status

# Deploy everything
git add .; git commit -m "your message"; git push origin main

# Deploy specific folder only
git add apps/web/; git commit -m "Frontend update"; git push origin main

# View deployment status
# Go to: https://vercel.com/dashboard

# Emergency rollback
git revert HEAD; git push origin main
```

---

## Need Help?

**Before deploying:**
1. Run local tests: `npm run dev` in `apps/web`
2. Check git status: `git status`
3. Review changes: `git diff`

**After deploying:**
1. Check Vercel logs for build errors
2. Test production URL
3. Monitor Railway/Render logs if backend deployed

**Issues?**
- Vercel build fails → Check build logs in dashboard
- App loads but broken → Check browser console (F12)
- Phi-3 not working → Check `BEHAVIORAL_API_URL` environment variable
- Server crashes → Check Railway/Render logs

---

**Ready to deploy?** Start with Phase 1 (frontend only) for safety! 🚀
