# Agent Mode Scorer - Integration Guide

## Quick Start (5 minutes)

### Step 1: Add Feature Flag to `.env`

```bash
# enrichment-worker/.env
USE_AGENT_MODE=true    # Set to 'false' to use hybrid_scorer (default)
```

### Step 2: Update `worker.py` (Minimal Changes)

**Option A: Simple Replacement (Recommended for Testing)**

Replace lines 30-37 in `worker.py`:

```python
# BEFORE:
from src.modules.hybrid_scorer import HybridScorer

ollama_client = HybridScorer(
    hf_token=os.getenv('HF_TOKEN'),
    ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    use_ollama=True
)

# AFTER:
import os
USE_AGENT_MODE = os.getenv('USE_AGENT_MODE', 'false').lower() == 'true'

if USE_AGENT_MODE:
    from src.modules.agent_mode_scorer import AgentModeScorer
    ollama_client = AgentModeScorer(
        hf_token=os.getenv('HF_TOKEN'),
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        timezone=TIMEZONE
    )
    print(f"[*] Using Agent Mode Scorer (execute-once)")
else:
    from src.modules.hybrid_scorer import HybridScorer
    ollama_client = HybridScorer(
        hf_token=os.getenv('HF_TOKEN'),
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        use_ollama=True
    )
    print(f"[*] Using Hybrid Scorer (continuous)")
```

### Step 3: Update `process_reflection()` to Pass `prev_reflection`

Around line 70 in `worker.py`, modify the `enrich()` call:

```python
# BEFORE:
history = redis_client.get_user_history(sid, limit=90)
ollama_result = ollama_client.enrich(normalized_text, history, timestamp)

# AFTER:
history = redis_client.get_user_history(sid, limit=90)
prev_reflection = history[0] if history else None

if USE_AGENT_MODE:
    # Agent Mode: pass reflection dict + prev_reflection
    ollama_result = ollama_client.enrich(
        reflection={
            'rid': rid,
            'sid': sid,
            'normalized_text': normalized_text,
            'timestamp': timestamp,
            'timezone_used': TIMEZONE
        },
        prev_reflection=prev_reflection,
        history=history
    )
else:
    # Hybrid Scorer: legacy API
    ollama_result = ollama_client.enrich(normalized_text, history, timestamp)
```

### Step 4: Test

```bash
cd enrichment-worker
python test_agent_mode.py
```

Expected output:
```
✅ Test 1: Old playlist → Sad → longing → nostalgic
✅ Test 2: Short text → Minimal enrichment
✅ Test 3: Multi-word phrases → Single tokens
✅ Test 4: Temporal WoW change computed
```

### Step 5: Restart Worker

```bash
# Stop existing worker
# Ctrl+C in terminal running worker.py

# Start with Agent Mode
python worker.py
```

Look for this line in startup logs:
```
[*] Using Agent Mode Scorer (execute-once)
```

### Step 6: Monitor

Watch for these metrics in logs:

```
[AGENT MODE] Execute-Once Enrichment Pipeline
[1/9] Pre-checks PASSED
[2/9] Language: en
[3/9] Calling hybrid scorer...
[4/9] Validating Willcox wheel: Sad → longing → nostalgic
[5/9] Enforcing single-token labels...
[6/9] Valence/Arousal calibration (delegated to hybrid scorer)
[7/9] Computing temporal continuity...
[8/9] Stage-2 enrichment (poems/tips/closing)...
[9/9] Final validation...

[OK] Agent Mode enrichment complete in 3240ms (attempt 1)
```

---

## Rollback Plan

If issues occur, immediately set:

```bash
USE_AGENT_MODE=false
```

Restart worker → reverts to hybrid_scorer with zero code changes.

---

## What to Watch For

### ✅ Good Signs
- `attempts: 1` in most reflections (90%+)
- `ood_penalty_applied: 0.0` in most reflections
- Latency <5s p95
- No multi-word tokens in invoked/expressed/events

### ⚠️ Warning Signs
- `attempts: 2` frequently (>10%) → Ollama returning OOD labels
- Latency >6s p95 → Retries slowing down pipeline
- Many minimal enrichments → Text length threshold too high

### 🚨 Critical Issues
- Worker crashes → Check Ollama availability
- NULL temporal fields → prev_reflection not passed correctly
- Multi-word tokens still appearing → Sanitization not working

---

## Advanced: Gradual Rollout

Use `sid` hash for percentage rollout:

```python
import hashlib

def should_use_agent_mode(sid: str, percentage: int = 10) -> bool:
    """Roll out Agent Mode to percentage% of users"""
    hash_val = int(hashlib.md5(sid.encode()).hexdigest()[:8], 16)
    return (hash_val % 100) < percentage

# In process_reflection():
use_agent = should_use_agent_mode(sid, percentage=10)  # 10% rollout

if use_agent:
    ollama_result = agent_mode_scorer.enrich(...)
else:
    ollama_result = hybrid_scorer.enrich(...)
```

Start with 10% → monitor for 24h → increase to 50% → 100%.

---

## Configuration Options

```bash
# .env options for Agent Mode
USE_AGENT_MODE=true              # Enable/disable
AGENT_MODE_MIN_LENGTH=12         # Min text length (default: 12)
AGENT_MODE_EN_THRESHOLD=0.15     # EN detection threshold
AGENT_MODE_MAX_RETRIES=2         # Max validation retries
```

Currently these are hardcoded in `agent_mode_scorer.py` but can be moved to env vars if needed.

---

## Next Steps

1. ✅ **Test locally** with `test_agent_mode.py`
2. ✅ **Deploy to staging** with `USE_AGENT_MODE=true`
3. ✅ **Monitor logs** for 24h (check retry rates, latency)
4. ✅ **Compare outputs** with hybrid_scorer (sample 100 reflections)
5. ✅ **Production rollout** at 10% → 50% → 100%
6. ✅ **Remove feature flag** once stable (Week 3)

---

Questions? See `AGENT_MODE_SCORER_README.md` for full documentation.
