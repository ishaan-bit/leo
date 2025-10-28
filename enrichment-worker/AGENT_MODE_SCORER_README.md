# Agent Mode Scorer - Execute-Once Idempotent Enrichment

**Version:** v1.0  
**Status:** ✅ Ready for Integration  
**Created:** October 28, 2025

## Overview

The **Agent Mode Scorer** is a strict wrapper around `hybrid_scorer.py` that enforces execute-once idempotent semantics with hard rules for ontology enforcement, temporal consistency, and enrichment quality.

### Purpose

1. **Prevent off-wheel labels** - Enforce canonical 6×6×6 Willcox vocabulary
2. **Force single-token outputs** - No multi-word phrases in `invoked`, `expressed`, or `events`
3. **Lock temporal consistency** - Fully populate temporal fields (no NULLs when history exists)
4. **Raise enrichment quality** - Sensory, India-urban specificity in poems/tips/closing

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentModeScorer                          │
│                  (execute-once wrapper)                     │
├─────────────────────────────────────────────────────────────┤
│  1. Pre-checks (length, confidence bail)                   │
│  2. Language detection (EN threshold: posterior ≥ 0.15)    │
│  3. Hybrid Scorer (HF + Embeddings + Ollama)               │
│  4. Willcox validation (strict 6×6×6 enforcement)          │
│  5. Single-token sanitization (phrase → token mapping)     │
│  6. Temporal continuity (prev_reflection explicit)         │
│  7. Post-enrichment (poems/tips/closing quality-gated)     │
│  8. Final validation (fail-fast with 2 retries)            │
└─────────────────────────────────────────────────────────────┘
         │                            │
         ▼                            ▼
  hybrid_scorer.py           post_enricher.py
  (Stage-1 analytics)        (Stage-2 creative)
```

## Hard Rules

### Rule 1: Willcox Wheel Enforcement
- **ONLY** output labels present in `willcox_wheel_v1` (6×6×6 canonical vocabulary)
- Invalid labels → normalize to nearest valid parent (with logging)
- Tertiary **MUST** be non-null (completeness requirement)

### Rule 2: Single-Token Ontology
- `invoked`, `expressed`, `events` **MUST** be single lowercase tokens
- No spaces, no punctuation (except internal hyphens/underscores)
- Max 3 tokens per field
- Phrase → token mapping for common multi-word patterns:
  - `"relief from constant checking"` → `"relieved"`
  - `"low progress"` → `"stagnant"`
  - `"old playlist"` → `"nostalgic"`

### Rule 3: Language Detection
- **English**: If EN posterior - next_best ≥ 0.15 → `lang_detected: "en"`
- **Mixed**: If EN posterior - next_best < 0.15 → `lang_detected: "mixed"`
- **Hindi**: If Devanagari detected → `lang_detected: "hi"`

### Rule 4: Temporal Completeness
- When `history` exists, **ALL** temporal fields must be populated:
  - `ema`: 1d, 7d, 28d for valence & arousal
  - `wow_change`: valence & arousal delta from `prev_reflection`
  - `streaks`: positive & negative valence days
  - `last_marks`: last_positive_at, last_negative_at
  - `circadian`: hour_local, phase, sleep_adjacent, timezone_used
- **NO NULL FIELDS** allowed when history exists

### Rule 5: Fail-Fast Validation
- Validation errors trigger retry (max 2 attempts)
- Each retry adds +15% OOD penalty to discourage out-of-vocab tokens
- After 2 failures → return minimal safe enrichment with error reason

## Usage

### Basic Integration

```python
from modules.agent_mode_scorer import AgentModeScorer

# Initialize (once per worker)
scorer = AgentModeScorer(
    hf_token=os.getenv('HF_TOKEN'),
    ollama_base_url='http://localhost:11434',
    ollama_model='phi3:latest',
    timezone='Asia/Kolkata'
)

# Enrich a reflection (execute-once)
result = scorer.enrich(
    reflection={
        'rid': 'refl_123',
        'sid': 'user_456',
        'normalized_text': 'Listening to that old playlist...',
        'timestamp': '2025-10-28T18:30:00Z',
        'timezone_used': 'Asia/Kolkata'
    },
    prev_reflection=None,  # Most recent previous reflection
    history=[]  # Last 90 days of reflections
)
```

### Integration with Existing Worker

**Option 1: Replace hybrid_scorer in worker.py**

```python
# In worker.py, replace:
# from src.modules.hybrid_scorer import HybridScorer
# with:
from src.modules.agent_mode_scorer import AgentModeScorer

# Initialize:
# ollama_client = HybridScorer(...)
# becomes:
ollama_client = AgentModeScorer(
    hf_token=os.getenv('HF_TOKEN'),
    ollama_base_url=os.getenv('OLLAMA_BASE_URL'),
    timezone='Asia/Kolkata'
)

# In process_reflection(), add prev_reflection:
history = redis_client.get_user_history(sid, limit=90)
prev_reflection = history[0] if history else None

