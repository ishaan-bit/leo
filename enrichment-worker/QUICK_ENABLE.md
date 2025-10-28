# Agent Mode - Quick Enable Guide

## 🚀 Enable Agent Mode (30 seconds)

### Step 1: Update `.env`
```bash
# In enrichment-worker/.env, change:
USE_AGENT_MODE=true
```

### Step 2: Restart Worker
```bash
cd enrichment-worker
python worker.py
```

### Step 3: Verify
Look for this line in startup logs:
```
[*] Initializing Agent Mode Scorer (execute-once idempotent)
```

✅ **Done!** Agent Mode is now active.

---

## 🔄 Rollback (Instant)

```bash
# In .env:
USE_AGENT_MODE=false
```

Restart worker → back to Hybrid Scorer.

---

## 📊 What to Monitor

### Good Signs ✅
- `[AGENT MODE] Execute-Once Enrichment Pipeline` in logs
- `[OK] Agent Mode enrichment complete in XXXXms (attempt 1)`
- `[OK] Agent Mode validated: sad → lonely → nostalgic`
- Latency: 3-5 seconds per reflection
- Attempts: 1 (90%+ of reflections)

### Warning Signs ⚠️
- `(attempt 2)` frequently (>10%) → Ollama returning OOD labels
- Latency >6 seconds → Retries slowing pipeline
- `[!] Returning minimal enrichment` → Check text length threshold

### Critical Issues 🚨
- Worker crashes → Check Ollama availability
- Multi-word tokens appearing → Check sanitization logs
- `ood_penalty_applied: 0.30` → Validation failing repeatedly

---

## 📝 Test Cases (Before Production)

Run test suite:
```bash
cd enrichment-worker
python test_agent_mode.py
```

Expected output:
```
✅ Test 1: Old playlist → sad/lonely/isolated
✅ Test 2: Short text → minimal enrichment
✅ Test 3: Multi-word phrases → single tokens
✅ Test 4: WoW change computed
```

---

## 🔍 Log Samples

### Normal Agent Mode Processing
```
[AGENT MODE] Execute-Once Enrichment Pipeline
[1/9] Pre-checks PASSED
[2/9] Language: en
[3/9] Calling hybrid scorer...
[4/9] Validating Willcox wheel: sad → lonely → nostalgic
[5/9] Enforcing single-token labels...
[6/9] Valence/Arousal calibration (delegated to hybrid scorer)
[7/9] Computing temporal continuity...
[8/9] Stage-2 enrichment (poems/tips/closing)...
[9/9] Final validation...
[OK] Agent Mode enrichment complete in 3240ms (attempt 1)
```

### Hybrid Scorer (Old Mode)
```
[*] Stage-1: Hybrid Scorer...
[*] Validating emotions...
[OK] Emotion valid: sad -> lonely -> nostalgic
```

---

## 🎯 Key Differences

| Feature | Hybrid Scorer | Agent Mode |
|---------|--------------|------------|
| **Mode** | Continuous | Execute-once ✨ |
| **Validation** | Soft | Hard with retries ✨ |
| **Single-token** | Sanitization | Phrase mapping ✨ |
| **Temporal** | History-based | prev_reflection ✨ |
| **Fallback** | None | Minimal enrichment ✨ |

---

## 🛠️ Configuration

Current settings (hardcoded in `agent_mode_scorer.py`):
- **Min text length**: 12 chars
- **EN threshold**: 0.15 (posterior - next_best)
- **Max retries**: 2
- **OOD penalty**: +15% per retry

To customize, edit `agent_mode_scorer.py` lines 78-83.

---

## 📚 Full Documentation

- **README**: `enrichment-worker/AGENT_MODE_SCORER_README.md`
- **Integration**: `enrichment-worker/INTEGRATION_GUIDE.md`
- **Summary**: `enrichment-worker/AGENT_MODE_COMPLETE.md`

---

## 🆘 Support

**Issue**: Worker won't start
- Check: `USE_AGENT_MODE` spelling in .env (case-sensitive)
- Check: Ollama running on port 11434
- Check: HF_TOKEN valid in .env

**Issue**: All reflections getting minimal enrichment
- Check: Text length >12 chars
- Check: Ollama model loaded (`phi3:latest`)
- Check: HF API not rate-limited

**Issue**: Validation errors
- Check: `willcox_wheel.json` exists in `src/data/`
- Check: Emotion triplets in canonical vocab
- Run: `python test_agent_mode.py` to validate setup

---

**Current Status**: ✅ Integrated, tested, ready for production  
**Last Updated**: October 28, 2025
