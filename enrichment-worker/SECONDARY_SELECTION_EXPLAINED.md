# How Secondaries Are Currently Calculated

## Current Implementation (INCOMPLETE)

### Step 1: HuggingFace Model Embedding
**Location:** External to enrichment pipeline (likely in the worker that calls `enrich()`)

The HuggingFace model generates embeddings for the input text and computes **cosine similarity** with all 36 secondary emotion embeddings:

```python
# Pseudocode (happens BEFORE enrichment pipeline)
text_embedding = hf_model.encode(text)

secondary_similarity = {}
for secondary in ALL_36_SECONDARIES:
    secondary_embedding = hf_model.encode(secondary)
    similarity = cosine_similarity(text_embedding, secondary_embedding)
    secondary_similarity[secondary] = similarity

# Example result:
# {
#   'Joyful': 0.82,
#   'Determined': 0.65,
#   'Anxious': 0.43,
#   ...
# }
```

### Step 2: Enrichment Pipeline - Primary Selection
**Location:** `src/enrich/pipeline.py` line 90-100

The pipeline uses a **6-term rerank formula** to select the best primary:

```python
best_primary, rerank_scores = rerank.rerank_emotions(
    p_hf=p_hf_sarc,
    event_valence=event_val_sarc,
    control_level=control_level,
    polarity=polarity_val,
    domain_primary=domain_primary,
    user_priors=user_priors
)

# Rerank formula:
score = (
    0.40 * p_hf[primary] +              # HF model confidence
    0.20 * event_valence_alignment +    # Event outcome match
    0.15 * control_alignment +          # Control/agency match
    0.10 * polarity_alignment +         # Sentiment match
    0.10 * domain_prior +               # Context prior (work→Strong, etc)
    0.05 * user_prior                   # User history
)

# Winner: primary with highest rerank score
best_primary = max(rerank_scores, key=rerank_scores.get)
```

### Step 3: Secondary Selection (CURRENT - BROKEN)
**Location:** `src/enrich/pipeline.py` line 105-106

```python
# TODO: use Willcox hierarchy
best_secondary = max(secondary_similarity, key=secondary_similarity.get)
```

**Problem:** This picks the **globally highest similarity secondary**, ignoring the selected primary!

**Example Bug:**
```
Text: "working so hard without much success yet"
Primary selected: Strong (correct - high control, low event valence)
Secondary from global max: Joyful (WRONG - belongs to Happy!)
Secondary should be: Determined or Resilient (belong to Strong)
```

---

## What SHOULD Happen (Based on wheel.txt)

### Strict Hierarchy Rules

**wheel.txt Structure:**
```json
{
  "cores": [
    {"name": "Happy", "nuances": [
      {"name": "Excited", "micro": [...]},
      {"name": "Interested", "micro": [...]},
      ...
    ]},
    {"name": "Strong", "nuances": [
      {"name": "Confident", "micro": [...]},
      {"name": "Proud", "micro": [...]},
      ...
    ]},
    ...
  ]
}
```

**6 Primaries (cores):**
1. Happy (Vera)
2. Strong (Ashmere)
3. Peaceful (Haven)
4. Sad (Vanta)
5. Angry (Sable)
6. Fearful (Vire)

**36 Secondaries (nuances):**
Each primary has exactly 6 secondaries (nuances).

**216 Micro-emotions:**
Each secondary has exactly 6 micro-emotions.

### Fixed Secondary Selection Algorithm

```python
def select_secondary_validated(
    primary: str,
    secondary_similarity: Dict[str, float],
    event_valence: float,
    control_level: str,
    wheel_map: Dict[str, List[str]]
) -> str:
    """
    Select secondary from valid children of the primary.
    
    Args:
        primary: Selected primary emotion (e.g., "Strong")
        secondary_similarity: HF similarity scores for ALL secondaries
        event_valence: Event outcome score [0, 1]
        control_level: "low", "medium", "high"
        wheel_map: Primary → [valid secondaries] mapping from wheel.txt
        
    Returns:
        Best secondary that belongs to the primary
    """
    # 1. Filter to valid secondaries for this primary
    valid_secondaries = wheel_map.get(primary, [])
    
    if not valid_secondaries:
        raise ValueError(f"Unknown primary: {primary}")
    
    # 2. Filter similarity dict to only valid secondaries
    valid_sim = {
        sec: score 
        for sec, score in secondary_similarity.items() 
        if sec in valid_secondaries
    }
    
    # 3. Context-aware selection (if needed)
    # If low event valence + high control → prefer "Determined", "Resilient"
    if primary == "Strong" and event_valence <= 0.3 and control_level == "high":
        # Prefer struggle-related secondaries
        struggle_secondaries = ["Resilient", "Courageous", "Hopeful"]
        struggle_candidates = {
            sec: score * 1.2  # Boost by 20%
            for sec, score in valid_sim.items()
            if sec in struggle_secondaries
        }
        if struggle_candidates:
            valid_sim.update(struggle_candidates)
    
    # 4. Select highest similarity from valid set
    if not valid_sim:
        # Fallback: pick first valid secondary
        return valid_secondaries[0]
    
    best_secondary = max(valid_sim, key=valid_sim.get)
    return best_secondary
```

---

## Implementation Checklist

### Phase 1: Load wheel.txt hierarchy ✅ DONE
- [x] Created `valid_secondaries.txt` with correct mappings
- [ ] Load wheel.txt JSON dynamically
- [ ] Validate all 6 primaries × 6 secondaries = 36 mappings

### Phase 2: Enforce validation in pipeline ❌ NOT STARTED
- [ ] Replace `max(secondary_similarity)` with filtered selection
- [ ] Add `wheel_map` parameter to `enrich()` function
- [ ] Validate primary-secondary parent-child relationship

### Phase 3: Context-aware boosting ❌ NOT STARTED
- [ ] Boost "Resilient"/"Determined" if low event_valence + high control
- [ ] Boost "Hopeful"/"Optimistic" if low event_valence + Happy primary
- [ ] Penalize "Joyful"/"Playful" if event_valence < 0.3

### Phase 4: Testing ❌ NOT STARTED
- [ ] Unit test: "working without success" → Strong + (Resilient OR Determined)
- [ ] Unit test: "got promoted" → Happy + (Excited OR Proud)
- [ ] Integration test: All secondaries must be valid children

---

## Current vs Fixed Behavior

### Example 1: Struggle Without Success

**Text:** `"working so hard without much success yet"`

**Current (BROKEN):**
```
Primary: Strong ✓ (correct - high control, low event valence)
Secondary: Joyful ✗ (WRONG - belongs to Happy, not Strong!)
```

**Fixed:**
```
Primary: Strong ✓
Valid secondaries: [Confident, Proud, Respected, Courageous, Hopeful, Resilient]
Context boost: Resilient, Courageous, Hopeful (struggle + high control)
Secondary: Resilient ✓ (correct!)
```

### Example 2: Promotion

**Text:** `"got promoted today"`

**Current:**
```
Primary: Happy ✓
Secondary: (whatever has max similarity globally)
```

**Fixed:**
```
Primary: Happy ✓
Valid secondaries: [Excited, Interested, Energetic, Playful, Creative, Optimistic]
Event valence: 0.99 (very positive)
Secondary: Excited or Playful ✓ (context-appropriate!)
```

---

## Next Steps

1. **Load wheel.txt** into a PRIMARY_SECONDARY_MAP dict
2. **Replace line 105-106** in `pipeline.py` with validated selection
3. **Add context rules** for struggle, success, social situations
4. **Test with real examples** to verify correctness

**Priority:** HIGH - This is causing incorrect emotion detection in production!
