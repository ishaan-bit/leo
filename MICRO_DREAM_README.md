# Micro-Dream Agent

**Terminal-only dream generation from Upstash reflections with sign-in display gating**

---

## Overview

The Micro-Dream Agent generates 2-line emotional summaries ("micro-dreams") from a user's reflection history stored in Vercel Upstash Redis. It implements:

- **Smart moment selection**: Picks 3-5 key reflections using temporal + emotional algorithms
- **Ollama refinement**: Uses phi3 LLM to make lines direct and user-friendly
- **Sign-in display gating**: Pattern-based rhythm (skip 1, skip 2, repeat → play on #3, 5, 8, 10, 13, 15...)
- **Upstash persistence**: Writes `micro_dream:{sid}` JSON with 7-day TTL
- **Terminal preview**: No UI, no commits — pure verification mode

---

## Files

| File | Purpose |
|------|---------|
| `micro_dream_agent.py` | **Production version** with live Upstash REST API |
| `micro_dream_agent_mock.py` | **Mock version** with 6 sample reflections (no network required) |
| `run_micro_dream_agent.py` | Environment loader — parses `.env.local` and runs production agent |

---

## Quick Start

### Mock Mode (No Setup Required)

```powershell
# Test with raw lines (fastest)
$env:SKIP_OLLAMA='1'
python micro_dream_agent_mock.py

# Test with Ollama refinement
python micro_dream_agent_mock.py

# Test sign-in gating at different counts
$env:SIGNIN_COUNT='3'  # Should display
python micro_dream_agent_mock.py

$env:SIGNIN_COUNT='4'  # Should NOT display
python micro_dream_agent_mock.py
```

### Production Mode (Upstash Required)

```powershell
# Option 1: Use run script (auto-loads .env.local)
python run_micro_dream_agent.py

# Option 2: Set environment manually
$env:UPSTASH_REDIS_REST_URL='https://ultimate-pika-17842.upstash.io'
$env:UPSTASH_REDIS_REST_TOKEN='your_token_here'
$env:SID='sess_abc123'
python micro_dream_agent.py
```

---

## Environment Variables

### Required (Production Only)

| Variable | Description | Example |
|----------|-------------|---------|
| `UPSTASH_REDIS_REST_URL` | Vercel KV / Upstash REST endpoint | `https://ultimate-pika-17842.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | REST API token | `AY...` (from Vercel dashboard) |
| `SID` | Session ID to fetch reflections for | `sess_abc123` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `FORCE_DREAM` | `0` | Set to `1` to bypass sign-in gating and always display |
| `SKIP_OLLAMA` | `0` | Set to `1` to use raw lines without Ollama refinement |
| `SIGNIN_COUNT` | `0` | (Mock mode only) Simulate specific sign-in count |

---

## Upstash Data Structure

### Input: Reflections

**Key pattern**: `reflections:enriched:refl_*` or `refl:*`

**Value** (JSON string):
```json
{
  "rid": "refl_abc123",
  "sid": "sess_xyz",
  "timestamp": "2025-10-24T14:30:00Z",
  "normalized_text": "Had a tough day...",
  "final": {
    "valence": 0.3,
    "arousal": 0.6,
    "wheel": {
      "primary": "peaceful"
    }
  },
  "post_enrichment": {
    "closing_line": "Let the calm keep watch. See you tomorrow.",
    "poems": [...],
    "tips": [...]
  }
}
```

### Output: Micro-Dream

**Key**: `micro_dream:{sid}`  
**TTL**: 7 days (604800 seconds)  
**Value** (JSON string):

```json
{
  "sid": "sess_xyz",
  "algo": "micro-v1",
  "createdAt": "2025-10-24T15:45:12Z",
  "lines": [
    "You found some calm this week.",
    "Let the calm keep watch."
  ],
  "fades": [
    "refl_old",
    "refl_mid",
    "refl_recent1",
    "refl_recent2",
    "refl_recent3"
  ],
  "dominant_primary": "peaceful",
  "valence_mean": 0.32,
  "arousal_mean": 0.55,
  "source_policy": "5+=3R+1M+1O"
}
```

### State Tracking

| Key | Type | Purpose |
|-----|------|---------|
| `signin_count:{sid}` | Integer | Incremented on each sign-in |
| `dream_gap_cursor:{sid}` | Integer | Cycles through [0, 1] for pattern tracking |

---

## Algorithms

### 1. Moment Selection

**Goal**: Pick 3-5 emotionally representative reflections for fade sequence

| Total Reflections | Policy | Fade Order |
|-------------------|--------|------------|
| 3-4 | 2 Recent + 1 Old | Old → Recent[-2] → Recent[-1] |
| 5+ | 3 Recent + 1 Mid + 1 Old | Old → Mid → Recent[-3] → Recent[-2] → Recent[-1] |

**Old**: Bottom 25% by time, highest `|valence - mean|` (emotional peak)  
**Mid**: 50-65% percentile, prefers same `primary` as dominant recent emotion  
**Recent**: Last 2 or 3 reflections

### 2. Line Generation

#### Line 1 — Tone of Now
**Inputs**: `valence_mean`, `arousal_mean`, `dominant_primary`

**Logic**:
- **Peaceful** + high valence → "You found some calm this week."
- **Mad** + high arousal → "Anger flared up, still burning."
- **Scared** + low valence → "Worry pressed in heavy."
- (See `generate_line1_tone()` for full mapping)

**Output**: 6-10 word direct emotional statement

#### Line 2 — Direction / Next
**Inputs**: `delta_valence`, `closing_line`, `latest_primary`

**Logic**:
1. If reflection has `closing_line` → use it (trimmed of "See you tomorrow.")
2. Else if Δvalence ≥ +0.1 → "You're moving toward lighter ground."
3. Else if Δvalence ≤ -0.1 → "It got harder. Be gentle."
4. Else → Primary-specific guidance ("Let the calm keep watch.", "Breathe; you're not alone.", etc.)

**Output**: Actionable guidance or affirmation

### 3. Ollama Refinement (Optional)

**Model**: `phi3:latest` (local Ollama instance)  
**Temperature**: 0.2 (Line 1), 0.25 (Line 2)  
**Prompt strategy**:
- Line 1: "Make this emotion-focused statement more direct and specific (no metaphors)."
- Line 2: "Make this guidance actionable and clear."

**Fallback**: If Ollama fails or produces invalid output, use raw line

### 4. Sign-In Display Gating

**Pattern**: Skip 1, Skip 2, Repeat  
**Display on**: #3, 5, 8, 10, 13, 15, 18, 20, 23, 25...

**Timeline**:
```
#1 → skip
#2 → skip  
#3 → PLAY ✓  
#4 → skip  
#5 → PLAY ✓  
#6 → skip  
#7 → skip  
#8 → PLAY ✓  
#9 → skip  
#10 → PLAY ✓  
...
```

**Mechanism**:
1. Increment `signin_count:{sid}` on every sign-in
2. Check if `signin_count` matches play sequence
3. If match → display micro-dream, increment `dream_gap_cursor`
4. Else → skip display but keep `micro_dream:{sid}` fresh

---

## Terminal Output Example

```
============================================================
MICRO-DREAM AGENT — Mock Mode
============================================================
Session: sess_mock
Skip Ollama: True
Simulated sign-in count: 3
============================================================

[✓] Loaded 6 sample reflections
[✓] Selected 5 moments using policy: 5+=3R+1M+1O
[✓] Aggregated: peaceful | valence=+0.18 | Δ=+0.32

[RAW] Line 1: A steady peace, holding ground.
[RAW] Line 2: Let the calm keep watch.

============================================================
MICRO-DREAM PREVIEW (terminal)
============================================================
1) A steady peace, holding ground.
2) Let the calm keep watch.

