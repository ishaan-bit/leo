# Enrichment Pipeline v2.2 - Technical Specification

## Overview

The v2.2 enrichment pipeline processes user reflections (text input) and outputs structured emotional analysis. This document details how each variable is calculated.

**Pipeline Version:** v2.2  
**Date:** November 5, 2025  
**Emotion Taxonomy:** 6 Primary → 36 Secondary → 197 Tertiary (based on Willcox Feelings Wheel)

---

## Pipeline Architecture

### High-Level Flow

```
Input Text
    ↓
1. Feature Extraction
    ↓
2. Clause Segmentation & Weighting
    ↓
3. Negation Analysis
    ↓
4. Dual Valence Computation
    ↓
5. Primary Emotion Scoring
    ↓
6. Secondary Emotion Selection
    ↓
7. Tertiary Emotion Detection
    ↓
8. Neutral State Detection
    ↓
9. Domain Classification
    ↓
10. Control & Polarity Inference
    ↓
Output: EnrichmentResult
```

---

## Output Variables

### 1. Primary Emotion (`primary: str`)

**Definition:** Top-level emotion category from 6 primaries + Neutral.

**Taxonomy:**
- `Happy` - Positive, pleasant emotions
- `Sad` - Negative, low-energy emotions
- `Angry` - Negative, high-energy, confrontational emotions
- `Fearful` - Negative, high-energy, avoidant emotions
- `Strong` - Positive, empowered emotions
- `Peaceful` - Positive, calm emotions
- `Neutral` - Flat affect, no discernible emotion (only if `include_neutral=True`)

**Calculation Method:**
1. **Keyword Detection:** Check text for emotion-specific keywords
   - `Happy`: "happy", "excited", "joy", "glad", "proud", "grateful"
   - `Sad`: "sad", "depressed", "lonely", "heartbroken", "hopeless"
   - `Angry`: "angry", "frustrated", "furious", "irritated", "mad"
   - `Fearful`: "anxious", "worried", "scared", "nervous", "overwhelmed"
   - `Strong`: "confident", "powerful", "capable", "determined"
   - `Peaceful`: "peaceful", "calm", "relaxed", "content", "serene"

2. **Profanity Boost:** If profanity detected ("fuck", "shit", "damn"), boost `Angry` score by +0.30

3. **Valence-Based Scoring:**
   - If `emotion_valence < 0.4` → Score `Sad`, `Fearful`, `Angry` higher
   - If `emotion_valence > 0.6` → Score `Happy`, `Strong`, `Peaceful` higher

4. **Litotes Detection:** If litotes detected ("not bad"), boost `Happy` score by +0.40

5. **Neutral Override:** Only return `Neutral` if:
   - `emotion_presence = "none"` AND
   - No emotion keywords found AND
   - No negative event words AND
   - No profanity

6. **Winner Selection:** Return emotion with highest score

**Example:**
```python
Input: "I am feeling anxious about tomorrow"
Keywords matched: "anxious" → Fearful
emotion_valence: 0.25 (negative)
Scores: {Fearful: 0.65, Sad: 0.40, Angry: 0.20, ...}
Output: primary = "Fearful"
```

---

### 2. Secondary Emotion (`secondary: Optional[str]`)

**Definition:** Mid-level emotion (36 canonical emotions derived from 6 primaries).

**Taxonomy:** 6 secondaries per primary
- **Happy:** Content, Peaceful, Grateful, Excited, Proud, Hopeful
- **Sad:** Melancholic, Lonely, Disappointed, Regretful, Hopeless, Grieving
- **Angry:** Frustrated, Irritated, Resentful, Bitter, Furious, Indignant
- **Fearful:** Anxious, Worried, Insecure, Overwhelmed, Panicked, Vulnerable
- **Strong:** Confident, Proud, Respected, Courageous, Hopeful, Resilient
- **Peaceful:** Loving, Grateful, Thoughtful, Content, Serene, Thankful

