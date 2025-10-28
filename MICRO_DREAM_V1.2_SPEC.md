# Micro-Dream v1.2 — Arc-aware 3/5 Reflection Generator

## Upgrade Summary
Version 1.2 introduces **arc-aware generation** with recency-weighted metrics, multi-line templates (3-5 lines), language detection, and pivot sentences for significant emotional turns.

## Trigger Policy
- **After 3rd moment**: First micro-dream eligible at signin #4
- **After 5th moment**: Uses enhanced 3R+1M+1O selection
- **Alternating cadence**: 1-gap/2-gap pattern → displays at #4, #6, #8, #11, #13, #16, #18, #21, #23, #26...

## Selection Policy

### N=3 (2R+1O)
- **2 recent** + **1 oldest**
- Ensures latest moment always included
- Uses all 3 available reflections

### N≥5 (3R+1M+1O)
- **3 recent** (latest 3 moments)
- **1 mid** (40-60th percentile by time, prefer same primary as dominant recent)
- **1 oldest** (earliest moment)
- Always includes latest moment

## Input Data Structure
Each selected reflection ("fade") includes:
```json
{
  "rid": "refl_xxx",
  "timestamp": "ISO8601",
  "valence_final": float,        // -1 to +1
  "arousal_final": float,        // 0 to 1
  "wheel": {
    "primary": "sad|angry|fearful|happy|peaceful|strong",
    "secondary": "lonely|hurt|...",
    "tertiary": "isolated|abandoned|..."
  },
  "city": "Mumbai|Delhi|Bangalore|...",
  "circadian": "morning|afternoon|evening|night",
  "language": "en|mixed|hi"
}
```

## Metric Computation

### Recency Weighting
- **Latest moment**: 0.5
- **Second latest**: 0.3
- **Others**: 0.2 / (n-2) equally

Applied to:
- `valence_mean` = Σ(valence × weight)
- `arousal_mean` = Σ(arousal × weight)

### Dominant Primary
Recency-weighted mode of primary emotions. If tie, prefer latest.

### Arc Direction
Based on Δvalence between **earliest** and **latest** selected moments:
- **Upturn**: Δvalence ≥ +0.15
- **Downturn**: Δvalence ≤ -0.15
- **Steady**: |Δvalence| < 0.15

## Language Detection
Examines last 2 moments:
- **English** (`en`): Default, or if only 1 moment has mixed markers
- **Hinglish** (`hi`): If BOTH last moments contain `mixed|hi|hinglish|hindi` in language field OR ≥2 Hinglish keywords detected

**Hinglish keywords**: chai, tapri, auto, yaar, kya, hai, nahi, thoda, kuch, bahut, zyada, accha, theek, matlab

## Template System

### Style Rules (All Templates)
- **3-5 lines** (validated, enforced)
- **≤10 words per line** (strictly enforced via `_trim_line()`)
- **Concrete, sensory, locale-aware**: traffic, chai, skyline, monsoon, autos, metro, ceiling fan
- **No therapy clichés**: "healing journey", "process", "space to feel"
- **British/Indian English**: "favourite", "neighbourhood" allowed
- **Tone mirrors arc**: heavier diction in early lines, lighter in last line for upturn

### Upturn Template
```
L1: Past heaviness, city detail
    EN: "It weighed heavy then, traffic crawling."
    HI: "Pehle bahut heavy tha, local bhi slow."

L2: Morning attempt to rise
    EN: "Morning came. You tried to rise."
    HI: "Subah uthi, thoda try kiya rise."

L3: Social/shared moment easing
    EN: "Someone listened. It felt lighter."
    HI: "Kisi se baat ki, halka laga."

L4: Directional promise (pivot sentence)
    EN: "You're turning toward calm."
    HI: "Ab turn ho raha calm ki taraf."
```

**Pivot Sentence**: Only rendered if `arc_direction=upturn` AND `|Δvalence| ≥ 0.15`

### Downturn Template
```
L1: Recent struggle
    EN: "It got heavier this week."
    HI: "Ab zyada heavy ho gaya hai."

L2: City/sensory decline
    EN: "Nights stretched long, mornings far."
    HI: "Raat lambi, subah door."

L3: Acknowledge heaviness
    EN: "You're feeling it. That's real."
    HI: "Mehsoos ho raha, it's okay."

L4: Care cue
    EN: "Breathe. Go gently with yourself."
    HI: "Breathe le; thoda gentle jao."
```

