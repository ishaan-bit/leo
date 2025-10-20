# 🎭 Emotion Lexicon & Wheel Reference

**Last Updated**: October 20, 2025

This document explains how `invoked`, `expressed`, `primary`, and `secondary` emotions are determined in the enrichment pipeline.

---

## 📚 Baseline Enricher Lexicon

The baseline enricher uses a **hand-crafted lexicon** of emotion words mapped to:
- **Valence delta** (-1 to 1): How much the word shifts mood
- **Arousal delta** (-1 to 1): How much the word shifts activation
- **Event labels**: Semantic tags for the emotion

### Full Lexicon

Located in: `enrichment-worker/src/modules/baseline_enricher.py`

#### 😔 Fatigue Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| tired | -0.25 | -0.10 | fatigue |
| exhausted | -0.30 | -0.15 | fatigue |
| drained | -0.28 | -0.12 | fatigue |
| weary | -0.25 | -0.10 | fatigue |
| fatigued | -0.27 | -0.12 | fatigue |

#### 😤 Irritation/Anger Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| irritated | -0.20 | +0.30 | irritation |
| annoyed | -0.18 | +0.25 | irritation |
| frustrated | -0.22 | +0.28 | frustration |
| angry | -0.30 | +0.40 | anger |
| furious | -0.35 | +0.50 | anger |
| resentful | -0.25 | +0.30 | resentment |
| bitter | -0.28 | +0.25 | resentment |

#### 📉 Progress/Productivity Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| stuck | -0.15 | +0.15 | low_progress |
| unproductive | -0.20 | +0.10 | low_progress |
| progress | +0.15 | +0.10 | progress |
| accomplished | +0.30 | +0.15 | accomplishment |
| productive | +0.25 | +0.12 | accomplishment |

#### 😊 Joy/Happiness Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| happy | +0.30 | +0.20 | joy |
| joyful | +0.35 | +0.25 | joy |
| content | +0.25 | -0.05 | contentment |
| satisfied | +0.28 | +0.05 | contentment |
| peaceful | +0.30 | -0.15 | contentment |
| grateful | +0.32 | +0.10 | gratitude |
| excited | +0.35 | +0.40 | excitement |
| enthusiastic | +0.33 | +0.38 | enthusiasm |
| proud | +0.30 | +0.20 | pride |
| ecstatic | +0.45 | +0.50 | ecstasy |

#### 😰 Anxiety/Fear Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| worried | -0.22 | +0.35 | anxiety |
| anxious | -0.25 | +0.40 | anxiety |
| nervous | -0.20 | +0.38 | nervousness |
| overwhelmed | -0.28 | +0.42 | stress |
| stressed | -0.25 | +0.40 | stress |
| scared | -0.30 | +0.45 | fear |
| fearful | -0.28 | +0.43 | fear |
| terrified | -0.40 | +0.55 | terror |
| panicked | -0.38 | +0.60 | panic |

#### 😢 Sadness Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| sad | -0.30 | -0.05 | sadness |
| lonely | -0.28 | -0.08 | loneliness |
| melancholic | -0.25 | -0.10 | melancholy |
| disappointed | -0.22 | +0.08 | disappointment |

#### 🤢 Disgust Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| disgusted | -0.28 | +0.20 | disgust |
| bored | -0.15 | -0.20 | boredom |
| indifferent | 0.00 | -0.15 | indifference |
| numb | -0.20 | -0.25 | apathy |
| ashamed | -0.30 | +0.15 | shame |

#### 🤝 Trust Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| trusting | +0.20 | +0.05 | trust |
| hopeful | +0.25 | +0.15 | hope |
| compassionate | +0.22 | +0.10 | compassion |

#### 😲 Surprise Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| surprised | +0.05 | +0.35 | surprise |
| confused | -0.10 | +0.25 | confusion |
| conflicted | -0.05 | +0.20 | ambivalence |

#### 🔮 Anticipation Cluster
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| anticipating | +0.15 | +0.25 | anticipation |
| inspired | +0.30 | +0.30 | inspiration |

#### 🧘 Other Emotions
| Word | Valence Δ | Arousal Δ | Events |
|------|-----------|-----------|--------|
| calm | +0.20 | -0.15 | calm |
| relaxed | +0.25 | -0.20 | relaxation |
| energized | +0.28 | +0.35 | vitality |
| relieved | +0.25 | -0.10 | relief |
| jealous | -0.20 | +0.30 | jealousy |
| serene | +0.30 | -0.25 | serenity |

---

## 🎡 Plutchik Wheel Mapping