**Calculation Method:**
1. **Primary Constraint:** Secondary must belong to the selected primary
2. **Keyword Matching:** Match text keywords to secondary-specific terms
   - Example: "anxious" → `Anxious` (under Fearful)
   - Example: "frustrated" → `Frustrated` (under Angry)
3. **Arousal-Based Selection:**
   - High arousal (>0.6) → Select higher-energy secondaries (Excited, Panicked, Furious)
   - Low arousal (<0.4) → Select lower-energy secondaries (Content, Melancholic, Worried)
4. **Control-Based Selection:**
   - Low control → Vulnerable, Helpless, Overwhelmed
   - High control → Confident, Resilient, Courageous

**Example:**
```python
Input: "I am feeling anxious about tomorrow"
Primary: "Fearful"
Keywords: "anxious"
arousal: 0.72 (high)
control: "Low"
Candidate secondaries: Anxious, Worried, Overwhelmed
Match: "anxious" → Best match = "Anxious"
Output: secondary = "Anxious"
```

---

### 3. Tertiary Emotion (`tertiary: Optional[str]`)

**Definition:** Fine-grain emotion (197 micro-states from Willcox Feelings Wheel).

**Taxonomy:** Based on attached `wheel.txt` (6 cores → 36 nuances → 216 micro-states, filtered to 197)

**Calculation Method:**
1. **Motif Extraction:** Extract tertiary candidates from text using keyword matching
   - Example: "nervous" → candidates: ["Nervous", "Uneasy", "Tense"]
2. **Primary/Secondary Alignment:** Filter candidates that align with selected primary/secondary
   - If primary=Fearful, secondary=Anxious → only allow tertiaries under Fearful→Anxious branch
3. **Confidence Scoring:** Score each candidate based on:
   - Keyword match strength (exact match = 1.0, partial = 0.7)
   - Arousal alignment (high arousal text → high arousal tertiary)
   - Valence alignment
4. **Best Selection:** Return tertiary with highest confidence score

**Example:**
```python
Input: "I am feeling nervous about the presentation"
Primary: "Fearful"
Secondary: "Anxious"
Motif candidates: ["Nervous", "Uneasy", "Tense", "Worried"]
Alignment filter: Keep only tertiaries under Fearful→Anxious
Scores: {Nervous: 0.95, Uneasy: 0.60, Tense: 0.55}
Output: tertiary = "Nervous", tertiary_confidence = 0.95
```

---

### 4. Emotion Valence (`emotion_valence: float`)

**Definition:** How positive/negative the **emotion** is, range [0.0, 1.0].

**Scale:**
- `0.0` = Extremely negative emotion (despair, rage, terror)
- `0.5` = Neutral emotion
- `1.0` = Extremely positive emotion (joy, love, peace)

**Calculation Method:**
1. **Extract Features:** Count positive/negative words, intensifiers, negations
2. **Compute Raw Valence:**
   ```python
   positive_score = count(positive_words) + count(intensifiers) * 0.5
   negative_score = count(negative_words) + count(intensifiers) * 0.5
   raw_valence = (positive_score) / (positive_score + negative_score + 1)
   ```
3. **Apply Negation Adjustment:**
   ```python
   if has_negation:
       if is_litotes:  # "not bad" → positive
           emotion_valence = raw_valence + 0.40
       else:  # "not happy" → flip
           emotion_valence = 1.0 - raw_valence * negation_strength
   ```
4. **Clamp to [0.0, 1.0]**

**Example:**
```python
Input: "I am feeling tired and sad"
Negative words: ["tired", "sad"] → count = 2
Positive words: [] → count = 0
raw_valence = 0 / (0 + 2 + 1) = 0.0
Negation: None
Output: emotion_valence = 0.25 (adjusted for context)
```

---

### 5. Event Valence (`event_valence: float`)

