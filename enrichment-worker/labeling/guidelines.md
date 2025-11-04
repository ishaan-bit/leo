# Labeling Guidelines v2.0 - Length-Aware + Edge Cases

## Overview
These guidelines cover annotation of **32,400 perception items** + **9,000 SFT** + **7,500 DPO pairs** for Leo's behavioral inference system, with strict attention to **length variability** (SHORT/MEDIUM/LONG), **216-cell emotion taxonomy** (EES-1), and **edge-case coverage** (sarcasm, profanity, high-risk scenarios).

---

## 1. Length Buckets (MANDATORY CLASSIFICATION)

Every reflection MUST be tagged with `length_bucket`:

### SHORT (2-12 words)
- **Definition**: One-liners, terse expressions, often emotionally charged
- **Examples**:
  - "FUcking bugs everywhere." (4 words)
  - "I hate myself today" (4 words)
  - "So tired of this shit job honestly" (7 words)
  - "Aaj bahut sad hu yaar" (5 words, Hinglish)
- **Characteristics**:
  - HIGH arousal common (intensifiers, profanity, ALL CAPS)
  - Less context, harder to disambiguate sarcasm
  - Often mobile-typed, voice-to-text
- **Labeling Tips**:
  - Lexical cues dominate: VADER, punctuation (!!!), profanity
  - Embeddings less stable (not enough context)
  - Transformer CLS token useful
  - **Blend targets**: Boost Lx (+0.10), boost Tr (+0.10), reduce Em (-0.10)

### MEDIUM (40-120 words, ~2-6 sentences)
- **Definition**: Standard narrative with some context
- **Examples**:
  - "Had a fight with my mom today about marriage. She keeps saying I'm getting too old and nobody will want me. It hurts because I know she means well but it makes me feel like I'm not enough. I just want her to understand I'm figuring things out." (54 words)
  - "Office mein new manager bahut strict hai. Har choti cheez pe complain karta hai. Main har din tense rehti hu ki kya galti ho jayegi. Bas Friday ka wait hai ab." (28 words, Hinglish)
- **Characteristics**:
  - Balanced context for all features
  - Multiple emotions may appear (anger → sadness)
  - Discourse markers: "but", "however", "still"
- **Labeling Tips**:
  - Use **final emotional state** (end of text) for invoked/expressed
  - Check congruence between start/end
  - **Blend targets**: Baseline weights (no adjustment)

### LONG (200-300 words, multi-paragraph)
- **Definition**: Extended narrative, often journaling-style
- **Example**:
  - "I've been thinking a lot about my divorce lately. It's been two years but sometimes it feels like yesterday. I remember the day he told me he wanted out - we were sitting in our tiny living room in Bandra and he just said 'I can't do this anymore.' I felt my whole world collapse. The worst part wasn't even the breakup itself, it was explaining to my parents. They blamed me, said I must have done something wrong. My mom stopped talking to me for months.
  
  Now I'm 32 and everyone acts like I'm damaged goods. Every aunty has an opinion. Dating feels impossible because guys either fetishize the 'divorced woman' thing or run away. I've started therapy which helps, but some days I still wake up and feel that same panic - like I'm worthless, like I failed at the one thing I was supposed to do right.
  
  But then I have good days too. Days where I remember I have a career I love, friends who stuck by me, and a life that's actually mine now. I'm learning to be okay with not being okay all the time. It's just hard when society won't let you forget you're 'different' now." (237 words)
- **Characteristics**:
  - Emotional arc: may start negative, end neutral/positive (or vice versa)
  - Multiple themes: divorce, family pressure, societal judgment, hope
  - Rich context for embeddings + temporal + LLM
- **Labeling Tips**:
  - Label **final emotional state** (last paragraph)
  - Note **emotional trajectory** in `labeler_notes`
  - Mark **specific details** user mentions (for SFT mirroring):
    - "divorce 2 years ago", "parents blamed her", "therapy helping", "32 years old"
  - **Blend targets**: Boost Em (+0.10), boost Tm (+0.05), boost LL (+0.10)
  - For transformer: Use **sliding window** (512 tokens, stride 256) + mean-pool logits

---

## 2. EES-1 Emotion Taxonomy (STRICT ENFORCEMENT)

### 6 Cores × 6 Nuances × 6 Micro-Nuances = 216 States

