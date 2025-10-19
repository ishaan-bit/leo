# Quick Start Guide - Running Leo with Phi-3 Analysis

## Every Time You Want to Use the App

Open PowerShell in `C:\Users\Kafka\Documents\Leo` and paste these commands:

### 1. Start Phi-3 Behavioral Server (Required for Analysis)
```powershell
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd behavioral-backend; & 'C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe' server.py"
```

**What this does:**
- Opens new window with behavioral server
- Phi-3 will analyze every reflection
- Keep this window open while using the app

**You'll see:**
```
✓ Ollama connected - phi3 available
✓ Upstash connection established
✅ Server ready!
Uvicorn running on http://0.0.0.0:8000
```

### 2. Start Next.js App
```powershell
cd apps/web; npm run dev
```

**Opens at:** `https://localhost:3000`

---

## Full Startup Sequence (Copy & Paste All)

```powershell
# Start behavioral server in new window
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd behavioral-backend; & 'C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe' server.py"

# Wait for server to start
Start-Sleep -Seconds 5

# Start Next.js app
cd apps/web; npm run dev
```

**That's it!** After ~10 seconds:
- Behavioral server running on port 8000
- Next.js app running on port 3000
- Phi-3 ready to analyze reflections

---

## Quick Health Check (Optional)

After starting, verify phi-3 is working:
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

**Should show:**
```json
{
  "status": "healthy",
  "llm_available": true,
  "upstash_available": true
}
```

---

## What Happens When You Submit a Reflection

1. **You type**: "I feel anxious about work deadlines"
2. **App shows**: 🧠 "Understanding your reflection..."
3. **Backend**: Phi-3 analyzes for 10-30 seconds
4. **Result**: 
   - Baseline would say: valence=-0.50
   - Phi-3 understands: valence=-0.75 (50% more negative)
   - Captures urgency and stress better!

---

## Shutting Down

**Close both windows:**
1. New PowerShell window (behavioral server) - Press `Ctrl+C`
2. Original terminal (Next.js) - Press `Ctrl+C`

---

## Troubleshooting

**Behavioral server won't start?**
```powershell
# Check if Ollama is running
Get-Process | Where-Object {$_.ProcessName -like "*ollama*"}

# If not, Ollama should auto-start, but you can also run:
& "C:\Users\$env:USERNAME\AppData\Local\Programs\Ollama\ollama.exe" serve
```

**Port 8000 already in use?**
```powershell
# Kill existing process
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force

# Then restart server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd behavioral-backend; & 'C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe' server.py"
```

**Want to test phi-3 quickly?**
```powershell
cd behavioral-backend
& "C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe" test_integration.py
```

---

## Alternative: Use Batch File (Even Easier!)

From `Documents\Leo\behavioral-backend\`:
```powershell
.\start.bat
```

Then in another terminal:
```powershell
cd apps/web; npm run dev
```

---

## Performance Notes

- **First reflection**: May take 30-40 seconds (phi-3 cold start)
- **Subsequent**: 10-20 seconds
- **User experience**: Doesn't wait - sees completion immediately
- **Analysis**: Happens in background, enriches Upstash

---

**Remember:** Keep both terminals open while using the app!
- Terminal 1: Behavioral server (phi-3)
- Terminal 2: Next.js dev server