Events are mapped to **8 primary Plutchik emotions**:

```python
wheel_map = {
    'joy': [
        'joy', 'happiness', 'contentment', 'satisfaction', 
        'gratitude', 'excitement', 'pride', 'ecstasy', 
        'accomplishment', 'progress'
    ],
    
    'sadness': [
        'sadness', 'loneliness', 'melancholy', 'disappointment', 
        'fatigue', 'low_progress', 'frustration'
    ],
    
    'anger': [
        'anger', 'irritation', 'frustration', 'resentment', 
        'annoyance', 'jealousy'
    ],
    
    'fear': [
        'fear', 'anxiety', 'nervousness', 'stress', 
        'worry', 'terror', 'panic'
    ],
    
    'disgust': [
        'disgust', 'shame', 'boredom', 'apathy', 'indifference'
    ],
    
    'surprise': [
        'surprise', 'confusion', 'ambivalence'
    ],
    
    'trust': [
        'trust', 'compassion', 'hope', 'calm', 'focus'
    ],
    
    'anticipation': [
        'anticipation', 'inspiration', 'enthusiasm', 
        'motivation', 'optimism'
    ]
}
```

### How Primary/Secondary Are Chosen

1. **Count events** by Plutchik category
2. **Primary** = emotion with most event matches
3. **Secondary** = emotion with 2nd most matches, or **opposite** of primary if no matches

#### Plutchik Opposites
- joy ↔ sadness
- anger ↔ fear
- trust ↔ disgust
- surprise ↔ anticipation

---

## 🏷️ Invoked vs Expressed

### `invoked` (Internal Feeling)
Combines the **top 2 events** detected:

```python
def infer_invoked(events, valence, arousal):
    if not events or events == ['neutral']:
        return 'neutral'
    
    primary_events = events[:2]
    return ' + '.join(primary_events)
```

**Examples**:
- `"fatigue + frustration"` (tired and irritated)
- `"nostalgia"` (single event)
- `"anxiety + low_progress"` (worried about productivity)

### `expressed` (Outward Tone)
Based on **valence/arousal quadrants**:

```python
def infer_expressed(valence, arousal):
    if valence < 0.30 and arousal < 0.40:
        return 'deflated / resigned'      # Low mood, low energy
    
    elif valence < 0.35 and arousal > 0.55:
        return 'irritated / tense'        # Low mood, high energy
    
    elif valence > 0.70 and arousal > 0.60:
        return 'enthusiastic / animated'  # High mood, high energy
    
    elif valence > 0.65 and arousal < 0.40:
        return 'calm / content'           # High mood, low energy
    
    elif arousal > 0.70:
        return 'agitated / activated'     # Very high energy
    
    elif arousal < 0.30:
        return 'subdued / quiet'          # Very low energy
    
    else:
        return 'matter-of-fact'           # Neutral
```

**Circumplex Model**:
```
       High Arousal
            │
   tense   │   animated
            │
────────────┼──────────── Valence
            │
 resigned   │   calm
            │
       Low Arousal
```

---

## 🤖 Ollama Enrichment

Ollama (phi3 model) receives this prompt:

```
You enrich a normalized daily reflection. Use ONLY the text below. Return STRICT JSON.

Normalized:
<<<
{normalized_text}
>>>

Respond with EXACTLY this structure:
{
  "invoked": "short label(s) for internal feeling (e.g., 'fatigue + frustration')",
  "expressed": "short label(s) for outward tone (e.g., 'irritated / deflated')",
  "wheel": { 
    "primary": "MUST be ONE of: joy, sadness, anger, fear, trust, disgust, surprise, anticipation",
    "secondary": "MUST be ONE of: joy, sadness, anger, fear, trust, disgust, surprise, anticipation"
  },
  "valence": 0.5,
  "arousal": 0.5,
  "confidence": 0.75,
  "events": ["fatigue","irritation","low_progress"],
  "warnings": [],
  "willingness_cues": {
    "hedges": [],
    "intensifiers": [],
    "negations": [],
    "self_reference": []
  }
}

CRITICAL RULES:
1. wheel.primary and wheel.secondary MUST be lowercase single Plutchik emotions
2. Valid emotions ONLY: joy, sadness, anger, fear, trust, disgust, surprise, anticipation
3. NO combinations like "Sadness + Disappointment" - pick ONE primary emotion
4. NO phrases like "Trust - Betrayal" - pick ONE secondary emotion
```