FADES: refl_001_peaceful → refl_004_mad → refl_004_mad → refl_005_peaceful → refl_006_peaceful
dominant: peaceful | valence: +0.18 | arousal: 0.52 | Δvalence: +0.32

[✓] DISPLAY ON THIS SIGN-IN (#3)
============================================================
```

---

## Testing Checklist

### Mock Mode
- [x] 6 reflections → 5-moment selection (3R+1M+1O)
- [x] Raw line generation (direct emotional statements)
- [x] Ollama refinement (optional)
- [x] Sign-in gating: #1, #2 → skip
- [x] Sign-in gating: #3, #5, #8 → display
- [x] Terminal output formatting

### Production Mode (when Upstash connects)
- [ ] Fetch reflections from `reflections:enriched:*` keys
- [ ] JSON parsing with nested `final.wheel.primary`
- [ ] Write `micro_dream:{sid}` with 7-day TTL
- [ ] Increment `signin_count:{sid}` on execution
- [ ] Update `dream_gap_cursor:{sid}` after display
- [ ] Handle <3 reflections gracefully (exit with message)

---

## Frontend Integration (Future)

### API Endpoint (Proposed)

**Route**: `/api/micro-dream`  
**Method**: POST  
**Body**: `{ "sid": "sess_abc123" }`  
**Response**:
```json
{
  "should_display": true,
  "lines": [
    "You found some calm this week.",
    "Let the calm keep watch."
  ],
  "fades": ["refl_old", "refl_mid", "refl_recent1", "refl_recent2", "refl_recent3"],
  "next_eligible_signin": 8
}
```

### Visual Scene Spec

**Scene**: Night-sky gradient (dark indigo) → morning pink haze  
**Elements**:
- Buildings as soft silhouettes with dark fog edges
- Clouds below skyline for depth
- Pig floating gently in same position as city interlude
- Speech bubble (comic style, same as orchestrator)

**Timeline** (~8-10s):
1. **Fade 1** (Old reflection) — 1.2s
2. **Fade 2** (Mid reflection) — 1.2s
3. **Fade 3** (Recent reflections) — 1.2s, hold
4. **Line 1** renders in bubble — 1.5s
5. **Line 2** renders in bubble — 1.5s
6. **End caption**: "eyes open to the easy light"
7. **Sky transition**: Dark indigo → pink morning haze
8. **Cross-fade**: → "Share your Moment" page or Living City

**Transitions**: Ease-in/out curves, no hard cuts

---

## Design Philosophy

### Directness Over Poetry

Early iterations used metaphorical language ("sky warmer", "wind rising"). User feedback: **"can the 2 lines be more direct and less vague"**

**Current approach**:
- ✅ "You found some calm this week."
- ✅ "Anger flared up, still burning."
- ❌ "The sky turns warmer, wind rising."

### Raw vs Ollama Trade-Off

**Raw lines**: Direct + warm, slightly poetic  
**Ollama lines**: More literal, clinical precision

**Example**:
- Raw: "A steady peace, holding ground."
- Ollama: "Feeling secure in my current situation."

**Decision**: Use raw lines by default (`SKIP_OLLAMA=1`), offer Ollama as optional refinement for users who prefer maximum literalness.

---

## Troubleshooting

### "Not enough moments for micro-dream"
**Cause**: Fewer than 3 reflections found  
**Fix**: User needs to create more reflections, or check `SID` is correct

### "Ollama refinement failed"
**Cause**: Ollama not running at `localhost:11434`  
**Fix**: Start Ollama (`ollama serve`) or set `SKIP_OLLAMA=1`

### "DNS resolution error" (Upstash)
**Cause**: Network blocking `ultimate-pika-17842.upstash.io`  
**Fix**: Check VPN/firewall, or use mock mode for testing

### Wrong sign-in count displayed
**Cause**: State in Upstash (`signin_count:{sid}`) out of sync  
**Fix**: Manually reset key in Upstash dashboard or use `FORCE_DREAM=1` to override

---

## Agent Mode Summary

✅ **What this agent does**:
- Pulls reflections from Upstash
- Generates 2-line micro-dream
- Writes `micro_dream:{sid}` JSON
- Tracks sign-in gating state
- Prints terminal preview

❌ **What this agent does NOT do**:
- Commit code to repo
- Modify reflection data
- Write to frontend files
- Trigger deployments
- Display UI

**Purpose**: Terminal verification and logic validation only.

---

## License

Ephemeral tool for internal use. No commits, no repo inclusion per user requirement.

---

## Contact / Next Steps

1. Test production mode when Upstash network access available
2. Decide: Raw lines vs Ollama refinement (current: raw preferred)
3. Integrate into sign-in flow as `/api/micro-dream` endpoint
4. Build visual scene (night sky → pink morning transition)
5. Add feature flag: `user:{uid}:feature_flags.force_dream` override