**Hierarchy**:
```
Happy
├── Excited → Energetic, Curious, Stimulated, Playful, Inspired, Cheerful
├── Interested → Engaged, Intrigued, Focused, Attentive, Curious, Involved
├── Energetic → Driven, Lively, Motivated, Active, Vibrant, Charged
├── Playful → Fun, Lighthearted, Amused, Silly, Cheerful, Jovial
├── Creative → Imaginative, Inventive, Expressive, Artistic, Visionary, Experimental
└── Optimistic → Hopeful, Upbeat, Confident, Expectant, Positive, Forward-looking

Strong
├── Confident → Assured, Secure, Capable, Bold, Competent, Self-reliant
├── Proud → Accomplished, Honored, Esteemed, Fulfilled, Worthy, Respected
├── Respected → Valued, Trusted, Admired, Recognized, Honorable, Appreciated
├── Courageous → Brave, Adventurous, Daring, Fearless, Determined, Heroic
├── Hopeful → Inspired, Aspiring, Positive, Expectant, Reassured, Uplifted
└── Resilient → Tough, Steady, Rebounding, Enduring, Adaptable, Persistent

Peaceful
├── Loving → Caring, Compassionate, Affectionate, Warm, Tender, Kind
├── Grateful → Thankful, Appreciative, Blessed, Content, Relieved, Peaceful
├── Thoughtful → Reflective, Considerate, Mindful, Pensive, Contemplative, Understanding
├── Content → Comfortable, Satisfied, Fulfilled, Calm, Settled, At-ease
├── Serene → Tranquil, Still, Quiet, Harmonious, Relaxed, Balanced
└── Thankful → Appreciative, Aware, Satisfied, Gentle, Humble, Calm

Sad
├── Lonely → Abandoned, Isolated, Forsaken, Forgotten, Distant, Alone
├── Vulnerable → Exposed, Fragile, Unsafe, Sensitive, Helpless, Unprotected
├── Hurt → Wounded, Injured, Offended, Pained, Damaged, Aching
├── Depressed → Hopeless, Empty, Low, Exhausted, Melancholic, Despairing
├── Guilty → Ashamed, Regretful, Responsible, Remorseful, Embarrassed, Contrite
└── Grief → Mourning, Bereaved, Sorrowful, Heartbroken, Loss, Weeping

Angry
├── Mad → Furious, Enraged, Outraged, Irritated, Heated, Wild
├── Disappointed → Betrayed, Jealous, Let-down, Resentful, Displeased, Dismayed
├── Humiliated → Ashamed, Inferior, Embarrassed, Belittled, Exposed, Dishonored
├── Aggressive → Provoked, Violent, Hostile, Combative, Threatening, Confrontational
├── Frustrated → Annoyed, Impatient, Restless, Defeated, Irritated, Blocked
└── Critical → Dismissive, Judgmental, Harsh, Skeptical, Sarcastic, Demanding

Fearful
├── Anxious → Nervous, Uneasy, Tense, Worried, Restless, Alarmed
├── Insecure → Uncertain, Self-doubting, Hesitant, Fearful, Guarded, Timid
├── Overwhelmed → Stressed, Exhausted, Flooded, Pressured, Burdened, Distracted
├── Weak → Powerless, Fragile, Small, Dependent, Vulnerable, Ineffective
├── Rejected → Excluded, Disillusioned, Dismissed, Neglected, Abandoned, Ignored
└── Helpless → Worthless, Defeated, Stuck, Lost, Hopeless, Paralyzed
```

**Validation**:
- Secondary MUST be child of Primary
- Tertiary MUST be child of Secondary
- Use `emotion_schema.validate_emotion_state()` - auto-corrects invalid paths

---

## 3. Tier System (A/B/C Priority)

### Tier A (60 cells, 200 each = 12,000 total)
**High-priority combinations** (common in urban India, clinical relevance):
- Sad/Lonely/Abandoned, Sad/Depressed/Hopeless, Sad/Hurt/Wounded
- Anxious/Nervous, Anxious/Overwhelmed/Stressed
- Angry/Frustrated/Annoyed, Angry/Disappointed/Betrayed
- Happy/Optimistic/Hopeful, Peaceful/Grateful/Thankful
- Strong/Resilient/Enduring

**Length mix**: SHORT 30%, MEDIUM 50%, LONG 20%

### Tier B (100 cells, 150 each = 15,000 total)
**Moderate-priority**:
- Less common nuances (e.g., Happy/Creative/Visionary, Sad/Guilty/Contrite)
- Mixed emotions (e.g., Sad/Vulnerable/Exposed + Angry/Humiliated/Ashamed)

