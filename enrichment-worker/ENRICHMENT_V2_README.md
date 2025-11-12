# Enrichment Pipeline v2.0 - Rules-Based Upgrade

## Overview

This is a **rules-based upgrade** to the emotion enrichment pipeline, improving accuracy and robustness without adding new LLMs or training. All enhancements use classical NLP, pattern matching, and existing models (HuggingFace zero-shot + embeddings).

### Key Improvements

✅ **Negation reversal** with 3-token window emotion flipping  
✅ **Sarcasm detection** using rule-based heuristics (positive word + negative context)  
✅ **Profanity sentiment** distinguishing positive hype vs negative frustration  
✅ **Event valence** as separate variable (event positivity ≠ emotion positivity)  
✅ **Control fallback** with passive voice, volition verbs, and confidence scoring  
✅ **Expanded valence ranges** reducing Sad/Angry/Fearful overlap  
✅ **Intensity parsing** modulating VA within ranges ("very sad" vs "slightly sad")  
✅ **Multi-domain detection** with primary/secondary domains and mixture ratio  
✅ **Confidence scoring** based on signal agreement across all components  

---

## Architecture

```
Text Input
    ↓
[Preprocessing] → lowercase, tokenize
    ↓
[Cue Extraction] → negation, sarcasm, profanity, event anchors, control, polarity, domain
    ↓
[HF Model] → 6 primary probabilities
    ↓
[Negation Flip] → adjust probabilities if "not happy" detected
    ↓
[Sarcasm Adjustment] → reduce Happy/Strong if sarcasm detected
    ↓
[Context Rerank] → 6-term formula:
        Score = α·HF + β·Similarity + γ·Domain + δ·Control + ε·Polarity + ζ·EventValence
    ↓
[Valence/Arousal] → expanded ranges + intensity + drivers + circadian + event blending
    ↓
[Profanity Arousal Boost] → +0.05 to +0.12 based on phrase count
    ↓
[Confidence Scoring] → signal agreement → [0,1]
    ↓
Final Result: {primary, secondary, valence, arousal, event_valence, domain, control, polarity, confidence, flags}
```

---

## Core Concepts

### Primary Emotion
One of **6 Willcox primaries**: `Happy`, `Strong`, `Peaceful`, `Sad`, `Angry`, `Fearful`

### Secondary Emotion
One of **36 Willcox children** (constrained by primary hierarchy)

### Valence (Emotion Valence)
**Positivity/negativity of the felt emotion** [0, 1]
- High valence (0.8-0.9): Happy, Peaceful
- Low valence (0.12-0.42): Sad, Angry, Fearful

### Arousal
**Energy/activation of the emotion** [0, 1]
- High arousal (0.64-0.84): Angry, Fearful
- Low arousal (0.28-0.48): Peaceful, Sad

### Event Valence (NEW)
**Positivity/negativity of the event itself**, independent of emotion [0, 1]

**Example**: "Got promoted but anxious I can't keep up"
- Event Valence: **0.85** (promotion = positive event)
- Emotion Valence: **0.25** (anxiety = negative emotion)

### Domain
Event context: `work`, `relationship`, `family`, `health`, `money`, `study`, `social`, `self`

Supports **multi-domain** with mixture ratio (e.g., family 60% + work 40%)

### Control
User's perceived control: `low`, `medium`, `high`

### Polarity
Event temporal state: `planned`, `happened`, `did_not_happen`

---

## Rerank Formula

```python
Score = α·p_HF + β·Sim_sec + γ·Domain + δ·Control + ε·Polarity + ζ·EventValence

# Default weights:
α = 0.18  # HF model probability
β = 0.18  # Secondary similarity
γ = 0.26  # Domain prior
δ = 0.22  # Control alignment
ε = 0.04  # Polarity alignment
ζ = 0.12  # Event valence (NEW)
```

### Domain Prior Table (excerpt)

| Emotion  | work   | health | relationship | money  |
|----------|--------|--------|--------------|--------|
| Angry    | +1.0   | +0.3   | +0.5         | +0.5   |
| Fearful  | +0.5   | +1.0   | +0.5         | +1.0   |
| Happy    | -0.3   | -0.3   | +0.5         | -0.3   |
| Strong   | +0.5   | -0.5   | -0.5         | +0.3   |

**Example**: "Mind went haywire before presentation"
- Domain: **work** → Angry (+1.0), Fearful (+0.5)
- Control: **low** → Fearful (+1.0), Angry (-0.5)
- Result: **Fearful** wins despite HF model preferring Strong

---

## Valence/Arousal Ranges

### Expanded Ranges (Reduced Overlap)