### Steady Template
```
L1: Anchor routine
    EN: "Things held steady this week."
    HI: "Routine steady chal raha, holding ground."

L2: Small constancy
    EN: "Same rhythm. Small constancies."
    HI: "Chai, traffic, same pattern."

L3: Invite curiosity
    EN: "Maybe try one new thing?"
    HI: "Kuch naya try kar sakte ho?"
```

## Validation Rules

### Line Constraints
1. **Count**: 3-5 lines (enforce min/max)
2. **Length**: ≤10 words per line (trim via `_trim_line()`)
3. **No typos**: Use tasteful Hinglish variants for `hi` mode

### Bridge Clause
If `arc_direction=upturn` BUT `dominant_primary NOT IN {happy, joyful, peaceful}`:
- Append to last line: `" — and that's new."`
- Example: `"You're turning toward calm — and that's new."`

This handles unexpected upturns (e.g., moving from `sad` → less sad, but not yet `happy`)

## Output Contract

```json
{
  "owner_id": "user:xxx",
  "algo": "micro-v1.2",
  "createdAt": "2025-10-28T12:34:56Z",
  "lines": [
    "It weighed heavy then, traffic crawling.",
    "Morning came. You tried to rise.",
    "Someone listened. It felt lighter.",
    "You're turning toward calm."
  ],
  "fades": ["refl_001", "refl_045", "refl_089", "refl_090", "refl_091"],
  "dominant_primary": "peaceful",
  "valence_mean": 0.23,
  "arousal_mean": 0.45,
  "arc_direction": "upturn",
  "source_policy": "5+=3R+1M+1O"
}
```

### Schema
- `owner_id`: User identity (`user:{userId}` or `guest:{sid}`)
- `algo`: Always `"micro-v1.2"`
- `createdAt`: ISO8601 UTC timestamp
- `lines`: Array of 3-5 strings (validated)
- `fades`: Array of `rid` strings (selected reflections in chronological order)
- `dominant_primary`: Single token from Willcox wheel primaries
- `valence_mean`: Float, recency-weighted mean valence
- `arousal_mean`: Float, recency-weighted mean arousal
- `arc_direction`: `"upturn"` | `"downturn"` | `"steady"`
- `source_policy`: `"3=2R+1O"` or `"5+=3R+1M+1O"`

## Implementation Details

### Key Methods

#### `select_moments(reflections) -> (moments, policy)`
- N=3: Use all 3 (oldest + 2 recent)
- N=4: oldest + 2 most recent
- N≥5: oldest + mid(40-60%ile, prefer dominant_primary match) + 3 recent
- Returns fade sequence in chronological order

#### `aggregate_metrics(moments) -> metrics`
- Computes recency-weighted valence/arousal means
- Determines dominant_primary via weighted mode
- Calculates arc_direction from earliest→latest Δvalence
- Returns dict with all metrics

#### `detect_language(moments) -> 'en'|'hi'`
- Examines last 2 moments
- Returns `'hi'` if both marked mixed/hindi OR ≥2 Hinglish keywords found
- Returns `'en'` otherwise

#### `generate_upturn_template(metrics, moments, language) -> lines`
#### `generate_downturn_template(metrics, moments, language) -> lines`
#### `generate_steady_template(metrics, moments, language) -> lines`
- Template-based generation
- Locale-aware (city details: Mumbai→local train, Delhi→metro, etc.)
- Language-aware (EN vs Hinglish variants)
- Returns 3-5 lines

#### `validate_and_bridge(lines, metrics) -> lines`
- Enforces 3-5 line count
- Trims each line to ≤10 words
- Adds bridge clause if upturn with non-positive primary

#### `generate_micro_dream_lines(metrics, moments) -> lines`
- Main orchestrator
- Detects language
- Selects template by arc_direction
- Validates output
- Returns final lines array

### Optional Ollama Refinement
`refine_with_ollama(lines, metrics) -> lines`
- **Disabled by default** for v1.2 (templates already concrete/sensory)
- If enabled (`SKIP_OLLAMA=0`), refines all lines with phi3
- Temperature: 0.15 (low for consistency)
- Validates ≤10 words, falls back to original if too long

## Migration from v1.0

### Breaking Changes
1. **Output format**: `lines` is now array of 3-5 strings (was 2)
2. **Algorithm version**: `algo: "micro-v1.2"` (was `"micro-v1"`)
3. **New fields**: `arc_direction`, updated `source_policy` values