**Length mix**: SHORT 30%, MEDIUM 50%, LONG 20%

### Tier C (56 cells, 100 each = 5,600 total)
**Low-priority / rare**:
- Sociopathic cues (Strong/Proud/Esteemed with lack of remorse)
- Extreme states (Angry/Aggressive/Violent, Fearful/Helpless/Paralyzed)
- Positive extremes (Happy/Playful/Silly)

**Length mix**: SHORT 25%, MEDIUM 60%, LONG 15% (less long-form for rare states)

---

## 4. Edge-Case Quotas (MUST MEET)

### 4.1 Sarcasm / Irony (≥1,200 items)
**Markers**:
- Quotes: "I'm 'fine', totally 'fine'"
- ALL CAPS + contradiction: "GREAT, just GREAT"
- Emoji: 🙄, 😒, 😑
- Hyperbole: "Oh sure, best day EVER"

**Labeling**:
- Tag `risk_flags: ["sarcasm"]`
- Label **true emotion** (not surface):
  - "I'm SO happy right now" (sarcastic) → valence=0.2, invoked=Sad/Depressed
  - Congruence = LOW (saying opposite of feeling)

### 4.2 Negation / Double-Negatives (≥1,500 items)
**Examples**:
- "I'm not unhappy" (≈ neutral/slightly positive)
- "I don't not care" (= I do care)
- "Nobody understands me" (negation of positive)
- "Kuch nahi ho raha" (Nothing is happening - Hinglish)

**Labeling**:
- Tag `risk_flags: ["negation_complex"]`
- Resolve to **net sentiment**: "not unhappy" → valence ≈ 0.5-0.6

### 4.3 Profanity (≥1,200 items)
**English**: fucking, shit, hell, damn, asshole, bitch, bastard
**Hindi/Hinglish**: साला (saala), चूतिया (chutiya), बकवास (bakwas), BC, MC

**Labeling**:
- Tag `risk_flags: ["profanity"]` (for filtering, not safety)
- Arousal typically MEDIUM-HIGH (profanity = intensity)
- **Keep profanity in text** (cultural authenticity) but **redact PII**
- SFT output: **No profanity** (clean, professional tone)

### 4.4 Suicidal Ideation / Self-Harm (≥600 items)
**See Safety Protocol Section 2.1**
- Tag `risk_flags: ["suicidal_ideation"]` or `["self_harm"]`
- `risk_level: "high"`
- Dual review required
- Valence very low (0.0-0.15), invoked often Sad/Depressed/Hopeless

### 4.5 Harm to Others (≥400 items)
**See Safety Protocol Section 2.2**
- Tag `risk_flags: ["harm_to_others"]`
- Invoked: Angry/Aggressive or Sad/Hurt
- **Exclude from SFT/DPO training** (perception only)

### 4.6 Abuse / Harassment / Stalking (≥800 items)
**See Safety Protocol Section 2.3**
- Tag `risk_flags: ["abuse", "harassment", "stalking", "financial_coercion"]`
- Congruence often LOW (victims minimize)
- SFT: Validate without prescribing; mirror specifics

### 4.7 Sociopathic / Psychopathic Cues (≥400 items)
**See Safety Protocol Section 2.4**
- Tag `risk_flags: ["sociopathic_cues"]` or `["psychopathic_cues"]`
- Willingness HIGH, congruence HIGH (no filter)
- **Exclude from SFT/DPO** (perception only)

### 4.8 Financial Stress (≥600 items)
- "Can't pay rent this month"
- "In-laws took my salary"
- "Husband controls all the money"
- Tag `risk_flags: ["financial_coercion"]` if coercive; `risk_level: "medium"`

### 4.9 Medical / Legal Anxiety (≥600 items)
- "Waiting for biopsy results"
- "Court date for custody battle"
- Tag `risk_flags: ["medical_crisis"]` or `["legal_crisis"]`
- SFT: **No medical/legal advice** (out of scope)

---

## 5. Labeling Workflow (Step-by-Step)

### Step 1: Read & Classify
- Read `raw_text` and `normalized_text` (PII-scrubbed)
- Assign `length_bucket`: SHORT/MEDIUM/LONG
- Assign `lang`: en/hi/hinglish
- Note `circadian_phase` from timestamp

### Step 2: Perception Labels

#### Continuous Variables
- **Valence** (0-1): Overall positivity/negativity
  - 0.0-0.2: Very negative (hopeless, suicidal)
  - 0.2-0.4: Negative (sad, frustrated)
  - 0.4-0.6: Neutral/mixed
  - 0.6-0.8: Positive (grateful, hopeful)
  - 0.8-1.0: Very positive (joyful, excited)