**Definition:** How positive/negative the **event** described is, range [0.0, 1.0].

**Difference from Emotion Valence:**
- **Emotion Valence:** "I feel sad" (emotion = negative)
- **Event Valence:** "I got promoted but feel nervous" (event = positive, emotion = negative)

**Calculation Method:**
1. **Identify Event Markers:** "got", "received", "happened", "went", "did"
2. **Score Event Words:**
   - Positive events: "promoted", "passed", "won", "succeeded", "achieved"
   - Negative events: "failed", "rejected", "fired", "lost", "missed"
3. **Separate Scoring:**
   ```python
   event_positive = count(positive_event_words)
   event_negative = count(negative_event_words)
   event_valence = event_positive / (event_positive + event_negative + 1)
   ```
4. **Default to Emotion Valence:** If no event detected, `event_valence = emotion_valence`

**Example:**
```python
Input: "I failed the exam and feel terrible"
Event words: "failed" → negative event
Emotion words: "terrible" → negative emotion
event_valence = 0.20 (negative event)
emotion_valence = 0.15 (negative emotion)
```

---

### 6. Arousal (`arousal: float`)

**Definition:** Energy/activation level, range [0.0, 1.0].

**Scale:**
- `0.0` = Very low energy (calm, relaxed, tired, depressed)
- `0.5` = Moderate energy
- `1.0` = Very high energy (excited, panicked, furious, energized)

**Calculation Method:**
1. **Energy Keywords:**
   - High arousal: "excited", "anxious", "angry", "panicked", "energized", "furious"
   - Low arousal: "calm", "tired", "peaceful", "depressed", "relaxed", "bored"
2. **Intensity Markers:**
   - Intensifiers: "very", "extremely", "so", "really" → +0.20 arousal
   - Profanity: "fuck", "shit" → +0.25 arousal
3. **Arousal Scoring:**
   ```python
   arousal = 0.5  # baseline
   if high_arousal_keyword: arousal += 0.30
   if low_arousal_keyword: arousal -= 0.30
   if intensifier: arousal += 0.20
   arousal = clamp(arousal, 0.0, 1.0)
   ```

**Example:**
```python
Input: "I am extremely anxious"
High arousal keyword: "anxious" → +0.30
Intensifier: "extremely" → +0.20
arousal = 0.5 + 0.30 + 0.20 = 1.0 (clamped)
Output: arousal = 1.0
```

---

### 7. Domain (`domain: str`)

**Definition:** Life area the reflection pertains to.

**Taxonomy:** 6 domains
- `Self` - Personal growth, identity, self-reflection
- `Work` - Career, productivity, professional life
- `Relationship` - Romantic, family, friendships
- `Health` - Physical health, fitness, wellness
- `Finance` - Money, financial stress, economic concerns
- `Life` - General existential, ambiguous, or multiple domains

**Calculation Method:**
1. **Keyword Matching:**
   - `Work`: "job", "boss", "meeting", "project", "deadline", "career", "coworker"
   - `Relationship`: "partner", "friend", "family", "love", "breakup", "date"
   - `Health`: "sick", "tired", "exercise", "sleep", "pain", "doctor", "diet"
   - `Finance`: "money", "pay", "debt", "budget", "expensive", "afford"
   - `Self`: "myself", "I feel", "my emotions", "personal", "identity"
2. **Scoring:** Count keyword matches per domain
3. **Winner Selection:** Domain with most matches
4. **Default:** If no clear match → `Life`

**Example:**
```python
Input: "I am anxious about the presentation tomorrow"
Keywords: "presentation" → Work domain
Output: domain = "Work"
```

---

### 8. Control (`control: str`)

**Definition:** Perceived level of agency/autonomy.

**Values:**
- `High` - Sense of agency, empowerment, autonomy
- `Low` - Helplessness, lack of control, passivity

