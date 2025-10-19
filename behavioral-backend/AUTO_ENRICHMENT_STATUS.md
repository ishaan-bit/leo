# 🔄 Auto-Enrichment Status

## Current State: **Manual Enrichment Only**

### What's Working ✅
1. Reflections are saved to Upstash with key `reflection:{rid}`
2. Python backend can enrich reflections with full behavioral analysis
3. Analysis includes: events, feelings, self-awareness, risk, temporal features, insights

### What's NOT Working ❌
**Auto-enrichment is disabled.** The `/api/reflect/analyze` webhook only adds a placeholder.

## How to Enrich Reflections (Manual)

### Step 1: Get the Reflection ID
When you submit a reflection, note the `rid` in the console or response.

### Step 2: Run Enrichment
```powershell
cd behavioral-backend

# Load credentials
$env:KV_REST_API_URL = (Select-String -Path "..\apps\web\.env.local" -Pattern "KV_REST_API_URL=(.+)").Matches.Groups[1].Value.Trim().Trim('"').Trim("'")
$env:KV_REST_API_TOKEN = (Select-String -Path "..\apps\web\.env.local" -Pattern "KV_REST_API_TOKEN=(.+)").Matches.Groups[1].Value.Trim().Trim('"').Trim("'")

# Enrich
python enrich_reflection.py refl_1760873819567_eu1rohd0x

# View results
python view_analysis.py refl_1760873819567_eu1rohd0x
```

### Step 3: Check Upstash
Go to https://console.upstash.com/redis/ultimate-pika-17842 and find your key: `reflection:{rid}`

The reflection JSON will now include an `analysis` block with:
```json
{
  "analysis": {
    "version": "1.0.0",
    "event": { "summary": "...", "keywords": [...] },
    "feelings": { "expressed": { "valence": 0.0, "arousal": 0.3 } },
    "self_awareness": { "composite": 0.51 },
    "risk": { "level": "none" },
    "temporal": { "seasonality": {...} },
    "insights": [...],
    "provenance": { "latency_ms": 68 }
  }
}
```

## 🚀 To Enable Auto-Enrichment

You need to deploy the Python backend as a serverless function. Here are your options:

### Option 1: Vercel Serverless Function (Python) ⭐ Recommended

1. **Create `/api/python/enrich.py`** in your Vercel project:
```python
from http.server import BaseHTTPRequestHandler
import json
import sys
sys.path.insert(0, './behavioral-backend/src')
from agent_service import ReflectionAnalysisAgent
from persistence import UpstashStore

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        body = json.loads(self.rfile.read(content_length))
        
        rid = body.get('rid')
        store = UpstashStore()
        agent = ReflectionAnalysisAgent(store)
        
        reflection = store.get_reflection_by_rid(rid)
        result = agent.process_reflection(reflection)
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
```

2. **Update `vercel.json`**:
```json
{
  "functions": {
    "api/python/enrich.py": {
      "runtime": "python3.9"
    }
  }
}
```

3. **Update webhook** in `/api/reflect/analyze/route.ts`:
```typescript
// Call Python backend
const response = await fetch(`${process.env.VERCEL_URL}/api/python/enrich`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rid }),
});

if (!response.ok) {
  throw new Error(`Enrichment failed: ${response.statusText}`);
}

const result = await response.json();
console.log('✅ Enrichment complete:', rid);
```

### Option 2: External Serverless (AWS Lambda, GCP Functions)

Deploy `behavioral-backend/` as a standalone service and call via HTTP:
```typescript
const response = await fetch(process.env.PYTHON_BACKEND_URL, {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.BACKEND_SECRET}`
  },
  body: JSON.stringify({ rid }),
});
```

### Option 3: Queue-Based (Upstash QStash)

Use Upstash QStash to queue enrichment jobs:
```typescript
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN });

await qstash.publishJSON({
  url: `${process.env.BACKEND_URL}/enrich`,
  body: { rid },
});
```

### Option 4: Inline TypeScript (Not Recommended)

Reimplement the entire Python analysis logic in TypeScript within the webhook. This is **not recommended** as it duplicates code and loses the Python ecosystem benefits.

## 📊 Current Example

Your latest reflection:
```
RID: refl_1760873819567_eu1rohd0x
Text: "I think I ended up spending a lot of money last month and also lost my job, I am strained financially."

Analysis:
  Event: General reflection
  Feelings: Neutral (valence 0.0, arousal 0.3)
  Self-Awareness: 0.51 (used "I think")
  Risk: None
  Latency: 68ms
```

## ✅ Summary

- **Status**: Manual enrichment working perfectly
- **Issue**: Webhook doesn't call Python backend
- **Solution**: Deploy Python as serverless function (Option 1 recommended)
- **Workaround**: Run `python enrich_reflection.py <rid>` manually

Once you deploy the Python backend, the full flow will be automatic! 🚀