- **Arousal** (0-1): Activation level
  - 0.0-0.3: Very calm (exhausted, serene)
  - 0.3-0.5: Low-moderate (content, thoughtful)
  - 0.5-0.7: Moderate (anxious, interested)
  - 0.7-0.9: High (angry, excited)
  - 0.9-1.0: Very high (enraged, panicked)

#### Hierarchical Emotions (EES-1)
- **Invoked** (what they felt internally):
  1. Primary: 6 cores
  2. Secondary: 36 nuances (child of primary)
  3. Tertiary: 216 micros (child of secondary)
- **Expressed** (what text shows):
  - May differ from Invoked (social inhibition)
  - "I'm fine" when sad → Invoked: Sad/X/Y, Expressed: Peaceful/Content/Calm

#### Behavioral
- **Willingness to Express** (0-1):
  - Formula: `0.4 + 0.2*first_person - 0.1*hedges - 0.1*strong_negations`
  - Override if formula misses nuance
  - High (0.7+): "I feel abandoned"
  - Low (0.3-): "Everything's fine, I guess"
- **Congruence** (0-1):
  - Alignment between Invoked and Expressed
  - 1.0 = perfect match
  - 0.0 = opposite (saying "I'm happy" when clearly sad)

### Step 3: Risk Assessment
- Assign `risk_flags` (see Section 4)
- Assign `risk_level`: none/low/medium/high
- If HIGH: **Dual review required** (2 senior annotators + clinical advisor)

### Step 4: Blend Targets (Advanced)
- For each variable (valence, arousal, invoked, expressed, willingness, congruence, comparator):
  - Start with base weights from `blend_weights.json`
  - Apply length-aware delta:
    - SHORT: +0.10 Lx, +0.10 Tr, -0.10 Em
    - MEDIUM: baseline
    - LONG: -0.05 Lx, +0.10 Em, +0.05 Tm, +0.10 LL
  - Normalize to sum=1.0
  - Store in `blend_targets` field

### Step 5: Temporal (if user history available)
- Compute EMA (1d/7d) for valence/arousal
- Note `expected` values (baseline from user history)
- Compute `deviation` (current - expected)

### Step 6: Quality Check
- Run `python scripts/qa_dataset.py --validate-item item.json`
- Checks:
  - [ ] EES-1 hierarchy valid
  - [ ] Valence/arousal in [0,1]
  - [ ] Length bucket matches actual word count
  - [ ] PII redacted
  - [ ] Blend targets sum to 1.0 per variable
  - [ ] If risk_level=HIGH, dual_review flag present

---

## 6. SFT Labeling (Empathetic-Stranger Voice)

### 6.1 Input Context
- `rid`, `raw_text`, `lang`, `length_bucket`, invoked/expressed emotions, valence/arousal

### 6.2 Good Output Schema
```json
{
  "poems": ["≤4 lines", "empathetic, specific"],
  "tips": ["≤3, concrete, locale-ready"],
  "closing_line": "≤100 chars, warm, mirrors 1-2 user specifics",
  "style": {
    "voice": "empathetic-stranger",
    "tempo": "slow|mid|fast",
    "code_mix": "en|hi|hinglish"
  }
}
```

### 6.3 Empathetic-Stranger Rules
- **Mirror specifics**: If user says "I had a fight with my mom about marriage", poem should reference "the fight about marriage" or "your mom's words"
- **Avoid platitudes**: No "you are valid", "just breathe", "it gets better"
- **Concrete tips**: Not "practice self-care" but "Take 10 minutes to sit alone before bed tonight"
- **Locale-aware**: Urban India context (temples, markets, societies, traffic, in-laws)
- **No diagnosis**: Never "You sound depressed" or "This is anxiety"
- **No promises**: Never "You will get through this" or "Tomorrow will be better"
- **Warm but professional**: Like a wise friend, not a therapist or family member

### 6.4 Length-Specific SFT
- **SHORT input** (2-12 words):
  - Output also brief: 1-2 line poem, 1 tip, short closing
  - Example input: "Fucking tired"
  - Good output:
    ```json
    {
      "poems": ["The exhaustion you feel is real"],
      "tips": ["Give yourself 5 minutes to just sit, no phone"],
      "closing_line": "It's okay to be this tired."
    }
    ```
- **MEDIUM input** (40-120 words):
  - Standard format: 2-3 poems, 2-3 tips, closing
