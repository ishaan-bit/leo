# Local Development Startup Guide

## Every Time You Start Working

### 1. Start Ollama (for local phi-3)
```powershell
# Ollama should auto-start with Windows
# If not, start it manually:
ollama serve
```

### 2. Start Behavioral Backend (Python)
```powershell
cd C:\Users\Kafka\Documents\Leo\behavioral-backend

# Activate environment and run
python app.py
# OR if using virtual env:
# .venv\Scripts\activate
# python app.py
```

Server will start on: http://localhost:8000

**Check it's working:**
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

### 3. Start Next.js Frontend
```powershell
cd C:\Users\Kafka\Documents\Leo\apps\web

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Frontend will start on: http://localhost:3000

### 4. Open the App
```powershell
start http://localhost:3000/p/testpig
```

---

## Production URLs

- **Frontend**: https://leo-indol-theta.vercel.app
- **Backend**: https://strong-happiness-production.up.railway.app
- **Health Check**: https://strong-happiness-production.up.railway.app/health

---

## Troubleshooting

### Backend won't start
```powershell
# Check Python version
python --version  # Should be 3.11+

# Reinstall dependencies
cd C:\Users\Kafka\Documents\Leo\behavioral-backend
pip install -r requirements-server.txt
```

### Frontend won't start
```powershell
cd C:\Users\Kafka\Documents\Leo\apps\web

# Clear cache and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .next
npm install
npm run dev
```

### Ollama phi-3 not available
```powershell
# Pull phi-3 model
ollama pull phi3

# Verify it's available
ollama list
```

---

## Environment Variables

### Local (.env.local in apps/web)
```
UPSTASH_REDIS_REST_URL=https://ultimate-pika-17842.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
BEHAVIORAL_API_URL=http://localhost:8000
```

### Production (Vercel)
```
BEHAVIORAL_API_URL=https://strong-happiness-production.up.railway.app
```

### Production (Railway)
```
OPENAI_API_KEY=<your-key>
UPSTASH_REDIS_REST_URL=https://ultimate-pika-17842.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
PORT=8000
```