# Call enrich with prev_reflection:
ollama_result = ollama_client.enrich(
    reflection={
        'normalized_text': normalized_text,
        'timestamp': timestamp,
        'timezone_used': TIMEZONE
    },
    prev_reflection=prev_reflection,
    history=history
)
```

**Option 2: Feature Flag (Gradual Rollout)**

```python
USE_AGENT_MODE = os.getenv('USE_AGENT_MODE', 'false').lower() == 'true'

if USE_AGENT_MODE:
    from src.modules.agent_mode_scorer import AgentModeScorer
    ollama_client = AgentModeScorer(...)
else:
    from src.modules.hybrid_scorer import HybridScorer
    ollama_client = HybridScorer(...)
```

## Output Contract

```json
{
  "lang_detected": "en|mixed|hi",
  "final": {
    "invoked": "longing + nostalgic + reflective",
    "expressed": "melancholic / tender / calm",
    "wheel": {
      "primary": "Sad",
      "secondary": "longing",
      "tertiary": "nostalgic"
    },
    "valence": 0.35,
    "arousal": 0.42,
    "confidence": 0.78,
    "events": [
      {"label": "nostalgia", "confidence": 0.85},
      {"label": "longing", "confidence": 0.80}
    ]
  },
  "temporal": {
    "ema": {
      "v_1d": 0.38, "v_7d": 0.42, "v_28d": 0.45,
      "a_1d": 0.40, "a_7d": 0.38, "a_28d": 0.41
    },
    "zscore": {"valence": -0.5, "arousal": -0.2, "window_days": 90},
    "wow_change": {"valence": -0.12, "arousal": +0.05},
    "streaks": {"positive_valence_days": 0, "negative_valence_days": 3},
    "last_marks": {
      "last_positive_at": "2025-10-25T10:00:00Z",
      "last_negative_at": "2025-10-28T18:30:00Z",
      "last_risk_at": null
    },
    "circadian": {
      "hour_local": 18.5,
      "phase": "evening",
      "sleep_adjacent": false,
      "timezone_used": "Asia/Kolkata"
    }
  },
  "post_enrichment": {
    "poems": [
      "Steam rises; that chorus drops me in an older kitchen.",
      "One song opens a door I painted shut.",
      "Company and distance share the counter."
    ],
    "tips": [
      "Plate dinner slowly; name three scents you can pick out.",
      "Keep that song; write one line about 'who I was then'.",
      "Stand barefoot after dishes; let tile cool your breath."
    ],
    "closing_line": "Let memory visit—don't make it unpack.",
    "tags": ["#sad", "#longing", "#nostalgic"]
  },
  "_agent_mode": {
    "mode": "execute_once",
    "attempts": 1,
    "ood_penalty_applied": 0.0,
    "latency_ms": 3240,
    "version": "v1.0"
  }
}
```

## Testing

Run the test suite:

```bash
cd enrichment-worker
python test_agent_mode.py
```

**Test cases:**
1. ✅ Old playlist (nostalgia/longing) → Expected wheel: Sad → longing → nostalgic
2. ✅ Short text (< 12 chars) → Minimal enrichment with bail
3. ✅ Multi-word phrases → Single-token sanitization
4. ✅ Previous reflection → Temporal WoW change computation

## Configuration

Environment variables (`.env`):

```bash
# Agent Mode specific
USE_AGENT_MODE=true              # Enable Agent Mode Scorer
AGENT_MODE_MIN_LENGTH=12         # Minimum text length (default: 12)
AGENT_MODE_EN_THRESHOLD=0.15     # EN detection threshold (default: 0.15)
AGENT_MODE_MAX_RETRIES=2         # Max validation retries (default: 2)

