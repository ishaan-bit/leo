# 🎯 Reflection Analysis Agent - Complete Integration

## ✅ What's Been Done

### 1. **Backend Agent (`agent_service.py`)**
   - ✅ Full reflection enrichment pipeline
   - ✅ Validates & normalizes input
   - ✅ Loads user history (180 days / 500 items)
   - ✅ Computes baselines (7-day, 90-day)
   - ✅ Extracts events, feelings, self-awareness
   - ✅ Detects risk (self-harm, hopelessness)
   - ✅ Calculates temporal features (momentum, z-scores, seasonality)
   - ✅ Computes recursion/event chaining (Jaccard similarity)
   - ✅ Generates insights
   - ✅ Persists back to Upstash with `analysis` block
   - ✅ Idempotent (SHA256 hash check)
   - ✅ Respects consent flags

### 2. **Persistence Layer (`src/persistence.py`)**
   - ✅ `get_reflections_by_owner_in_days()` - history loading
   - ✅ `save_reflection_by_rid()` - save enriched reflection
   - ✅ `get_reflection_by_rid()` - fetch by ID
   - ✅ `update_indices()` - maintain owner/pig sorted sets

### 3. **Frontend Integration (`apps/web/app/api/reflect/`)**
   - ✅ `/api/reflect/route.ts` - saves reflection, triggers analysis
   - ✅ `/api/reflect/analyze/route.ts` - webhook endpoint for analysis
   - ✅ Fire-and-forget analysis trigger (non-blocking)
   - ✅ Placeholder analysis (TypeScript) for testing

### 4. **CLI Tools**
   - ✅ `enrich_reflection.py` - Manual enrichment by RID
   - ✅ `test_upstash_connection.py` - Verify Upstash connectivity

### 5. **Documentation**
   - ✅ `INTEGRATION.md` - Complete integration guide
   - ✅ `requirements.txt` - Added pytz dependency

## 🚀 How to Test End-to-End

### Step 1: Verify Environment
```powershell
cd behavioral-backend

# Check you have Upstash credentials
echo $env:UPSTASH_REDIS_REST_URL
echo $env:UPSTASH_REDIS_REST_TOKEN

# If not set, add them:
$env:UPSTASH_REDIS_REST_URL="https://your-url.upstash.io"
$env:UPSTASH_REDIS_REST_TOKEN="your_token"

# Test connection
python test_upstash_connection.py
```

### Step 2: Deploy Frontend (if needed)
```powershell
cd ../apps/web
npm run dev
# or: vercel deploy
```

### Step 3: Create a Reflection
1. Go to your Vercel app (localhost:3000 or your Vercel URL)
2. Find a pig and enter a reflection, e.g.:
   ```
   Kafi Dinon bad Doston Se Milkar bahut Achcha Laga
   ```
3. Submit
4. Note the `rid` from the response (check Network tab or console)

### Step 4: Enrich the Reflection
```powershell
cd behavioral-backend
python enrich_reflection.py refl_XXXXXXXXX_XXXXXX
```

Expected output:
```
🔍 Fetching reflection refl_xxx from Upstash...
✓ Found reflection
  Owner: guest:sess_xxx
  Pig: testpig
  Text: It felt great to meet friends after many days...

🧠 Processing reflection...

✅ Analysis complete!

📊 Analysis Summary:
  Version: 1.0.0
  Event: Met friends after many days
  Feelings (expressed valence): 0.7
  Risk level: none
  Insights: 1 generated
  Latency: 45ms

💾 Reflection updated in Upstash
```

### Step 5: Verify in Upstash Console
1. Go to https://console.upstash.com/
2. Find your Redis database
3. Click "Data Browser"
4. Search for: `reflection:refl_xxx`
5. You should see the full JSON with `analysis` block

## 📊 Analysis Schema

The `analysis` block added to each reflection:

