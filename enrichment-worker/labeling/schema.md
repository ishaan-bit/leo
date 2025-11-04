# Data Labeling Schema v1.0

## Overview
This document defines the canonical schema for labeling reflections in the Leo behavioral inference pipeline. All labels MUST conform to **EES-1 (6×6×6 Willcox Wheel)** for emotion taxonomy.

---

## 1. Reflection Input Schema

### Core Fields
```json
{
  "rid": "string (UUID)",
  "owner_id": "string (user UUID or 'guest_{temp_id}')",
  "timestamp": "ISO 8601 datetime (UTC)",
  "raw_text": "string (original user input, 10-500 chars)",
  "normalized_text": "string (cleaned, PII-scrubbed)",
  "lang": "enum: 'en' | 'hi' | 'hinglish'",
  "city": "string | null (e.g., 'Mumbai', 'Delhi')",
  "typing_summary": {
    "total_time_ms": "int",
    "pause_count": "int",
    "backspace_count": "int",
    "avg_char_speed_ms": "float"
  } | null,
  "voice_summary": {
    "duration_ms": "int",
    "pause_ratio": "float [0-1]",
    "tone_variance": "float"
  } | null,
  "consent": {
    "research": "boolean",
    "audio_retention": "boolean"
  }
}
```

### Validation Rules
- **rid**: Must be unique globally
- **timestamp**: Required, used for temporal features
- **raw_text**: 10-500 chars; reject if outside bounds
- **normalized_text**: PII-scrubbed (no names, phones, emails, specific locations beyond city)
- **lang**: Auto-detected, manual override allowed
- **consent.research**: If false, exclude from training data

---

## 2. Perception Labels (Targets)

### 2.1 Continuous Variables

#### Valence
```json
{
  "valence": "float [0.0-1.0]",
  "valence_confidence": "float [0.0-1.0]",
  "valence_notes": "string | null"
}
```
- **Definition**: Emotional positivity/negativity
- **Scale**: 0.0 = very negative, 0.5 = neutral, 1.0 = very positive
- **Guidelines**:
  - Consider overall tone, not just words
  - "I'm okay" with sad context → 0.3-0.4
  - "Today was hard but I learned" → 0.5-0.6
  - Explicit joy/gratitude → 0.7+

#### Arousal
```json
{
  "arousal": "float [0.0-1.0]",
  "arousal_confidence": "float [0.0-1.0]",
  "arousal_notes": "string | null"
}
```
- **Definition**: Emotional activation/energy level
- **Scale**: 0.0 = very calm, 0.5 = moderate, 1.0 = very activated
- **Guidelines**:
  - Markers: ALL CAPS, !!!, fast pacing, intensifiers ("very", "so", "really")
  - "I'm exhausted" → 0.2-0.3 (low arousal despite negative valence)
  - "I'm SO excited!!!" → 0.8+ (high arousal, positive valence)
  - "Meh, whatever" → 0.1-0.2

### 2.2 Hierarchical Emotions (EES-1 Enforcement)

#### Invoked (What they felt internally)
```json
{
  "invoked": {
    "primary": "enum: [Happy, Strong, Peaceful, Sad, Angry, Fearful]",
    "secondary": "enum: 36 nuances per EES-1",
    "tertiary": "enum: 216 micro-nuances per EES-1",
    "confidence": "float [0.0-1.0]"
  }
}
```

**EES-1 Hierarchy (MUST FOLLOW)**:
```
Happy → Excited, Interested, Energetic, Playful, Creative, Optimistic
  Excited → Energetic, Curious, Stimulated, Playful, Inspired, Cheerful
  Interested → Engaged, Intrigued, Focused, Attentive, Curious, Involved
  ...

Strong → Confident, Proud, Respected, Courageous, Hopeful, Resilient
  Confident → Assured, Secure, Capable, Bold, Competent, Self-reliant
  ...

Peaceful → Loving, Grateful, Thoughtful, Content, Serene, Thankful
  Loving → Caring, Compassionate, Affectionate, Warm, Tender, Kind
  ...

Sad → Lonely, Vulnerable, Hurt, Depressed, Guilty, Grief
  Lonely → Abandoned, Isolated, Forsaken, Forgotten, Distant, Alone
  ...

Angry → Mad, Disappointed, Humiliated, Aggressive, Frustrated, Critical
  Mad → Furious, Enraged, Outraged, Irritated, Heated, Wild
  ...

Fearful → Anxious, Insecure, Overwhelmed, Weak, Rejected, Helpless
  Anxious → Nervous, Uneasy, Tense, Worried, Restless, Alarmed
  ...
```