**Calculation Method:**
1. **Control Markers:**
   - High control: "I can", "I will", "I choose", "capable", "empowered", "control"
   - Low control: "can't", "helpless", "stuck", "powerless", "overwhelmed", "forced"
2. **Emotion-Based Inference:**
   - `Strong`, `Happy` (with high arousal) → High control
   - `Fearful`, `Sad` → Low control
   - `Angry` → Low control (frustrated by lack of control)
3. **Score:**
   ```python
   control_score = count(high_control_words) - count(low_control_words)
   if control_score > 0: control = "High"
   else: control = "Low"
   ```

**Example:**
```python
Input: "I feel helpless and anxious"
Low control words: "helpless" → -1
Primary emotion: "Fearful" → Low control
Output: control = "Low"
```

---

### 9. Polarity (`polarity: str`)

**Definition:** Whether the experience is desirable or undesirable.

**Values:**
- `Positive` - Desirable, pleasant, constructive
- `Negative` - Undesirable, unpleasant, destructive

**Calculation Method:**
1. **Valence-Based:**
   - If `emotion_valence > 0.5` → `Positive`
   - If `emotion_valence < 0.5` → `Negative`
2. **Control Adjustment:**
   - High control + positive emotion → `Positive`
   - Low control + negative emotion → `Negative`
3. **Emotion Override:**
   - `Happy`, `Strong`, `Peaceful` → `Positive`
   - `Sad`, `Angry`, `Fearful` → `Negative`

**Example:**
```python
Input: "I am feeling anxious"
emotion_valence: 0.30 (negative)
Primary: "Fearful" → Negative
Output: polarity = "Negative"
```

---

### 10. Emotion Presence (`emotion_presence: str`)

**Definition:** Strength of emotional expression in text.

**Values:**
- `none` - No emotion detected (flat affect)
- `subtle` - Mild emotional expression
- `explicit` - Strong, clear emotional expression

**Calculation Method:**
1. **Keyword Intensity:**
   - Explicit: "very sad", "extremely happy", "fucking angry"
   - Subtle: "a bit tired", "kind of worried"
   - None: No emotion keywords
2. **Scoring:**
   ```python
   if count(emotion_keywords) == 0: emotion_presence = "none"
   elif count(intensifiers) > 0: emotion_presence = "explicit"
   else: emotion_presence = "subtle"
   ```

**Example:**
```python
Input: "I am very anxious"
Emotion keyword: "anxious"
Intensifier: "very"
Output: emotion_presence = "explicit"
```

---

### 11. Is Emotion Neutral (`is_emotion_neutral: bool`)

**Definition:** Whether the text expresses **truly neutral** emotion (not just Peaceful/Calm).

**Calculation Method:**
1. **Strict Criteria:** Only `True` if:
   - `emotion_presence = "none"` AND
   - No emotion keywords detected AND
   - No profanity AND
   - No negative event words
2. **Distinction:** Neutral ≠ Peaceful
   - `Neutral`: "I went to the store" (no emotion)
   - `Peaceful`: "I feel calm and content" (positive, low arousal)

**Example:**
```python
Input: "I completed the task"
Emotion keywords: 0
Profanity: No
emotion_presence: "none"
Output: is_emotion_neutral = True
```

---

### 12. Is Event Neutral (`is_event_neutral: bool`)

**Definition:** Whether the event described is neutral (routine, neither good nor bad).

**Calculation Method:**
1. **Event Presence Check:**
   - `event_presence = "none"` → True
   - `event_presence = "routine"` → True
   - `event_presence = "specific"` → False
2. **Event Valence Check:**
   - If `event_valence` close to 0.5 (within 0.1) → Neutral

**Example:**
```python
Input: "I had lunch today"
Event: "had lunch" → routine event
event_valence: 0.50
Output: is_event_neutral = True
```

---

### 13. Flags (`flags: Dict[str, bool]`)

**Definition:** Linguistic markers detected in text.

**Fields:**

