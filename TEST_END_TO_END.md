# 🧪 Test Your Leo App End-to-End

**Date**: October 20, 2025  
**App URL**: https://leo-indol-theta.vercel.app

---

## ✅ Pre-Test Checklist

Before testing, ensure the enrichment backend is running:

```powershell
cd c:\Users\Kafka\Documents\Leo
.\start-backend.ps1
```

**Expected output**:
```
✅ Ollama is running
📊 System Info: Intel Core Ultra 7 256V (CPU mode)
🏥 Health Check:
   Ollama: ok
   Redis: ok
   Status: healthy
👀 Watching reflections:normalized for reflections...
```

⚠️ **Keep this terminal open** while testing!

---

## 🔄 Test Flow: Login → Reflect → Enrichment

### Step 1: Visit the App
1. Open **https://leo-indol-theta.vercel.app**
2. You should see the awakening/landing page

### Step 2: Login as Guest
1. Click **"Guest Login"** or **"Continue as Guest"**
2. You'll get a session ID (stored in browser localStorage)
3. Note: You can also use Google OAuth if configured

### Step 3: Write a Reflection
1. Navigate to the reflection input page
2. Enter a test reflection, e.g.:
   ```
   very tired and irritated, didn't make much progress today
   ```
3. Submit the reflection

### Step 4: Watch Backend Process It
**In your terminal**, you should see:
```
📬 Queue length: 1
🔄 Processing refl_abc123
   Text: very tired and irritated, didn't make much progress today...
📊 Loaded 0 past reflections for sess_xyz789
🤖 Calling Ollama...
🔍 Calling Ollama API: http://localhost:11434/api/generate
   Model: phi3:latest
   Text preview: very tired and irritated, didn't make much progress today...
📝 Ollama raw response (17306ms): ...
✅ Ollama enrichment successful: 9 fields
📈 Running baseline analytics...
✅ Enriched refl_abc123 in 18234ms
📊 Total processed: 1
```

**Processing time**: ~18-20 seconds (CPU mode)

### Step 5: Verify Enrichment in Upstash

#### Option A: Check via Upstash Console
1. Go to **https://console.upstash.com/**
2. Select your Redis database
3. Click **"Data Browser"**
4. Search for key: `reflections:enriched:{rid}` (use the `rid` from terminal logs)
5. Verify the enriched data has all fields:
   - `final.invoked`, `final.expressed`, `final.wheel`
   - `congruence`, `temporal`, `willingness`
   - `comparator`, `recursion`, `state`, `quality`

#### Option B: Use Redis CLI
```powershell
# Install redis-cli or use Upstash REST API
curl https://YOUR_UPSTASH_REST_URL/get/reflections:enriched:refl_abc123 `
  -H "Authorization: Bearer YOUR_UPSTASH_TOKEN"