**Validation**:
- Secondary MUST be child of Primary
- Tertiary MUST be child of Secondary
- Use `emotion_schema.py` for validation
- Invalid triples auto-normalize but log warning

#### Expressed (What they showed in text)
```json
{
  "expressed": {
    "primary": "enum: [Happy, Strong, Peaceful, Sad, Angry, Fearful]",
    "secondary": "enum: 36 nuances per EES-1",
    "tertiary": "enum: 216 micro-nuances per EES-1",
    "confidence": "float [0.0-1.0]"
  }
}
```

**Guidelines**:
- May differ from Invoked due to social inhibition
- "I'm fine" (when clearly sad) → Invoked: Sad/Depressed/Hopeless, Expressed: Peaceful/Content/Calm
- Explicit statements → higher confidence
- Hedging ("I guess", "maybe") → lower confidence

### 2.3 Behavioral Variables

#### Willingness to Express
```json
{
  "willingness_to_express": "float [0.0-1.0]",
  "willingness_notes": "string | null"
}
```
- **Formula** (baseline): `0.4 + 0.2*first_person - 0.1*hedges - 0.1*strong_negations`
- **Override**: Labeler can adjust if formula misses nuance
- High (0.7+): "I feel abandoned and scared"
- Low (0.3-): "Everything's fine, just tired I guess"

#### Congruence
```json
{
  "congruence": "float [0.0-1.0]",
  "congruence_notes": "string | null"
}
```
- **Definition**: Alignment between Invoked and Expressed
- 1.0 = perfect match (e.g., "I'm so grateful today!" → both Peaceful/Grateful)
- 0.0 = complete mismatch (e.g., crying inside but saying "I'm fine")
- 0.5 = partial (some emotional leakage)

---

## 3. Generation Labels (SFT / DPO)

### 3.1 SFT (Supervised Fine-Tuning)

**Good** output schema:
```json
{
  "input": {
    "rid": "...",
    "normalized_text": "...",
    "invoked": {...},
    "expressed": {...},
    "valence": 0.0-1.0,
    "arousal": 0.0-1.0,
    "circadian_phase": "morning|afternoon|evening|night"
  },
  "good": {
    "poems": [
      "line 1 (<=60 chars)",
      "line 2 (<=60 chars)",
      "line 3 (<=60 chars)",
      "line 4 (<=60 chars) [optional]"
    ],
    "tips": [
      "tip 1 (concrete, locale-ready, <=120 chars)",
      "tip 2",
      "tip 3 [optional]"
    ],
    "closing_line": "string (<=100 chars, warm, specific)",
    "style": {
      "voice": "empathetic-stranger",
      "tempo": "slow|mid|fast",
      "code_mix": "en|hi|hinglish"
    },
    "mirrors": ["specific 1 from user text", "specific 2"],
    "labeler_notes": "why this is good"
  }
}
```

**Quality Criteria (GOOD)**:
- ✅ Mirrors 1-2 specifics from user text
- ✅ No banned phrases (see `data/meta/banned_phrases.txt`)
- ✅ Locale-aware (urban India, women 25-35)
- ✅ Concrete tips (not "just breathe")
- ✅ Warm but not overly familiar
- ✅ EES-1 emotion-grounded
- ✅ No diagnosis, promises, outcomes
- ✅ Hinglish natural if lang=hinglish

### 3.2 DPO (Direct Preference Optimization)

**Good vs Bad** pairs:
```json
{
  "input": {...same as SFT...},
  "good": {...same as SFT.good...},
  "bad": {
    "poems": ["generic platitude version"],
    "tips": ["cookie-cutter advice"],
    "closing_line": "cliché",
    "why_bad": "diagnosis / outcome promise / therapy-speak / no specifics"
  },
  "preference_strength": "weak|strong",
  "labeler_notes": "rationale for bad"
}
```

**Bad Example Types** (for DPO training):
1. **Platitudes**: "You are valid", "Just breathe", "It will all be fine"
2. **Diagnosis**: "You sound depressed", "This is anxiety"
3. **Promises**: "You will get through this", "Tomorrow will be better"
4. **Prescriptive**: "You should talk to someone", "You need to..."
5. **Generic**: No mirroring of user specifics
6. **Therapy-speak**: "Sit with your feelings", "Honor your emotions"