- **LONG input** (200-300 words):
  - **Still keep output brief** (no length creep)
  - Mirror 1-2 specific details from narrative
  - Example: "You mentioned the fight with your mom about marriage, and how her words made you feel not enough"

### 6.5 Code-Mixing (Hinglish)
- If `lang: "hinglish"`, output should include natural code-mixing
- Example input: "Office mein bahut stress hai yaar, manager is awful"
- Good output:
  ```json
  {
    "poems": [
      "The stress you're carrying from office is heavy",
      "Aur yeh manager situation is making it worse"
    ],
    "tips": [
      "Set one small boundary today - maybe leaving on time ek din",
      "Talk to a colleague you trust about the manager's behavior"
    ],
    "closing_line": "You're doing your best in a tough situation."
  }
  ```

---

## 7. DPO Labeling (Good vs Bad Pairs)

### 7.1 Creating "Bad" Outputs
Start with "good" output, then intentionally degrade:

**Bad Type 1: Platitude**
- Remove specifics → generic
- Add banned phrases
- Example:
  ```json
  {
    "bad": {
      "poems": ["You are valid and worthy", "Just breathe and it will pass"],
      "tips": ["Practice self-care", "Hydrate"],
      "closing_line": "You've got this!",
      "why_bad": "platitude, no mirroring, banned phrases"
    }
  }
  ```

**Bad Type 2: Diagnosis**
- Add diagnostic language
- Example:
  ```json
  {
    "bad": {
      "poems": ["It sounds like you're experiencing depression"],
      "tips": ["You should see a therapist", "This might be clinical anxiety"],
      "closing_line": "You need professional help.",
      "why_bad": "diagnosis, prescriptive, medical advice"
    }
  }
  ```

**Bad Type 3: Outcome Promise**
- Make guarantees
- Example:
  ```json
  {
    "bad": {
      "poems": ["Tomorrow will be better, I promise"],
      "tips": ["Just wait, time heals all wounds"],
      "closing_line": "You will get through this, trust me.",
      "why_bad": "outcome promise, false certainty"
    }
  }
  ```

**Bad Type 4: No Specificity**
- Generic response, could apply to anyone
- Example:
  ```json
  {
    "bad": {
      "poems": ["Life has ups and downs", "We all face challenges"],
      "tips": ["Stay positive", "Think happy thoughts"],
      "closing_line": "Hang in there!",
      "why_bad": "no mirroring, generic, unhelpful"
    }
  }
  ```

### 7.2 Preference Strength
- **Strong**: Obvious difference (diagnosis vs safe, platitude vs specific)
- **Weak**: Subtle (slightly generic vs very specific, tone mismatch)

---

## 8. Inter-Annotator Agreement Targets

### Perception
- **Valence/Arousal**: ±0.15 tolerance (2 annotators)
- **Primary emotion**: 100% match (2 annotators)
- **Secondary/Tertiary**: ≥80% agreement (4 annotators)
- **Willingness/Congruence**: ±0.20 tolerance

### Generation (DPO)
- **Preference**: ≥70% agreement (7 annotators prefer same "good")
- **Banned phrase detection**: 100% agreement

### Adjudication
- Disagreement > threshold → escalate to senior
- HIGH-risk items → clinical advisor

---

## 9. Language-Specific Guidelines

### English
- Standard spelling, grammar
- Watch for sarcasm: quotes, emoji, ALL CAPS
- Profanity: fucking, shit, etc. (keep for authenticity)

### Hindi
- Devanagari script preferred
- Romanized Hindi acceptable if user-generated
- Profanity: साला, चूतिया, etc.
- Negation: नहीं, मत, न

### Hinglish (Code-Mixed)
- Most culturally rich, hardest to parse
- Mix of English + Hindi words/grammar
- Examples:
  - "Mujhe lagta hai ki I'm not good enough"
  - "Office politics bahut zyada ho gayi hai yaar"