#### `has_negation: bool`
- Negation word detected ("not", "no", "never", "neither", "nor")
- Example: "I am **not** happy" → `True`

#### `negation_strength: float`
- Strength of negation, range [0.0, 1.0]
- Levels:
  - `0.15` - Weak ("hardly", "barely")
  - `0.30` - Moderate ("not really")
  - `0.45` - Strong ("not at all")
  - `0.60` - Very strong ("absolutely not", "never")

#### `is_litotes: bool`
- Litotes detected (positive via double negative)
- Patterns: "not bad", "wasn't terrible", "not a bad idea"
- Example: "The meeting **wasn't bad**" → `True`

#### `has_profanity: bool`
- Profanity detected
- Keywords: "fuck", "shit", "damn", "hell", "ass"
- Example: "I'm **fucking** tired" → `True`

#### `has_sarcasm: bool`
- Sarcasm detected (context-dependent)
- Markers: "yeah right", "sure", "oh great"
- Example: "**Oh great**, another meeting" → `True`

**Calculation Method:**
```python
negation_result = analyze_negation(text)
flags = {
    'has_negation': negation_result.present,
    'negation_strength': negation_result.strength,
    'is_litotes': negation_result.is_litotes,
    'has_profanity': any(p in text.lower() for p in PROFANITY),
    'has_sarcasm': detect_sarcasm(text)
}
```

---

### 14. Confidence (`confidence: float`)

**Definition:** Overall prediction confidence, range [0.0, 1.0].

**Calculation Method:**
1. **Base Confidence:**
   ```python
   confidence = 0.5  # baseline
   ```
2. **Keyword Match Boost:**
   - Exact emotion keyword match → +0.20
   - Partial match → +0.10
3. **Tertiary Confidence:**
   - If tertiary detected with high confidence (>0.8) → +0.15
4. **Neutral Adjustment:**
   - If `is_emotion_neutral = True` but ambiguous → -0.10
5. **Clamp to [0.0, 1.0]**

**Example:**
```python
Input: "I am feeling anxious"
Keyword match: "anxious" → +0.20
Tertiary: "Nervous" (confidence 0.90) → +0.15
confidence = 0.5 + 0.20 + 0.15 = 0.85
Output: confidence = 0.850
```

---

## Calculation Examples

### Example 1: "I am feeling anxious about tomorrow"

```python
# Step 1: Feature Extraction
features = {
    emotion_keywords: ["anxious"],
    negative_words: ["anxious"],
    positive_words: [],
    intensifiers: [],
    profanity: []
}

# Step 2: Negation Analysis
negation = {
    present: False,
    strength: 0.0,
    is_litotes: False
}

# Step 3: Dual Valence
emotion_valence = 0.30  # negative
event_valence = 0.35    # slightly negative

# Step 4: Arousal
arousal = 0.72  # high (anxious is high arousal)

# Step 5: Primary Emotion Scoring
scores = {
    Fearful: 0.65,  # "anxious" keyword
    Sad: 0.40,
    Angry: 0.20,
    Happy: 0.05,
    Strong: 0.05,
    Peaceful: 0.05
}
primary = "Fearful"

# Step 6: Secondary
secondary = "Anxious"  # exact match

# Step 7: Tertiary
tertiary = "Nervous"
tertiary_confidence = 0.85

# Step 8: Neutral Detection
is_emotion_neutral = False  # emotion keyword present
is_event_neutral = True     # no specific event

# Step 9: Domain
domain = "Life"  # no specific domain keywords

# Step 10: Control & Polarity
control = "Low"      # Fearful → low control
polarity = "Negative"  # negative valence

# Step 11: Flags
flags = {
    has_negation: False,
    negation_strength: 0.0,
    is_litotes: False,
    has_profanity: False,
    has_sarcasm: False
}

# Step 12: Confidence
confidence = 0.75

# Final Output
{
    primary: "Fearful",
    secondary: "Anxious",
    tertiary: "Nervous",
    emotion_valence: 0.30,
    event_valence: 0.35,
    arousal: 0.72,
    domain: "Life",
    control: "Low",
    polarity: "Negative",
    is_emotion_neutral: False,
    is_event_neutral: True,
    confidence: 0.75,
    flags: {...}
}
```