```python
WILLCOX_VA_MAP = {
    'Happy':    {'valence': (0.80, 0.92), 'arousal': (0.50, 0.65)},
    'Strong':   {'valence': (0.70, 0.88), 'arousal': (0.55, 0.72)},
    'Peaceful': {'valence': (0.72, 0.86), 'arousal': (0.28, 0.46)},
    'Sad':      {'valence': (0.12, 0.32), 'arousal': (0.28, 0.48)},  # Expanded from 0.2
    'Angry':    {'valence': (0.20, 0.42), 'arousal': (0.64, 0.82)},  # Expanded from 0.2
    'Fearful':  {'valence': (0.16, 0.38), 'arousal': (0.66, 0.84)},  # Expanded from 0.2
}
```

### Intensity Modulation

```python
# Positive intensifiers
{"very": 0.15, "really": 0.12, "extremely": 0.20, "absolutely": 0.18}

# Negative intensifiers (reducers)
{"slightly": -0.10, "a bit": -0.07, "barely": -0.12, "somewhat": -0.08}

# Intensity score I ∈ [-0.3, +0.3]
valence = base_valence + I * (range_width / 2)
arousal = base_arousal + I * (range_width / 2)
```

**Example**: "Extremely sad" → valence moves toward lower bound (0.12)

---

## Rule Tables

### Event Anchors

**Positive**: promoted, hired, passed, recovered, bonus, appreciation, completed, on time, resolved, reconciled, achieved, won

**Negative**: missed, failed, cancelled, rejected, fired, debt, injury, delay, traffic, breakup, argument, hospital, laid off, insulted

### Profanity

**Positive Hype**: "fuck yeah", "hell yes", "damn right", "let's go"  
**Negative Frustration**: "fuck this", "screw this", "dammit", "shit show"  
**Arousal Boost**: +0.05 to +0.12 (clipped)

### Sarcasm Patterns

**Pattern A** (positive word + negative context):  
`"Great, another deadline"` → positive token ("great") + negative anchor ("deadline")

**Pattern B** (scare quotes):  
`"great" choice`, `'amazing' decision` → quoted positive words

**Pattern C** (discourse markers):  
`"yeah right"`, `"as if"`, `"of course"` + negative context

### Control Cues

**Low Control**:
- Passive voice: "was told", "got fired", "was forced"
- Helpless markers: "couldn't", "unable to", "overwhelmed", "stuck"
- External causatives: "because of traffic", "boss said", "system crashed"

**High Control**:
- Volition verbs: "decided to", "chose to", "I set", "I led", "I managed"
- Success markers: "I fixed", "I solved", "I completed", "I achieved"
- Agency markers: "took control", "made it happen", "my decision"

**Medium Control**:
- Ongoing effort: "I'm trying", "working on it", "attempting to"
- Mixed signals: "partly my fault", "some control", "depends on"

### Polarity Patterns

**Planned**: will, going to, planning, scheduled, upcoming, intend to  
**Did Not Happen**: didn't, failed, missed, cancelled, unable to, couldn't  
**Counterfactual**: if I had, wish I had, should have, could have, if only  
**Present Progressive**: I'm working, currently, right now, in progress

---

## Confidence Scoring

Weighted average of **8 components**:

| Component            | Weight | Description                                      |
|----------------------|--------|--------------------------------------------------|
| HF Confidence        | 20%    | Entropy of HF probability distribution           |
| Rerank Agreement     | 20%    | Does HF winner match rerank winner?              |
| Negation Consistency | 12%    | Negated emotions shouldn't win                   |
| Sarcasm Consistency  | 8%     | Sarcasm → negative emotions should win           |
| Control Confidence   | 15%    | Rule-based control detection confidence          |
| Polarity Confidence  | 8%     | Pattern matching explicitness                    |
| Domain Confidence    | 10%    | Keyword match strength                           |
| Secondary Confidence | 7%     | Embedding similarity score                       |

**Confidence Categories**:
- **High** (≥0.75): Clear signals, strong agreement
- **Medium** (0.60-0.74): Reasonable agreement, some ambiguity
- **Low** (0.45-0.59): Conflicting signals, uncertain
- **Uncertain** (<0.45): Highly ambiguous, flag for review

---

## Usage

### Basic Usage