**Ollama has freedom to**:
- Generate **any invoked/expressed labels** (not limited to lexicon)
- Detect **nuanced emotions** not in baseline lexicon
- Use **contextual understanding** (e.g., "spending Diwali with parents" → nostalgia)

---

## 🔀 Hybrid Blending

Final output = **35% baseline + 65% Ollama**:

```python
def blend(baseline, ollama, alpha=0.35):
    return {
        'invoked': ollama['invoked'],           # Use Ollama (more nuanced)
        'expressed': ollama['expressed'],       # Use Ollama (more nuanced)
        'wheel': {
            'primary': ollama['wheel']['primary'],      # Use Ollama
            'secondary': ollama['wheel']['secondary']   # Use Ollama
        },
        'valence': alpha * baseline['valence'] + (1-alpha) * ollama['valence'],
        'arousal': alpha * baseline['arousal'] + (1-alpha) * ollama['arousal'],
        'confidence': max(baseline['confidence'], ollama['confidence']),
        'events': merge_events(baseline['events'], ollama['events'])
    }
```

**Why blend?**
- **Baseline**: Fast, consistent, catches common patterns
- **Ollama**: Contextual, nuanced, handles edge cases
- **Blending**: Moderates extreme values, improves robustness

---

## 📊 Example Walkthrough

**Input**: `"I am spending Diwali with my parents after a long time, reminds me of childhood days"`

### Baseline Analysis
1. **Lexicon scan**: No direct emotion words found
2. **Events detected**: None
3. **Default**: `invoked="neutral"`, `expressed="matter-of-fact"`
4. **Wheel**: `primary="surprise"` (fallback), `secondary="anticipation"`
5. **Valence**: 0.50 (baseline)
6. **Arousal**: 0.50 (baseline)

### Ollama Analysis
1. **Context understanding**: Diwali + parents + "long time" → nostalgia
2. **Invoked**: `"['nostalgia', 'longing']"` (captures wistful feeling)
3. **Expressed**: `"['wistful + reflective']"` (outward tone)
4. **Wheel**: `primary="sadness"` (nostalgia is bittersweet), `secondary="anticipation"`
5. **Valence**: 0.6 (slightly positive, but wistful)
6. **Arousal**: 0.4 (calm reflection)

### Blended Output
```json
{
  "invoked": "['nostalgia', 'longing']",        // From Ollama
  "expressed": "['wistful + reflective']",      // From Ollama
  "wheel": {
    "primary": "sadness",                       // From Ollama
    "secondary": "anticipation"                 // From Ollama
  },
  "valence": 0.57,                              // 0.35*0.50 + 0.65*0.6
  "arousal": 0.43,                              // 0.35*0.50 + 0.65*0.4
  "confidence": 0.85,                           // max(baseline, ollama)
  "events": [
    {"label": "nostalgia", "confidence": 0.6},
    {"label": "wistfulness", "confidence": 0.6}
  ]
}
```

---

## 🎨 Adding New Emotions

### To Add a New Word to Baseline Lexicon

1. Open `enrichment-worker/src/modules/baseline_enricher.py`
2. Add entry to `build_lexicon()`:
   ```python
   'nostalgic': (-0.10, 0.15, ['nostalgia']),  # Slightly bittersweet, moderate arousal
   ```
3. Add event to wheel mapping in `build_wheel_map()`:
   ```python
   'sadness': [..., 'nostalgia'],  # Add to sadness cluster
   ```
4. Test:
   ```powershell
   cd enrichment-worker
   python -c "from src.modules.baseline_enricher import BaselineEnricher; \
              e = BaselineEnricher(); \
              print(e.enrich('feeling nostalgic today'))"
   ```

### To Retrain Ollama

Ollama learns from its **base model training** (phi3). You cannot retune without:
1. Fine-tuning phi3 on your own dataset, or
2. Switching to a different model (llama3.2, mistral, etc.)

**Current approach**: Rely on Ollama's general understanding + strict JSON schema constraints.

---

## 📖 References

- **Plutchik's Wheel of Emotions**: https://en.wikipedia.org/wiki/Robert_Plutchik#Plutchik's_wheel_of_emotions
- **Circumplex Model (Russell)**: Valence-Arousal space for emotions
- **Baseline Lexicon**: Hand-crafted from affective computing research + trial-and-error tuning
- **Ollama Prompt Engineering**: Iterative refinement to enforce strict JSON + Plutchik constraint

---

**Last Updated**: October 20, 2025  
**Baseline Pass Rate**: 66% (50 test cases)  
**Ollama Model**: phi3:latest  
**Blend Ratio**: 35% baseline, 65% Ollama
