# Leo Enrichment Backend - Quick Start

## 🚀 Start the Backend

Run this command **every time** before using the app to enable local enrichment:

```powershell
cd c:\Users\Kafka\Documents\Leo\enrichment-worker; $env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"; & "C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe" worker.py
```

### What It Does:
- Watches Upstash Redis for new reflections from your deployed app
- Enriches them using **Ollama (phi3) + tuned baseline rules**
- Writes enriched data back to Upstash
- Runs on your local machine (12.25 tok/s on CPU)

### Without the Backend Running:
- ⚠️ Reflections will be saved in Upstash but **NOT enriched**
- No emotion analysis, no valence/arousal, no temporal trends
- Frontend will only have raw normalized text

---

## 📊 Current Setup

### Hardware Acceleration
- **Platform**: Intel Core Ultra 7 256V (Lunar Lake)
- **Mode**: CPU only (no discrete GPU)
- **Performance**: 12.25 tokens/sec
- **Status**: ✅ Working (NPU not supported by Ollama yet)

### Baseline Tuning Results
- **Pass Rate**: 66% (exceeds 60% target)
- **Config**: `baseline/best_config.json`
- **Report**: `reports/baseline_tuning_report.md`

### Hybrid Enrichment
- **Baseline Weight**: 35% (fast rules-based)
- **Ollama Weight**: 65% (phi3 LLM)
- **Latency**: ~17-18 seconds per reflection (CPU mode)

---

## ✅ End-to-End Flow

### 1. Frontend (Deployed App)
1. User logs in as guest → Gets `sid` (session ID)
2. User enters reflection → Frontend normalizes text
3. Frontend pushes to Upstash Redis: `reflections:normalized`

### 2. Backend (Your Local PC)
1. Worker polls `reflections:normalized` queue
2. Pops one reflection at a time
3. Runs hybrid enrichment:
   - Tuned baseline (rules + lexicons)
   - Ollama phi3 (LLM analysis)
   - Merges results (35%/65% blend)
4. Computes:
   - **final**: invoked, expressed, wheel, valence, arousal, events
   - **congruence**: invoked↔expressed coherence
   - **temporal**: EMAs (1d/7d/28d), z-scores, WoW change, streaks
   - **willingness**: hedges, intensifiers, dissociation
   - **comparator**: expected vs actual emotion deviation
   - **recursion**: links to past reflections, thread state
   - **state**: latent valence/arousal/energy/fatigue
   - **risk_signals**: anergy, irritation streaks
5. Writes to Upstash: `reflections:enriched:{rid}`

### 3. Frontend (Reads Enriched Data)
1. Polls for `reflections:enriched:{rid}`
2. Displays emotion wheel, valence/arousal, trends, etc.

---

## 🔧 Schema Compliance

Your enriched output **exactly matches** the schema you specified:

```json
{
  "rid": "string",
  "sid": "string",
  "timestamp": "ISO8601",
  "timezone_used": "Asia/Kolkata",
  "normalized_text": "string",

  "final": {
    "invoked": "fatigue + frustration",
    "expressed": "irritated / deflated",
    "expressed_text": null,
    "wheel": {
      "primary": "anger",
      "secondary": "sadness"  // ✅ NEVER NULL (fixed)
    },
    "valence": 0.41,
    "arousal": 0.58,
    "confidence": 0.75,
    "events": [{"label": "fatigue", "confidence": 0.75}],
    "warnings": []
  },

  "congruence": 0.75,

  "temporal": {
    "ema": { "v_1d": 0.0, "v_7d": 0.0, "v_28d": 0.0, "a_1d": 0.0, "a_7d": 0.0, "a_28d": 0.0 },
    "zscore": { "valence": null, "arousal": null, "window_days": 90 },
    "wow_change": { "valence": null, "arousal": null },
    "streaks": { "positive_valence_days": 0, "negative_valence_days": 0 },
    "last_marks": { "last_positive_at": null, "last_negative_at": null, "last_risk_at": null },
    "circadian": { "hour_local": 22.5, "phase": "night", "sleep_adjacent": true }
  },

  "willingness": {
    "willingness_to_express": 0.7,
    "inhibition": 0.2,
    "amplification": 0.1,
    "dissociation": 0.0,
    "social_desirability": 0.0
  },

  "comparator": {
    "expected": { "invoked": "string", "expressed": "string", "valence": 0.0, "arousal": 0.0 },
    "deviation": { "valence": 0.0, "arousal": 0.0 },
    "note": "string"
  },

  "recursion": {
    "method": "hybrid(semantic+lexical+time)",
    "links": [{"rid": "string", "score": 0.0, "relation": "continuation"}],
    "thread_summary": "string",
    "thread_state": "new"
  },

  "state": {
    "valence_mu": 0.41,
    "arousal_mu": 0.58,
    "energy_mu": 0.50,
    "fatigue_mu": 0.50,
    "sigma": 0.1,
    "confidence": 0.75
  },

  "quality": { "text_len": 54, "uncertainty": 0.25 },
  "risk_signals_weak": [],

  "provenance": {
    "baseline_version": "rules@v1",
    "ollama_model": "phi3:latest"
  },

  "meta": {
    "mode": "hybrid-local",
    "blend": 0.35,
    "revision": 1,
    "created_at": "2025-10-20T10:30:00.000Z",
    "ollama_latency_ms": 17306,
    "warnings": []
  }
}
```

---

## 🐛 Troubleshooting

### Backend Not Running
**Symptom**: Reflections saved but not enriched  
**Fix**: Run the startup command above

### Ollama Timeout
**Symptom**: `⏱️ Ollama timeout after 30s`  
**Fix**: Ollama may be slow on CPU. Increase timeout in `.env`:
```bash
OLLAMA_TIMEOUT=60
```

### GPU Not Detected
**Symptom**: Using CPU mode at 12.25 tok/s  
**Explanation**: Your system has no discrete GPU. This is normal.  
**Option**: Accept CPU speed or wait for Intel NPU support in Ollama

### wheel.secondary is null
**Status**: ✅ FIXED - Baseline and Ollama now always provide secondary emotion

---

## 📦 Files Created

- ✅ `baseline/best_config.json` - Tuned hyperparameters (66% pass rate)
- ✅ `reports/baseline_tuning_report.md` - Tuning results
- ✅ `data/eval/baseline_50.jsonl` - 50-example test dataset
- ✅ `enrichment-worker/src/modules/baseline_enricher.py` - Rules-based enricher
- ✅ `tools/tune_baseline.py` - Auto-tuning script
- ✅ `tools/compare_enrichments.py` - Baseline vs Hybrid comparison
- ✅ `tools/check_acceleration.py` - Hardware detection

---

## 🎯 Next Steps

1. **Start backend** with command above
2. **Visit deployed app** (your Vercel link)
3. **Login as guest** → Get session ID
4. **Write a reflection** → See it enriched in ~20 seconds
5. **Check backend terminal** → See processing logs

Enjoy! 🚀