---

## 4. Labeling Workflow

### 4.1 Perception Labeling

1. **Read reflection** (raw + normalized)
2. **Assess Valence/Arousal** (continuous 0-1)
3. **Identify Invoked emotion**:
   - Primary (gut feeling)
   - Secondary (nuance within primary)
   - Tertiary (micro-nuance for specificity)
4. **Identify Expressed emotion** (what text shows):
   - May differ from Invoked
   - Consider hedging, social inhibition
5. **Rate Willingness** (0-1, override formula if needed)
6. **Rate Congruence** (0-1, Invoked-Expressed alignment)
7. **Add confidence scores** per variable
8. **Validation**: Run through `emotion_schema.validate_emotion_state()`

### 4.2 Generation Labeling (SFT)

1. **Read reflection + perception labels**
2. **Draft poems** (2-4 lines):
   - Mirror 1-2 user specifics
   - Match emotion micro-nuance
   - Warm, not therapist-y
3. **Draft tips** (2-3 concrete):
   - Locale-aware (urban India context)
   - No prescriptions/outcomes
   - Check banned phrases list
4. **Draft closing line**:
   - Personal, specific
   - No clichés
5. **Style metadata**: voice, tempo, code_mix
6. **Validation**: Run through `qa_dataset.py`

### 4.3 DPO Pair Creation

1. **Start with GOOD output** (from SFT)
2. **Create BAD version** by intentionally:
   - Removing specifics → generic
   - Adding banned phrase
   - Making diagnosis/promise
   - Using therapy-speak
3. **Label preference strength**:
   - Strong: obvious difference (diagnosis vs safe)
   - Weak: subtle (slightly generic vs specific)
4. **Document why_bad**: category of failure

---

## 5. Inter-Annotator Agreement

### Perception
- **Valence/Arousal**: ±0.15 tolerance
- **Primary emotion**: Must match exactly
- **Secondary/Tertiary**: ≥80% agreement (4/5 labelers)
- **Willingness/Congruence**: ±0.20 tolerance

### Generation
- **Preference (DPO)**: ≥70% agreement (7/10 labelers prefer same)
- **Quality gate**: ≥80% pass on banned phrases check

### Adjudication
- If disagreement > threshold → escalate to senior labeler
- Document resolution in `labeler_notes`

---

## 6. Quality Checks (Automated)

```python
# Run before accepting labels
python scripts/qa_dataset.py --input data/curated/batch_001.jsonl

# Checks:
# - JSON schema valid
# - EES-1 hierarchy valid (primary → secondary → tertiary)
# - Valence/arousal in [0,1]
# - Banned phrases absent in "good" outputs
# - Text length constraints met
# - Sum(blend_weights) = 1.0 per variable
# - Consent flags respected
```

---

## 7. Privacy & Ethics

### PII Scrubbing (Required)
- Names → `[NAME]`
- Phone numbers → `[PHONE]`
- Emails → `[EMAIL]`
- Specific locations → City-level only
- Example: "I met Priya at Khan Market" → "I met [NAME] in Delhi"

### Consent Enforcement
- If `consent.research == false` → exclude from training
- If `consent.audio_retention == false` → exclude voice_summary from features
- Check monthly for opt-outs; retract data

### Sensitive Content
- Self-harm / suicidal ideation → flag for crisis team, exclude from training
- Medical/legal advice sought → exclude from training
- Under-18 → exclude entirely

---

## 8. Example Labeled Reflections

See `labeling/examples/` for:
- `perception_example_001.json` (full perception labels)
- `sft_example_001.json` (good generation)
- `dpo_pair_001.json` (good vs bad pair)
- `edge_case_hinglish.json` (code-mixed example)
- `edge_case_low_willingness.json` (social inhibition)

---

## 9. Schema Versioning

- **Current**: v1.0
- **Breaking changes**: Increment major version
- **Additions**: Increment minor version
- **Migration**: Run `scripts/migrate_schema.py --from v1.0 --to v1.1`

---

## References

- **EES-1 Schema**: `src/utils/emotion_schema.py`
- **Banned Phrases**: `data/meta/banned_phrases.txt`
- **Blend Weights**: `models/hybrid_v1/blend_weights.json`
- **Validation**: `scripts/qa_dataset.py`

---

**Status**: ✅ v1.0 Finalized (Nov 2025)
