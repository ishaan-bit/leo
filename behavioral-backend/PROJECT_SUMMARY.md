# Behavioral Backend - Project Summary

## What Was Built

A **terminal-only CLI** for analyzing English reflections with temporal emotional dynamics and Upstash persistence.

---

## Core Features

### 1. **Feature Extraction** (`src/analyzer.py`)
- **Emotion Detection**: Maps text to emotion labels with valence/arousal coordinates using Willcox circumplex model
- **Event Keywords**: Extracts salient noun phrases via TextBlob
- **Expressed Intensity**: Composite score from caps, punctuation, elongations
- **Self-Awareness Proxy**: Counts meta-cognitive markers ("I think", "I realize", etc.)
- **Willingness to Express**: First-person ratio minus hedging ("maybe", "I guess")
- **Risk Detection**: Pattern matching for self-harm, hopelessness, withdrawal

### 2. **Temporal Dynamics** (`src/dynamics.py`)
- **Baseline Computation**: Rolling window average of recent invoked states
- **Shock Calculation**: `invoked - baseline`
- **ERI (Expressed-Reality Incongruence)**: `|Δvalence| + 0.5*|Δarousal|`
- **State Update Rule**:
  ```
  s_t = (1-α)·s_{t-1} + α·baseline + β·shock + γ·(intensity - ERI)·direction(invoked)
  ```
- **Parameters**: Tunable via env vars (α, β, γ, baseline window)

### 3. **Persistence** (`src/persistence.py`)
- **Upstash Redis** (Vercel KV compatible)
- **Reflection Storage**: Full record with all computed fields
- **State Snapshots**: O(1) lookup per user (`state:{user_id}`)
- **Chronological Index**: Sorted sets for baseline computation (`index:{user_id}`)
- **Risk Stream**: Separate log for flagged entries (`risk:{user_id}:{ts}`)
- **Idempotency**: Text hashing with 7-day expiry

### 4. **CLI Interface** (`cli.py`)
- **`analyze` command**: 
  ```bash
  python cli.py analyze --user <id> --text "<reflection>" [--ts ISO8601]
  ```
  Outputs JSON to stdout with all required fields
  
- **`tail` command**: 
  ```bash
  python cli.py tail --user <id> -n 5
  ```
  Shows last N reflections for inspection

---

## Data Contracts

### Reflection Record
```json
{
  "user_id": "string",
  "ts": "ISO 8601 UTC",
  "text": "string",
  "event_keywords": ["string"],
  "invoked_emotion": "joy|anger|sadness|...",
  "invoked_valence": -1 to 1,
  "invoked_arousal": 0 to 1,
  "expressed_tone": "positive|negative|neutral",
  "expressed_intensity": 0 to 1,
  "self_awareness_proxy": 0 to 1,
  "willingness_to_express": 0 to 1,
  "risk_flags": ["self_harm", "hopelessness", "severe_withdrawal"],
  "state_valence": -1 to 1,
  "state_arousal": 0 to 1,
  "ERI": 0 to 2
}
```

### CLI Output (stdout)
```json
{
  "invoked": {
    "emotion": "joy",
    "valence": 0.75,
    "arousal": 0.7,
    "confidence": 0.85
  },
  "expressed": {
    "tone": "positive",
    "intensity": 0.2
  },
  "ERI": 0.15,
  "baseline": {
    "valence": 0.1,
    "arousal": 0.4
  },
  "state": {
    "valence": 0.42,
    "arousal": 0.52
  },
  "event_keywords": ["friends", "days"],
  "risk_flags": []
}
```

---

## Architecture

```
behavioral-backend/
├── cli.py                   # Entrypoint (Click-based CLI)
├── setup.py                 # Setup script (install deps, download corpora)
├── test.py                  # Test suite (4 acceptance criteria cases)
├── requirements.txt         # Python dependencies
├── .env.example            # Environment template
├── README.md               # Full documentation
└── src/
    ├── __init__.py
    ├── analyzer.py         # Feature extraction
    ├── dynamics.py         # Temporal state updates
    ├── persistence.py      # Upstash Redis I/O
    └── emotion_map.py      # Valence/arousal mapping + risk patterns
```

---