---

### Example 2: "The meeting wasn't bad actually"

```python
# Step 1: Feature Extraction
features = {
    emotion_keywords: [],
    negative_words: ["bad"],
    positive_words: ["actually"],
    intensifiers: [],
    profanity: []
}

# Step 2: Negation Analysis
negation = {
    present: True,
    strength: 0.40,
    is_litotes: True,  # "wasn't bad" → positive
    flip_factor: +0.40
}

# Step 3: Dual Valence
raw_valence = 0.30
# Apply litotes flip
emotion_valence = 0.30 + 0.40 = 0.70  # positive!
event_valence = 0.65

# Step 4: Arousal
arousal = 0.35  # low (calm statement)

# Step 5: Primary Emotion Scoring
# Litotes boosts Happy
scores = {
    Happy: 0.60,     # litotes boost
    Peaceful: 0.45,
    Sad: 0.10,
    ...
}
primary = "Happy"

# Step 6: Secondary
secondary = "Content"

# Step 7: Tertiary
tertiary = "Satisfied"
tertiary_confidence = 0.70

# Step 8: Neutral Detection
is_emotion_neutral = False
is_event_neutral = False  # event mentioned (meeting)

# Step 9: Domain
domain = "Work"  # "meeting" keyword

# Step 10: Control & Polarity
control = "Low"      # passive statement
polarity = "Positive"  # positive valence

# Step 11: Flags
flags = {
    has_negation: True,
    negation_strength: 0.40,
    is_litotes: True,    # KEY!
    has_profanity: False,
    has_sarcasm: False
}

# Step 12: Confidence
confidence = 0.68

# Final Output
{
    primary: "Happy",
    secondary: "Content",
    tertiary: "Satisfied",
    emotion_valence: 0.70,   # flipped by litotes
    event_valence: 0.65,
    arousal: 0.35,
    domain: "Work",
    control: "Low",
    polarity: "Positive",
    is_emotion_neutral: False,
    is_event_neutral: False,
    confidence: 0.68,
    flags: {
        is_litotes: True  # Important flag
    }
}
```

---

### Example 3: "I'm fucking exhausted"

```python
# Step 1: Feature Extraction
features = {
    emotion_keywords: ["exhausted"],
    negative_words: ["exhausted"],
    positive_words: [],
    intensifiers: [],
    profanity: ["fucking"]
}

# Step 2: Negation Analysis
negation = {
    present: False,
    strength: 0.0,
    is_litotes: False
}

# Step 3: Dual Valence
emotion_valence = 0.15  # very negative
event_valence = 0.20

# Step 4: Arousal
arousal = 0.25  # low (exhausted = low energy)
# BUT: profanity increases arousal
arousal = 0.25 + 0.25 = 0.50

# Step 5: Primary Emotion Scoring
# Profanity boosts Angry by +0.30
scores = {
    Sad: 0.50,      # "exhausted"
    Angry: 0.45,    # profanity boost
    Fearful: 0.30,
    ...
}
# Close call! But Sad wins
primary = "Sad"

# Step 6: Secondary
secondary = "Depressed"  # low energy + negative

# Step 7: Tertiary
tertiary = "Exhausted"
tertiary_confidence = 0.90

# Step 8: Neutral Detection
is_emotion_neutral = False
is_event_neutral = True

# Step 9: Domain
domain = "Life"

# Step 10: Control & Polarity
control = "Low"
polarity = "Negative"

# Step 11: Flags
flags = {
    has_negation: False,
    negation_strength: 0.0,
    is_litotes: False,
    has_profanity: True,   # KEY!
    has_sarcasm: False
}

# Step 12: Confidence
confidence = 0.82

# Final Output
{
    primary: "Sad",
    secondary: "Depressed",
    tertiary: "Exhausted",
    emotion_valence: 0.15,
    event_valence: 0.20,
    arousal: 0.50,  # boosted by profanity
    domain: "Life",
    control: "Low",
    polarity: "Negative",
    is_emotion_neutral: False,
    is_event_neutral: True,
    confidence: 0.82,
    flags: {
        has_profanity: True  # Important flag
    }
}
```