```

### Step 6: Verify in Frontend (If Implemented)
1. If your frontend polls for enriched data, you should see:
   - Emotion wheel visualization
   - Valence/arousal chart
   - Temporal trends
   - Event labels (fatigue, irritation, low_progress)

---

## 🔍 What to Verify

### ✅ Backend Processing
- [ ] Terminal shows "🔄 Processing {rid}"
- [ ] Ollama enrichment completes (~17-18 seconds)
- [ ] "✅ Enriched {rid} in XXXXms" appears
- [ ] No errors or timeouts

### ✅ Enriched Data Schema
Check that `reflections:enriched:{rid}` contains:

```json
{
  "rid": "refl_...",
  "sid": "sess_...",
  "timestamp": "2025-10-20T...",
  "normalized_text": "very tired and irritated...",
  
  "final": {
    "invoked": "fatigue + frustration",
    "expressed": "irritated / deflated",
    "wheel": {
      "primary": "anger",
      "secondary": "sadness"  // ✅ NEVER NULL
    },
    "valence": 0.41,
    "arousal": 0.58,
    "confidence": 0.75,
    "events": [
      {"label": "fatigue", "confidence": 0.75},
      {"label": "low_progress", "confidence": 0.7}
    ]
  },
  
  "congruence": 0.75,
  
  "temporal": {
    "ema": { "v_1d": 0.41, ... },
    "zscore": { "valence": null, ... },
    "circadian": { "phase": "afternoon", ... }
  },
  
  "willingness": { ... },
  "comparator": { ... },
  "recursion": { ... },
  "state": { ... },
  "quality": { ... },
  
  "provenance": {
    "baseline_version": "rules@v1",
    "ollama_model": "phi3:latest"
  },
  
  "meta": {
    "mode": "hybrid-local",
    "blend": 0.35,
    "ollama_latency_ms": 17306
  }
}
```

### ✅ Key Fields to Check
- [ ] `final.wheel.secondary` is **NEVER null** (we fixed this!)
- [ ] `final.invoked` and `final.expressed` are **NOT verbatim input**
- [ ] `congruence` is present (0.0 to 1.0)
- [ ] `temporal.ema` has all 6 values (v_1d, v_7d, v_28d, a_1d, a_7d, a_28d)
- [ ] `meta.mode` = "hybrid-local"
- [ ] `meta.blend` = 0.35
- [ ] `provenance.ollama_model` = "phi3:latest"

---

## 🐛 Troubleshooting

### Backend Not Processing
**Symptom**: No "🔄 Processing" logs appear  
**Causes**:
1. Backend not running → Run `.\start-backend.ps1`
2. Frontend not pushing to Redis → Check frontend code pushes to `reflections:normalized`
3. Redis credentials wrong → Check `enrichment-worker/.env`

### Ollama Timeout
**Symptom**: "⏱️ Ollama timeout after 30s"  
**Fix**: Increase timeout in `enrichment-worker/.env`:
```bash
OLLAMA_TIMEOUT=60
```

### wheel.secondary is null
**Status**: ✅ Should be FIXED (we updated baseline + Ollama)  
**If still null**: Check Ollama response in terminal logs, verify prompt update applied

### Enrichment Takes Too Long
**Expected**: 18-20 seconds on CPU mode  
**If longer**: Check CPU usage, close other apps, verify Ollama isn't queued

### Data Not in Upstash
**Causes**:
1. Backend failed to write → Check terminal for "✅ Enriched" message
2. Wrong Redis key → Verify key format: `reflections:enriched:{rid}`
3. Redis credentials expired → Regenerate in Upstash console

---

## 📊 Expected Performance

| Metric | Value |
|--------|-------|
| **Ollama Latency** | 17-18 seconds |
| **Total Processing** | 18-20 seconds |
| **Throughput** | ~3-4 reflections/minute |
| **Baseline Pass Rate** | 66% |
| **Hybrid Accuracy** | Higher (Ollama corrects baseline errors) |

---

## 🎯 Success Criteria

**You've successfully tested end-to-end when:**

✅ Backend processes reflection without errors  
✅ Enriched data appears in Upstash within 20 seconds  
✅ All schema fields are present and valid  
✅ `wheel.secondary` is NEVER null  
✅ `final.invoked` and `final.expressed` are meaningful labels  
✅ `congruence`, `temporal`, `willingness` are populated  
✅ Frontend displays enriched data (if polling implemented)

---

## 🚀 Next Steps After Testing

1. **Write more reflections** to test temporal analytics (EMAs, z-scores, streaks)
2. **Test edge cases** (very short text, Hinglish, voice input)
3. **Monitor latency** over time (should stay ~18-20s)
4. **Check for memory leaks** (backend should run stable for hours)
5. **Test with multiple users** (different session IDs)

---

## 📞 Need Help?

If enrichment isn't working:
1. Check backend terminal for errors
2. Verify Ollama is running: `http://localhost:11434/api/tags`
3. Test Redis connection: Check Upstash console
4. Review `COMPLETE_SETUP_GUIDE.md` for troubleshooting

---

**Happy testing!** 🎉

Remember: **Keep `start-backend.ps1` running** to enable enrichment. Without it, reflections are saved but NOT analyzed.