```python
from enrich import enrich

# Mock HF model probabilities
p_hf = {
    'Happy': 0.6, 'Strong': 0.2, 'Peaceful': 0.1,
    'Sad': 0.05, 'Angry': 0.03, 'Fearful': 0.02
}

# Mock embedding similarities
secondary_sim = {
    'Joyful': 0.85, 'Proud': 0.75, 'Relieved': 0.7
}

# Enrich
result = enrich(
    text="I can't believe I finally finished this project on time!",
    p_hf=p_hf,
    secondary_similarity=secondary_sim
)

print(result)
# {
#     'primary': 'Happy',
#     'secondary': 'Joyful',
#     'valence': 0.863,
#     'arousal': 0.575,
#     'event_valence': 0.850,
#     'domain': {'primary': 'work', 'secondary': None, 'mixture_ratio': 1.0},
#     'control': 'high',
#     'polarity': 'happened',
#     'confidence': 0.782,
#     'confidence_category': 'high',
#     'flags': {'negation': False, 'sarcasm': False, 'profanity': 'none'}
# }
```

### With History & User Priors

```python
# Previous enrichment for EMA smoothing
history = {'valence': 0.75, 'arousal': 0.60}

# User-specific priors (learned from past reflections)
user_priors = {
    ('work', 'low'): {'Fearful': 15, 'Angry': 10, 'Sad': 5, 'Happy': 2, 'Strong': 1, 'Peaceful': 1}
}

result = enrich(
    text="Boss yelled at me about the report",
    p_hf=p_hf,
    secondary_similarity=secondary_sim,
    history=history,
    user_priors=user_priors
)
```

---

## Testing

### Run Unit Tests

```bash
cd enrichment-worker
pytest tests/unit/test_components.py -v
```

### Run Acceptance Tests

```bash
pytest tests/test_acceptance.py -v -s
```

### Test Coverage

- ✅ Negation flip (8 test cases)
- ✅ Sarcasm detection (6 test cases)
- ✅ Profanity sentiment (5 test cases)
- ✅ Event valence (6 test cases)
- ✅ Control detection (5 test cases)
- ✅ Polarity detection (5 test cases)
- ✅ Multi-domain (3 test cases)
- ✅ Integration (10 regression cases)

**Total**: 48 automated test cases

---

## Acceptance Criteria

### ✅ Negation Handling
- [x] "I'm not happy" → NOT Happy (≥80% success)
- [x] "not angry anymore" → Peaceful/Happy
- [x] Negation flag set correctly

### ✅ Sarcasm Detection
- [x] "Great, another deadline" → negative emotion (≥75% correct direction)
- [x] Event valence decreased by sarcasm
- [x] Sarcasm flag set correctly

### ✅ Profanity Arousal
- [x] Arousal boost +0.05 to +0.12
- [x] Positive hype ("fuck yeah") → boost Happy/Strong
- [x] Negative frustration ("fuck this") → boost Angry/Sad

### ✅ Control Fallback
- [x] Never returns None
- [x] Passive voice → low control
- [x] Volition verbs → high control
- [x] Confidence score [0, 1]

### ✅ Event Valence
- [x] Emitted for every sample
- [x] Influences rerank (ζ = 0.12 weight)
- [x] "Promoted but terrified" → EV high, emotion valence low

### ✅ Confidence Calibration
- [x] Uncertain flag (<0.6) for conflicting signals
- [x] High confidence (≥0.75) for clear cases

---

## File Structure

```
enrichment-worker/
├── rules/
│   ├── anchors.json          # Event anchors, sarcasm tokens
│   ├── intensifiers.json     # Intensity modifiers
│   ├── profanity.json        # Profanity phrases
│   └── control_cues.json     # Control detection patterns
├── src/
│   └── enrich/
│       ├── __init__.py
│       ├── pipeline.py       # Main orchestration
│       ├── negation.py       # Negation reversal
│       ├── sarcasm.py        # Sarcasm detection
│       ├── profanity.py      # Profanity sentiment
│       ├── event_valence.py  # Event valence calculation
│       ├── control.py        # Control fallback
│       ├── polarity.py       # Polarity detection
│       ├── domain.py         # Multi-domain detection
│       ├── va.py             # Valence/arousal calculation
│       ├── rerank.py         # Context-based reranking
│       └── confidence.py     # Confidence scoring
└── tests/
    ├── unit/
    │   └── test_components.py   # Unit tests
    └── test_acceptance.py        # Regression suite
```

---

## Future Enhancements

### Not Included (Out of Scope)
- ❌ New LLM calls (per requirements)
- ❌ Model fine-tuning (per requirements)
- ❌ Hinglish training (per requirements)

### Could Add (Rules-Based)
- Emoji sentiment parsing (😊 → positive, 😢 → negative)
- Temporal progression tracking (escalation/de-escalation)
- Relationship state tracking (mention of "ex" vs "partner")
- Cultural context keywords (festivals, rituals)

---

## Contributors

Built with ❤️ for **Leo** - the mindfulness/wellbeing platform