### Backward Compatibility
- Old v1.0 micro-dreams still valid in Upstash (different TTL)
- Frontend should handle both 2-line and 3-5 line formats
- Detection heuristic: `lines.length <= 2` → v1.0, `lines.length >= 3` → v1.2

### Frontend Integration
```typescript
interface MicroDream {
  owner_id: string;
  algo: "micro-v1" | "micro-v1.2";
  createdAt: string;
  lines: string[];  // 2 lines (v1.0) or 3-5 lines (v1.2)
  fades: string[];
  dominant_primary: string;
  valence_mean: number;
  arousal_mean: number;
  arc_direction?: "upturn" | "downturn" | "steady";  // v1.2 only
  source_policy: string;
}

// Render lines dynamically
{dream.lines.map((line, i) => (
  <p key={i} className="fade-in-line">{line}</p>
))}
```

## Testing Scenarios

### Upturn Arc (Δvalence ≥ +0.15)
- **Input**: 3 moments: valence [-0.5, -0.2, +0.2] (Δ=+0.7)
- **Expected**: Upturn template with pivot sentence
- **Language**: EN if both last moments English, HI if both mixed

### Downturn Arc (Δvalence ≤ -0.15)
- **Input**: 5 moments: valence [+0.3, +0.1, -0.1, -0.3, -0.4] (Δ=-0.7)
- **Expected**: Downturn template with care cue
- **Policy**: 5+=3R+1M+1O

### Steady Arc (|Δvalence| < 0.15)
- **Input**: 4 moments: valence [0.0, +0.05, -0.05, +0.02] (Δ=+0.02)
- **Expected**: Steady template with curiosity invite
- **Policy**: 3=2R+1O

### Bridge Clause Edge Case
- **Input**: Upturn arc BUT dominant_primary = "sad"
- **Expected**: Last line appends " — and that's new."
- Example: "You're turning toward calm — and that's new."

### Hinglish Detection
- **Input**: Last 2 moments both have `language: "mixed"`
- **Expected**: `language: "hi"`, Hinglish template variants

## Performance & Caching
- **Upstash TTL**: 7 days (604800 seconds)
- **Key**: `micro_dream:{owner_id}`
- **Sign-in gating**: Pattern #4, #6, #8, #11, #13, #16... (1-gap/2-gap alternating)
- **Guest exclusion**: `owner_id.startswith('guest:')` → skip generation

## Example Output

### Upturn (English, N=5)
```
1) It weighed heavy then, metro packed tight.
2) Morning came. You tried something new.
3) Someone listened. It felt lighter.
4) You're turning toward calm.

FADES: refl_001 → refl_034 → refl_087 → refl_088 → refl_089

METRICS:
  Arc: upturn (-0.4 → +0.2, Δ=+0.6)
  Dominant: peaceful
  Valence: +0.12 (weighted)
  Arousal: 0.38 (weighted)
  Language: English
  Policy: 5+=3R+1M+1O
```

### Downturn (Hinglish, N=3)
```
1) Ab zyada heavy ho gaya hai.
2) Raat lambi, subah door.
3) Mehsoos ho raha, it's okay.
4) Breathe le; thoda gentle jao.

FADES: refl_010 → refl_011 → refl_012

METRICS:
  Arc: downturn (+0.1 → -0.3, Δ=-0.4)
  Dominant: sad
  Valence: -0.18 (weighted)
  Arousal: 0.62 (weighted)
  Language: Hinglish
  Policy: 3=2R+1O
```

## File Locations
- **Implementation**: `micro_dream_agent.py`
- **Mock/Test**: `micro_dream_agent_mock.py`
- **Legacy v1.0**: `micro_dream.py`
- **Documentation**: `MICRO_DREAM_V1.2_SPEC.md` (this file)

## Environment Variables
```bash
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
OWNER_ID=user:xxx          # Required
FORCE_DREAM=1              # Optional: bypass sign-in gating
SKIP_OLLAMA=1              # Optional: disable refinement (default for v1.2)
```

## Usage
```bash
# Run with default settings (skip Ollama refinement)
OWNER_ID=user:123 python micro_dream_agent.py

# Force display (bypass gating)
OWNER_ID=user:123 FORCE_DREAM=1 python micro_dream_agent.py

# Enable Ollama refinement (not recommended for v1.2)
OWNER_ID=user:123 SKIP_OLLAMA=0 python micro_dream_agent.py
```

---

**Version**: 1.2  
**Date**: October 28, 2025  
**Status**: ✅ Implemented, validated, ready for testing