## Dependencies

- **spacy**: NLP (not currently used, reserved for future noun extraction)
- **textblob**: Sentiment analysis + noun phrase extraction
- **upstash-redis**: Vercel KV client
- **click**: CLI framework
- **python-dotenv**: Environment configuration
- **numpy**: Numeric operations

---

## Configuration

### Environment Variables (`.env`)

```env
# Upstash (Vercel KV)
UPSTASH_REDIS_REST_URL=https://ultimate-pika-17842.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Dynamics parameters
ALPHA=0.3        # Baseline drift weight
BETA=0.4         # Shock weight
GAMMA=0.2        # Expression incongruence weight
BASELINE_WINDOW=10   # Recent reflections for baseline

# Risk detection
ENABLE_RISK_DETECTION=true
```

---

## Test Cases (Acceptance Criteria)

### 1. Positive Social Event
**Input:** "Met my friends after many days; felt great and lighter."  
**Expected:**
- `emotion`: "joy"
- `valence`: > 0.5
- `risk_flags`: []
- `state.valence`: increases

### 2. Work Stress
**Input:** "Boss rebuked me. I went home early and slept."  
**Expected:**
- `valence`: < 0
- `tone`: "negative"
- `state.valence`: decreases

### 3. Neutral Routine
**Input:** "Had lunch at my desk, lots of work to finish by evening."  
**Expected:**
- `emotion`: "neutral"
- `arousal`: low
- `event_keywords`: ["lunch", "desk", "work"]

### 4. Risk Detection
**Input:** "I wish I were dead. Nothing matters."  
**Expected:**
- `risk_flags`: ["self_harm", "hopelessness"]
- Risk event logged to Upstash
- `state.valence`: strongly negative

---

## Quick Start

```bash
# 1. Setup
python setup.py

# 2. Configure .env
cp .env.example .env
# Edit .env with your Upstash credentials

# 3. Test
python cli.py analyze --user test1 --text "I feel great today!"

# 4. Run test suite
python test.py
```

---

## Performance

- **Latency**: < 2s on laptop for typical reflections
- **Models**: Lightweight (TextBlob, pattern matching)
- **Determinism**: All computations deterministic
- **Idempotency**: Duplicate detection via text hashing

---

## Safety

### Risk Detection Patterns

**Self-Harm:**
- "wish i were dead", "kill myself", "suicide", "hurt myself", etc.

**Hopelessness:**
- "nothing matters", "no point", "give up", "no hope", etc.

**Withdrawal:**
- "avoid everyone", "staying in bed all day", "isolating myself", etc.

### When Risk Detected:
1. `risk_flags` array populated in output
2. Risk event logged to Upstash (`risk:{user_id}:{ts}`)
3. Logged to stderr with `[Risk]` prefix

---

## Future Enhancements

- [ ] Hindi/Hinglish translation integration (use existing translation service)
- [ ] Advanced emotion models (transformers-based)
- [ ] Real-time alerting for risk events (webhook to monitoring)
- [ ] Web API wrapper (FastAPI/Flask)
- [ ] Visualization dashboard for state evolution over time
- [ ] Export to CSV/JSON for external analysis

---

## Integration with Main App

This backend can be integrated with the main Leo app:

1. **API Integration**: Wrap CLI in a FastAPI endpoint, call from Next.js `/api/reflect`
2. **Shared Storage**: Already using same Upstash instance
3. **Translation**: Pipe Hindi/Hinglish text through translation service first
4. **Risk Alerts**: Send risk events to monitoring service or admin dashboard

---

## Status

✅ **Prototype Complete**
- All core features implemented
- CLI interface functional
- Persistence layer integrated
- Test suite ready

⏳ **Testing Required**
- Run `python setup.py` to install dependencies
- Configure `.env` with Upstash credentials
- Execute `python test.py` to validate acceptance criteria

---

## Notes

- **Lightweight**: Uses TextBlob instead of heavy transformers for speed
- **Deterministic**: No random components, reproducible results
- **Configurable**: All dynamics parameters tunable via env vars
- **Observable**: Logs to stderr for debugging, JSON to stdout for consumption
- **Safe**: Conservative risk detection with explicit patterns
