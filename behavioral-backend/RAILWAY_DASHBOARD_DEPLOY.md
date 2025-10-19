# Railway Dashboard Deployment Guide

## ⚠️ Railway CLI Issue
The CLI is having issues with service creation. Let's use the **Railway Dashboard** instead - it's actually easier!

---

## Step-by-Step Dashboard Deployment:

### 1. Go to Railway Dashboard
**Visit**: https://railway.com/project/84ca3574-48c6-483a-819b-8bbd7d621027

(Your project "leo" was already created)

---

### 2. Connect GitHub Repository

1. Click **"New"** button (top right)
2. Select **"GitHub Repo"**
3. Search for: **"ishaan-bit/leo"**
4. Click **"Deploy"**
5. Railway will ask: "Which directory?"
   - Enter: `behavioral-backend`
   - Click **"Deploy"**

---

### 3. Set Environment Variables

After deployment starts, click on your service → **"Variables"** tab:

**Add these 3 variables:**

```
UPSTASH_REDIS_REST_URL=https://ultimate-pika-17842.upstash.io

UPSTASH_REDIS_REST_TOKEN=<your-upstash-token>

OPENAI_API_KEY=<your-openai-key-starts-with-sk-proj->
```

**Click "Deploy" after adding variables** (this will restart the service)

---

### 4. Configure Build Settings (Important!)

1. Click **"Settings"** tab
2. Scroll to **"Build"** section
3. **Root Directory**: `behavioral-backend`
4. **Build Command**: `pip install -r requirements-server.txt`
5. **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`
6. Click **"Save"**

---

### 5. Get Your Production URL

1. Click **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"**
4. Copy the URL (e.g., `leo-production.up.railway.app`)

---

### 6. Test Deployment

Once deployed (takes 2-3 minutes), test:

```powershell
# Replace with YOUR Railway URL
$url = "https://leo-production.up.railway.app"

# Health check
Invoke-RestMethod -Uri "$url/health"
```

Should return:
```json
{
  "status": "healthy",
  "llm_available": true,
  "llm_provider": "openai",
  "upstash_available": true
}
```

---

## Why CLI Failed:

Railway CLI requires:
1. Service to be created first
2. Linking to specific service
3. Proper directory context

**Dashboard is simpler**: Just connect GitHub and configure!

---

## Next Steps After Railway Deploys:

1. Copy your Railway URL
2. Update Vercel environment variable
3. Deploy frontend
4. Test production

**Go to the dashboard now and follow the steps above!** 🚀

https://railway.com/project/84ca3574-48c6-483a-819b-8bbd7d621027
