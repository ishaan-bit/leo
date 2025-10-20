# 🚀 Leo Enrichment Worker - Quick Start

## What We Built

✅ **Complete local enrichment pipeline** with:
- Ollama phi3 for emotion analysis
- Advanced analytics (temporal EMAs, z-scores, circadian, willingness, state tracking)
- Redis queue polling from Upstash
- Health monitoring

## Current Status

✅ All dependencies installed  
✅ Redis connected to Upstash  
✅ Ollama installed with phi3 model  
✅ Worker code complete  
⏳ Need to test full pipeline  

---

## Quick Test (Manual)

### 1. Start Worker

**Option A: Using batch file**
```cmd
cd C:\Users\Kafka\Documents\Leo\enrichment-worker
start-worker.bat
```

**Option B: Using PowerShell**
```powershell
cd C:\Users\Kafka\Documents\Leo\enrichment-worker
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"
python worker.py
```

### 2. Push Test Reflection

In another terminal:
```powershell
cd C:\Users\Kafka\Documents\Leo\enrichment-worker
python test_push.py
```

### 3. Check Results

The worker should:
- Pick up the reflection from queue
- Call Ollama phi3
- Run analytics
- Write enriched data to Redis

Check Redis for: `reflections:enriched:refl_test_1234567890`

---

## Integration with Frontend

### Current Flow

**Before (Railway backend):**
```
Frontend → Upstash → Railway (OpenAI) → Upstash
```

**After (Local worker):**
```
Frontend → Upstash (normalized queue) → Worker (Ollama) → Upstash (enriched)
```

### What Needs to Change

#### 1. Frontend `/api/reflect/route.ts`

**Add after saving reflection:**

```typescript
// Push to worker queue
await kv.lpush('reflections:normalized', JSON.stringify({
  rid,
  sid,
  timestamp,
  normalized_text: normalizedText,
  lang_detected: langDetected,
  input_mode: inputMode,
  client_context: clientContext
}));
```

#### 2. Frontend `/api/reflections/[rid]/route.ts` (NEW)

Create this file to fetch enriched data:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

export async function GET(
  request: NextRequest,
  { params }: { params: { rid: string } }
) {
  const rid = params.rid;
  
  // Try to get enriched data
  const enrichedKey = `reflections:enriched:${rid}`;
  const enriched = await kv.get(enrichedKey);
  
  if (enriched) {
    return NextResponse.json({
      status: 'enriched',
      data: enriched
    });
  }
  
  // Check if in queue
  const queueLen = await kv.llen('reflections:normalized');
  
  return NextResponse.json({
    status: 'processing',
    mode: 'hybrid-local',
    queue_length: queueLen
  });
}
```

#### 3. Frontend Health Check `/api/health/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

export async function GET() {
  const workerStatus = await kv.get('worker:status');
  
  return NextResponse.json({
    worker: workerStatus || { status: 'unknown' },
    redis: 'connected',
    mode: 'hybrid-local'
  });
}
```

---

## Troubleshooting

### Worker won't start

**Check:**
1. Is Ollama running? → `ollama list` should work
2. Is Redis accessible? → Run `python debug_worker.py`
3. Is .env configured? → Check `enrichment-worker/.env`

### Ollama timeout

**Solution:**
- Increase `OLLAMA_TIMEOUT=60` in `.env`
- Or use smaller model: `OLLAMA_MODEL=phi3:mini`

### Redis errors

**Check:**
- Upstash credentials in `.env`
- Network connection
- Test: `python -c "from src.modules.redis_client import get_redis; print(get_redis().ping())"`

### Queue not processing

**Check:**
- Worker is running
- Queue has items: Check Upstash console for `reflections:normalized`
- Ollama is responsive: `ollama run phi3 "test"`

---

## Next Steps

### Option 1: Continue Local Development

1. ✅ Worker is ready
2. Update frontend API routes (see above)
3. Deploy frontend to Vercel
4. Run worker locally while testing
5. Submit reflection from https://leo-indol-theta.vercel.app

### Option 2: Quick Demo (Manual Test)

1. Run: `python test_push.py` (pushes test reflection)
2. Start worker: `python worker.py`
3. Watch it process
4. Check Redis for enriched data

### Option 3: Deploy Worker to VPS

- Rent cheap VPS ($5-10/month)
- Install Ollama + phi3
- Run worker as systemd service
- Point to same Upstash Redis

---

## Files Created

```
enrichment-worker/
├── .env                     # YOUR credentials (not in git)
├── .env.example             # Template
├── requirements.txt         # Python deps
├── worker.py                # Main worker loop
├── health_server.py         # Health check HTTP server
├── test_push.py             # Test reflection pusher
├── debug_worker.py          # Debug imports
├── start-worker.bat         # Windows startup script
├── README.md                # Full documentation
└── src/
    └── modules/
        ├── analytics.py     # Temporal, willingness, state, risk
        ├── comparator.py    # Event norms
        ├── ollama_client.py # Phi3 integration
        ├── recursion.py     # Thread detection
        └── redis_client.py  # Upstash REST API
```

---

## Environment Variables

See `.env` file. Key ones:

- `UPSTASH_REDIS_REST_URL` - Your Upstash URL
- `UPSTASH_REDIS_REST_TOKEN` - Your Upstash token
- `OLLAMA_BASE_URL` - http://localhost:11434
- `OLLAMA_MODEL` - phi3:latest
- `TIMEZONE` - Asia/Kolkata
- `WORKER_POLL_MS` - 500

---

## Redis Keys Used

- `reflections:normalized` - Queue of reflections to process (LIST)
- `reflections:enriched:{rid}` - Enriched results (STRING)
- `worker:status` - Worker health status (STRING, 5min TTL)
- `reflections:sess_{sid}` - User's reflection history (ZSET)

---

## What You Can Do Now

1. **Test worker locally:**
   ```powershell
   cd enrichment-worker
   python test_push.py  # Push test reflection
   python worker.py     # Process it
   ```

2. **Check enriched output:**
   - Go to Upstash console
   - Look for key: `reflections:enriched:refl_test_1234567890`
   - See the full enriched JSON with analytics

3. **Update frontend** (next session):
   - Modify reflection save to push to queue
   - Add enriched data fetch endpoint
   - Deploy to Vercel
   - Keep worker running locally

---

**Questions?** Check:
- `enrichment-worker/README.md` - Full documentation
- `debug_worker.py` - Test imports
- Worker logs for errors

**Ready to proceed!** 🎉
