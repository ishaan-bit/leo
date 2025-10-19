# Behavioral Backend

**Terminal-only CLI** for ingesting English reflections, computing behavioral signals with temporal dynamics, and persisting to Upstash (Vercel KV).

---

## Features

- **Feature Extraction**: Emotion detection, event keywords, expressed intensity, self-awareness, willingness to express, risk detection
- **Temporal Dynamics**: Recursive state updates with baseline drift, shock, and expression incongruence (ERI)
- **Persistence**: Upstash Redis for reflections, state snapshots, and risk event logging
- **CLI Interface**: Simple `analyze` command with JSON output
- **Idempotency**: Duplicate detection via text hashing

---

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
python -m textblob.download_corpora
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your Upstash credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```env
UPSTASH_REDIS_REST_URL=https://ultimate-pika-17842.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here

# Dynamics parameters (0-1 range)
ALPHA=0.3        # Weight for baseline drift
BETA=0.4         # Weight for shock (event impact)
GAMMA=0.2        # Weight for expression incongruence

# Baseline computation
BASELINE_WINDOW=10   # Number of recent reflections for baseline

# Risk detection
ENABLE_RISK_DETECTION=true
```

### 3. Make CLI Executable

```bash
chmod +x cli.py
```

---

## Usage

### Analyze a Reflection

```bash
python cli.py analyze --user user123 --text "Met my friends after many days; felt great and lighter."
```

**Output (stdout):**
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

### With Custom Timestamp

```bash
python cli.py analyze --user user123 --text "Had lunch at my desk." --ts "2025-01-15T12:30:00Z"
```

### View Last N Reflections (tail command)

```bash
python cli.py tail --user user123 -n 5
```

**Output:**
```json
{
  "user_id": "user123",
  "count": 5,
  "reflections": [
    {
      "ts": "2025-01-15T10:00:00Z",
      "text": "Met my friends...",
      "emotion": "joy",
      "state": {"v": 0.42, "a": 0.52},
      "risk_flags": []
    }
  ]
}
```

---

## Output Fields

### `invoked` (Detected Emotion)
- `emotion`: Emotion label (joy, anger, sadness, etc.)
- `valence`: -1 (negative) to +1 (positive)
- `arousal`: 0 (calm) to 1 (activated)
- `confidence`: 0 to 1 (sentiment subjectivity proxy)

### `expressed` (How User Communicates)
- `tone`: "positive", "negative", or "neutral"
- `intensity`: 0 to 1 (caps, exclamations, elongations)

### `ERI` (Expressed-Reality Incongruence)
Mismatch between invoked emotion and expressed tone/intensity.  
Formula: `|Δvalence| + 0.5*|Δarousal|`

### `baseline` (Natural Feelings Cycle)
Average valence/arousal from last N reflections (rolling window).

### `state` (Current Emotional State)
Recursive state updated via:  
`s_t = (1-α)·s_{t-1} + α·baseline + β·shock + γ·(intensity - ERI)·direction(invoked)`

### `event_keywords`
Salient noun phrases extracted from text (top 5).

### `risk_flags`
Array of risk labels: `["self_harm", "hopelessness", "severe_withdrawal"]`  
Empty if no risk detected.

---

## Test Cases

### 1. Positive Social Event

```bash
python cli.py analyze --user test1 --text "Met my friends after many days; felt great and lighter."
```

**Expected:**
- `invoked.emotion`: "joy"
- `invoked.valence`: > 0.5
- `state.valence`: increases
- `risk_flags`: []

### 2. Work Stress

```bash
python cli.py analyze --user test2 --text "Boss rebuked me. I went home early and slept."
```

**Expected:**
- `invoked.emotion`: "anger" or "sadness"
- `invoked.valence`: < 0
- `expressed.tone`: "negative"
- `state.valence`: decreases

### 3. Neutral Routine

```bash
python cli.py analyze --user test3 --text "Had lunch at my desk, lots of work to finish by evening."
```

**Expected:**
- `invoked.emotion`: "neutral"
- `invoked.arousal`: low
- `event_keywords`: ["lunch", "desk", "work"]

### 4. Risk Detection

```bash
python cli.py analyze --user test4 --text "I wish I were dead. Nothing matters."
```

**Expected:**
- `risk_flags`: ["self_harm", "hopelessness"]
- Risk event logged to Upstash
- `state.valence`: strongly negative

---

## Architecture

```
cli.py                   # Entrypoint (Click-based CLI)
src/
  analyzer.py            # Feature extraction (emotion, keywords, intensity, risk)
  dynamics.py            # Temporal state updates (baseline, shock, ERI, recursion)
  persistence.py         # Upstash Redis I/O (reflections, state, risk stream)
  emotion_map.py         # Valence/arousal mapping table + risk patterns
```

---

## Dynamics Parameters

Tune via environment variables:

- **ALPHA** (0-1): Weight for baseline drift (default: 0.3)  
  Higher = state follows long-term average more
  
- **BETA** (0-1): Weight for shock (default: 0.4)  
  Higher = events have stronger immediate impact
  
- **GAMMA** (0-1): Weight for expression incongruence (default: 0.2)  
  Higher = mismatches between felt vs. expressed emotion have more influence
  
- **BASELINE_WINDOW** (int): Number of recent reflections for baseline (default: 10)

---

## Idempotency

Duplicate reflections (same user + text hash) are detected and skipped.  
State does not advance on duplicates.

---

## Safety & Risk Detection

Risk patterns are conservative and explicit:
- **Self-harm**: "wish i were dead", "kill myself", "suicide", etc.
- **Hopelessness**: "nothing matters", "no point", "give up", etc.
- **Withdrawal**: "avoid everyone", "can't leave the house", etc.

When detected:
1. `risk_flags` array populated in output
2. Risk event logged to Upstash (`risk:{user_id}:{ts}`)
3. Logged to stderr for monitoring

---

## Performance

- **Latency**: < 2s on laptop for typical reflections
- **Models**: Lightweight (TextBlob for sentiment, pattern matching for risk)
- **Determinism**: All computations are deterministic (no random seeds)

---

## Future Enhancements

- [ ] Multi-language support (Hindi/Hinglish translation integration)
- [ ] Advanced emotion models (transformers-based)
- [ ] Real-time alerting for risk events
- [ ] Web API wrapper
- [ ] Visualization dashboard for state evolution

---

## License

MIT