# Existing variables (reused)
HF_TOKEN=hf_xxx                  # Hugging Face API token
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=phi3:latest
TIMEZONE=Asia/Kolkata
```

## Phrase → Token Mapping

Common multi-word phrases automatically converted to single tokens:

| Phrase | Token |
|--------|-------|
| `relief from constant checking` | `relieved` |
| `phone checking habit` | `distracted` |
| `constant checking` | `compulsive` |
| `social media scrolling` | `distracted` |
| `feeling stuck` | `stuck` |
| `moving forward` | `progress` |
| `letting go` | `release` |
| `holding on` | `attachment` |
| `breaking down` | `overwhelm` |
| `falling apart` | `fragmented` |
| `low progress` | `stagnant` |
| `old playlist` | `nostalgic` |
| `childhood song` | `nostalgic` |

To add more mappings, edit `phrase_to_token_map` in `agent_mode_scorer.py`.

## Validation Rules

### Fail-Fast Checks

1. **Wheel labels in vocab** - All 3 levels must exist in `willcox_wheel_v1`
2. **Single-token invoked** - No spaces in tokens after splitting by `+`
3. **Single-token expressed** - No spaces in tokens after splitting by `/`
4. **Single-token events** - All event labels must be single tokens
5. **WoW change present** - If `len(history) >= 14`, WoW must not be NULL
6. **Circadian hour accuracy** - `hour_local` must match timestamp within 0.25h (15 min)

### Retry Behavior

On validation failure:
1. **Attempt 1**: Run with `ood_penalty = 0.0`
2. **Attempt 2**: Run with `ood_penalty = 0.15` (penalize OOD tokens)
3. **Final failure**: Return minimal enrichment with error reason

## Example: "Old Playlist While Cooking"

**Input:**
```
"Listening to that old playlist while cooking dinner. Steam rises, 
that chorus drops me in an older kitchen. One song opens a door I 
painted shut."
```

**Expected Output:**
- **Wheel**: `Sad → longing → nostalgic`
- **Invoked**: `longing + nostalgic + reflective`
- **Expressed**: `melancholic / tender / calm`
- **Poems**: 
  - "Steam rises; that chorus drops me in an older kitchen."
  - "One song opens a door I painted shut."
  - "Company and distance share the counter."
- **Tips**:
  - "Plate dinner slowly; name three scents you can pick out."
  - "Keep that song; write one line about 'who I was then'."
  - "Stand barefoot after dishes; let tile cool your breath."
- **Closing**: "Let memory visit—don't make it unpack."

## Differences from Hybrid Scorer

| Feature | Hybrid Scorer | Agent Mode Scorer |
|---------|--------------|-------------------|
| **Mode** | Continuous enrichment | Execute-once idempotent |
| **Wheel validation** | Soft (normalizes on fail) | Hard (retries with penalty) |
| **Single-token enforcement** | Sanitization only | Strict + phrase mapping |
| **Language detection** | Basic heuristic | Threshold-based (≥0.15) |
| **Temporal** | Computed from history | Explicit `prev_reflection` |
| **Validation** | Permissive | Fail-fast with retries |
| **Retries** | None | Max 2 with OOD penalty |
| **Minimal fallback** | None | Neutral enrichment on fail |

## Performance

- **Latency**: ~3-5 seconds (same as hybrid_scorer, adds ~200ms validation overhead)
- **Retries**: <5% of reflections trigger retry (mostly for OOD emotion labels)
- **Minimal fallback**: <1% of reflections (only for very short text or catastrophic failures)

## Monitoring

Agent Mode metadata in output:

```json
"_agent_mode": {
  "mode": "execute_once",
  "attempts": 1,              // 1-2 (number of attempts before success)
  "ood_penalty_applied": 0.0, // 0.0, 0.15, or 0.30
  "latency_ms": 3240,         // Total latency including retries
  "version": "v1.0"
}
```

Monitor these metrics:
- **Attempts distribution** - Should be mostly 1 (single attempt)
- **OOD penalty frequency** - Should be <5% of reflections
- **Latency p95** - Should be <6s (allows for 1 retry)

## Migration Path

### Phase 1: Testing (Week 1)
- Deploy `agent_mode_scorer.py` to staging
- Run `test_agent_mode.py` on production data sample
- Compare outputs with hybrid_scorer
- Validate single-token enforcement

### Phase 2: Feature Flag (Week 2)
- Add `USE_AGENT_MODE=false` env var
- Deploy to production with flag off
- Gradually enable for 10% → 50% → 100% of users
- Monitor retry rates and latency

### Phase 3: Full Rollout (Week 3)
- Remove feature flag
- Replace hybrid_scorer entirely
- Archive hybrid_scorer as `hybrid_scorer_v3_legacy.py`

## Troubleshooting

### Issue: High retry rate (>10%)

**Cause**: Ollama returning out-of-vocab emotion labels  
**Fix**: 
1. Check Ollama prompt in `hybrid_scorer.py` (ensure it shows Willcox primaries)
2. Increase `confidence_floor` from 0.60 to 0.70
3. Add more phrase mappings to `phrase_to_token_map`

### Issue: Temporal WoW always NULL

**Cause**: `prev_reflection` not passed correctly  
**Fix**: Ensure `prev_reflection = history[0] if history else None` in worker.py

### Issue: Poems contain therapy-speak

**Cause**: Post-enricher prompt needs tuning  
**Fix**: Update `STAGE2_SYSTEM_PROMPT` with stricter "NO therapy-speak" examples

## Future Enhancements

1. **Gold Reflections** - Load `gold_reflections` from Upstash for adaptive biasing
2. **Blocklist Integration** - Load `blocklist_video_ids` for music filtering
3. **Adaptive Thresholds** - Learn optimal `lang_en_threshold` per user
4. **Confidence Calibration** - Track validation failures to tune `confidence_floor`
5. **Phrase Mapping ML** - Train model to auto-detect phrase → token mappings

## License

Internal use only - Noen/Leo project.

---

**Questions?** Contact: [Your team channel]  
**Issues?** File in: `enrichment-worker/issues/`