- SFT output: Mirror code-mixing level (don't over-correct)

---

## 10. Tools & Validation

### Annotation Tool
- Custom UI with:
  - EES-1 dropdown (validated hierarchy)
  - Valence/arousal sliders
  - Risk flag checkboxes
  - Length bucket auto-detected (word count)
  - Banned phrase highlighter

### QA Scripts
```bash
# Validate single item
python scripts/qa_dataset.py --validate-item examples/example_001.json

# Validate full dataset
python scripts/qa_dataset.py --input data/curated/perception_train.jsonl --check-all

# Check quotas
python scripts/qa_dataset.py --report coverage --by cell,length,lang,tier

# Banned phrase audit
python scripts/qa_dataset.py --check-banned --input data/sft/train.jsonl
```

---

## 11. Examples

### Example 1: SHORT, Sarcasm, Profanity
```json
{
  "raw_text": "FUcking bugs everywhere.",
  "normalized_text": "FUcking bugs everywhere.",
  "length_bucket": "SHORT",
  "lang": "en",
  "labels": {
    "valence": 0.15,
    "arousal": 0.75,
    "invoked": {"primary": "Angry", "secondary": "Frustrated", "tertiary": "Irritated"},
    "expressed": {"primary": "Angry", "secondary": "Frustrated", "tertiary": "Irritated"},
    "willingness_to_express": 0.9,
    "congruence": 1.0
  },
  "risk_flags": ["profanity"],
  "risk_level": "none"
}
```

### Example 2: MEDIUM, Abuse, HIGH-risk
```json
{
  "raw_text": "My husband checked my phone again today and got angry when he saw a text from a male colleague. He yelled at me for an hour and threw my phone on the floor. I'm scared to go home tonight.",
  "normalized_text": "My husband checked my phone again today and got angry when he saw a text from a male colleague. He yelled at me for an hour and threw my phone on the floor. I'm scared to go home tonight.",
  "length_bucket": "MEDIUM",
  "lang": "en",
  "labels": {
    "valence": 0.1,
    "arousal": 0.7,
    "invoked": {"primary": "Fearful", "secondary": "Anxious", "tertiary": "Alarmed"},
    "expressed": {"primary": "Fearful", "secondary": "Anxious", "tertiary": "Worried"},
    "willingness_to_express": 0.7,
    "congruence": 0.9
  },
  "risk_flags": ["abuse"],
  "risk_level": "high",
  "dual_review": true
}
```

**SFT Good Response**:
```json
{
  "poems": [
    "Your safety matters, even when fear makes you doubt it",
    "The anger and control you're describing is serious"
  ],
  "tips": [
    "Document this incident (date, time, what happened) in a private note",
    "NCW Helpline (7827-170-170) is available if you need support"
  ],
  "closing_line": "What you're experiencing is not okay. Resources exist when you're ready."
}
```

### Example 3: LONG, Mixed Emotions, Hinglish
```json
{
  "raw_text": "Aaj office mein presentation tha aur maine bahut mehnat ki thi. But when I presented, my manager barely looked up from his laptop. Uske baad usne bola ki 'theek hai' and moved on to the next person. I felt so small yaar. Maine itna time diya tha, weekends pe bhi kaam kiya, aur ye response mila. \n\nGhar aake main ro di. But then I realized, why am I letting his opinion define my worth? I know I did a good job. My teammates even messaged me saying it was great. Maybe I need to stop seeking validation from him and just do my work for myself. \n\nStill hurts though. Recognition matters, you know? Especially when you put in so much effort. But I'm trying to focus on the fact that I'm proud of myself, chahe koi aur ho ya na ho." (167 words)
  "length_bucket": "LONG",
  "lang": "hinglish",
  "labels": {
    "valence": 0.45,  // Mixed: started sad, ended neutral-positive
    "arousal": 0.5,
    "invoked": {"primary": "Sad", "secondary": "Hurt", "tertiary": "Wounded"},
    "expressed": {"primary": "Strong", "secondary": "Resilient", "tertiary": "Enduring"},  // Shifted by end
    "willingness_to_express": 0.8,
    "congruence": 0.6  // Some mismatch (felt hurt, expressing resilience)
  },
  "risk_flags": [],
  "risk_level": "none"
}
```

**SFT Good Response**:
```json
{
  "poems": [
    "You put so much into that presentation",
    "Aur jab validation nahi mila, it hurt",
    "But you're learning to find worth within yourself",
    "That's a quiet kind of strength"
  ],
  "tips": [
    "Keep a 'wins folder' - save those teammate messages for days like this",
    "Recognition matters, but so does your own sense of accomplishment",
    "Maybe find one peer ally at work who gets your effort"
  ],
  "closing_line": "The pride you feel in your work? That's real, chahe manager notice kare ya na kare.",
  "style": {"code_mix": "hinglish"}
}
```

---

**Version**: 2.0 (Length-Aware + Edge Cases)  
**Last Updated**: Nov 2, 2025  
**Related Docs**: `schema.md`, `safety_protocol.md`