---

## Key Design Principles

### 1. Keyword-Driven Approach
- Primary, secondary, and tertiary emotions are primarily detected via **keyword matching**
- Lexicon-based approach (not ML-based) for transparency and control

### 2. Dual Valence System
- **Emotion Valence:** How the person feels
- **Event Valence:** How the event is objectively
- Allows for: "I got promoted (event: positive) but feel anxious (emotion: negative)"

### 3. Hierarchical Emotion Taxonomy
- **6 Primaries** → broad categories
- **36 Secondaries** → mid-level granularity
- **197 Tertiaries** → fine-grain micro-states
- Strict hierarchy: Tertiary must align with Secondary, Secondary must align with Primary

### 4. Linguistic Flags
- **Negation:** Flips valence ("not happy" → negative)
- **Litotes:** Double negative → positive ("not bad" → positive)
- **Profanity:** Boosts Angry emotion + increases arousal
- **Sarcasm:** Affects valence interpretation

### 5. Neutral Detection
- Distinguishes **true neutral** (flat affect) from **Peaceful** (positive, calm)
- Strict criteria: only neutral if NO emotion keywords detected

### 6. Context Inference
- **Domain:** Inferred from keywords (work, relationship, health, etc.)
- **Control:** Inferred from agency markers ("I can" vs "I can't")
- **Polarity:** Derived from valence + emotion + control

---

## Performance Characteristics

### Accuracy (Golden Set - 32 examples)
- **Primary Emotion F1:** 0.439 (target: ≥0.78)
- **Secondary Emotion F1:** 0.439 (target: ≥0.70)
- **Tertiary Emotion F1:** 0.933 ✅
- **Domain Accuracy:** 84.4% ✅

### Latency
- **P50:** ~50ms
- **P95:** ~100ms
- **P99:** ~200ms

### Strengths
- ✅ High tertiary accuracy (0.933)
- ✅ Good domain classification (84%)
- ✅ Transparent, explainable logic
- ✅ Litotes detection working (33% accuracy)
- ✅ Negation detection working (40% accuracy)

### Weaknesses
- ❌ Primary/secondary accuracy below target (~44% vs 78% target)
- ❌ Keyword-driven approach misses nuanced expressions
- ❌ Limited context understanding (no cross-sentence reasoning)

---

## Future Enhancements

### Planned Improvements
1. **Expand Golden Set:** 32 → 200+ examples
2. **Hybrid Scoring:** Combine keyword + ML-based scoring
3. **Context Window:** Consider multiple sentences for context
4. **Confidence Calibration:** Apply temperature scaling (ECE ≤ 0.08)
5. **Secondary Emotion Accuracy:** Improve from 44% → 70%+

### Under Consideration
- Integration with LLM for ambiguous cases
- User feedback loop for personalization
- Multi-language support

---

## References

- **Emotion Taxonomy:** Willcox Feelings Wheel (wheel.txt)
- **Pipeline Code:** `src/enrich/pipeline_v2_2.py`
- **Negation Module:** `src/enrich/negation.py`
- **Neutral Detection:** `src/enrich/neutral_detection.py`
- **Tertiary Extraction:** `src/enrich/tertiary_extraction.py`

---

**Document Version:** 1.0  
**Last Updated:** November 5, 2025  
**Author:** Enrichment Pipeline Team