```json
{
  "analysis": {
    "version": "1.0.0",
    "generated_at": "2025-10-19T12:34:56.789Z",
    "timezone_used": "Asia/Kolkata",
    "hash_of_input": "sha256...",
    
    "event": {
      "summary": "Met friends after many days",
      "entities": ["friends", "meetup"],
      "context_type": "social"
    },
    
    "feelings": {
      "invoked": {
        "primary": "joy",
        "secondary": "contentment",
        "score": 0.78
      },
      "expressed": {
        "valence": 0.72,
        "arousal": 0.32,
        "confidence": 0.86
      },
      "congruence": 0.82
    },
    
    "self_awareness": {
      "clarity": 0.68,
      "depth": 0.44,
      "authenticity": 0.80,
      "effort": 0.35,
      "expression_control": 0.70,
      "composite": 0.64
    },
    
    "temporal": {
      "short_term_momentum": {
        "valence_delta_7": 0.18,
        "arousal_delta_7": -0.05
      },
      "long_term_baseline": {
        "valence_z": 0.92,
        "arousal_z": -0.20,
        "baseline_window_days": 90
      },
      "seasonality": {
        "day_of_week": "Saturday",
        "hour_bucket": "Morning",
        "is_typical_time": true
      },
      "streaks": {
        "positive_valence_days": 2,
        "negative_valence_days": 0
      }
    },
    
    "recursion": {
      "linked_prior_rids": ["refl_...a", "refl_...b"],
      "link_method": "jaccard",
      "thread_insight": "Similar social events tend to improve mood."
    },
    
    "risk": {
      "level": "none",
      "signals": [],
      "policy": "nonclinical-screen",
      "explanations": []
    },
    
    "tags_auto": ["social", "friends", "reunion"],
    
    "insights": [
      "Positive social contact aligns with above-baseline valence.",
      "Consider scheduling at least one friend meetup weekly."
    ],
    
    "provenance": {
      "models": {
        "event_extractor": "rules@v1",
        "sentiment_regressor": "rules@v1",
        "emotion_mapper": "rules+embedding@v1",
        "safety_classifier": "rules@v1",
        "embedding": "none@v1"
      },
      "thresholds": {
        "recursion_link_cosine": 0.80,
        "recursion_link_jaccard": 0.40
      },
      "latency_ms": 85
    }
  }
}
```

## 🔧 Current State vs Production

### Current (MVP - Working Locally)
- ✅ Python agent runs locally
- ✅ Manual enrichment via CLI
- ✅ Placeholder analysis in TypeScript webhook
- ✅ Full persistence to Upstash
- ⚠️ Analysis must be triggered manually

### Production (Next Steps)
- 🚧 Deploy Python agent as serverless function
- 🚧 TypeScript webhook calls Python microservice
- 🚧 Queue system (Upstash QStash / AWS SQS)
- 🚧 Auto-enrichment on reflection save
- 🚧 Replace rule-based NLP with ML models

## 🐛 Troubleshooting

### Issue: "Module not found"
```powershell
pip install -r requirements.txt
```

### Issue: "Upstash connection failed"
Check env vars:
```powershell
echo $env:UPSTASH_REDIS_REST_URL
```

Set if missing:
```powershell
$env:UPSTASH_REDIS_REST_URL="your_url"
$env:UPSTASH_REDIS_REST_TOKEN="your_token"
```

### Issue: "Reflection not found"
1. Check if reflection was actually saved
2. Verify RID format: `refl_TIMESTAMP_ID`
3. Check Upstash console for actual key

### Issue: Analysis not appearing
1. Run manual enrichment: `python enrich_reflection.py <rid>`
2. Check if `/api/reflect/analyze` endpoint exists
3. Verify Vercel logs: `vercel logs`

## 📁 File Structure

```
Leo/
├── apps/web/
│   └── app/api/reflect/
│       ├── route.ts          # Main reflection save (triggers analysis)
│       └── analyze/
│           └── route.ts      # Analysis webhook (placeholder)
│
└── behavioral-backend/
    ├── agent_service.py       # Main analysis agent
    ├── enrich_reflection.py   # CLI tool
    ├── test_upstash_connection.py  # Connection test
    ├── INTEGRATION.md         # This guide
    ├── requirements.txt       # Python deps
    │
    ├── src/
    │   ├── persistence.py     # Upstash operations
    │   ├── temporal_state.py  # Temporal analysis
    │   └── emotion_map.py     # Emotion/risk detection
    │
    └── temporal_state.py      # (root level, used by agent)
```

## ✨ Next Actions

### Immediate (to test everything)
1. ✅ Install dependencies: `pip install -r requirements.txt`
2. ✅ Set Upstash env vars
3. ✅ Test connection: `python test_upstash_connection.py`
4. ✅ Go to Vercel app, submit a reflection
5. ✅ Run: `python enrich_reflection.py <rid>`
6. ✅ Verify in Upstash console

### Short-term (production-ready)
1. Deploy Python agent to Vercel Functions
2. Update TypeScript webhook to call Python service
3. Add queue for reliable processing
4. Monitor/log analysis pipeline

### Long-term (advanced features)
1. Replace rules with HuggingFace models
2. Add embedding-based recursion (cosine similarity)
3. Implement advanced temporal features
4. Build analysis dashboard
5. Real-time updates via WebSocket

## 🎉 Success Criteria

You'll know it's working when:
- ✅ Reflection saved to Upstash with `rid`
- ✅ `python enrich_reflection.py <rid>` runs without errors
- ✅ Upstash console shows `analysis` block in reflection JSON
- ✅ Analysis includes event, feelings, temporal, risk, insights
- ✅ `provenance.latency_ms` shows processing time
- ✅ Running again with same RID shows "Already analyzed" (idempotent)

---

**Ready to test!** Start with Step 1 above. Let me know if you hit any issues.
