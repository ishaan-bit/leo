# Labeling Examples

This directory contains **annotated examples** demonstrating how to apply the labeling guidelines across different reflection types, lengths, and edge cases.

## Purpose

These examples serve as:
1. **Training materials** for human annotators
2. **Quality benchmarks** for annotation review
3. **Test cases** for automated validation scripts
4. **Reference implementations** of the EES-1 taxonomy and safety protocols

## File Structure

Each example is a JSON file with four main sections:

### 1. `_meta`
- `example_id`: Unique identifier (e.g., SHORT_01, MEDIUM_05, LONG_02)
- `length_bucket`: SHORT (2-12 words), MEDIUM (40-120 words), LONG (200-300 words)
- `edge_case_category`: profanity_common, sarcasm_common, high_risk, hinglish_code_mixing
- `risk_level`: NONE, LOW, MEDIUM, HIGH
- `annotation_notes`: Guidance for annotators
- `quality_gates`: Specificity score, mirrored details, banned phrases check
- `escalation`: (HIGH risk only) Dual review details, incident report ID

### 2. `perception`
Complete perception item schema:
- **Text fields**: `raw_text`, `normalized_text`, `lang`, length metrics
- **Context**: time of day, device, previous reflection timing
- **Labels**: 
  - `valence` (0-1): Negative → positive
  - `arousal` (0-1): Calm → activated
  - `invoked`: What's actually felt (core → nuance → micro)
  - `expressed`: What's communicated (may differ from invoked)
  - `willingness` (0-1): How openly expressed
  - `congruence` (0-1): Alignment between invoked/expressed
  - `comparator`: better/same/worse/neutral
- **Temporal**: Previous emotion, deltas, 7-day trend
- **Blend targets**: Numerical targets for ML training
- **Risk flags**: Boolean flags for edge cases

### 3. `sft`
Supervised Fine-Tuning example (input → good output):
- **Input**: Normalized text + emotion labels
- **Good output**:
  - `poems`: 4 empathetic one-liners (≤15 words each)
  - `tips`: 3 concrete, actionable tips (locale-ready)
  - `closing_line`: Final supportive statement
  - `voice_notes`: Annotation guidance

### 4. `dpo`
Direct Preference Optimization example (input → good vs bad):
- **Input**: Same as SFT
- **Good**: Same as SFT good output
- **Bad**: Contrasting example with platitudes, toxic positivity, or banned phrases
- **Notes**: Detailed explanation of why bad is bad

## Examples Inventory

| ID | Length | Category | Risk | Key Features |
|----|--------|----------|------|--------------|
| **SHORT_01** | SHORT | profanity_common | LOW | "Fucked up day." — Brief profanity, Angry/Frustrated/Defeated |
| **SHORT_02** | SHORT | sarcasm_common | LOW | "Best day ever 🙄" — Sarcasm detection, invoked vs expressed |
| **SHORT_03** | SHORT | high_risk | **HIGH** | "Want to end it all." — Suicidal ideation, dual review |
| **MEDIUM_01** | MEDIUM | profanity_common | MEDIUM | Work burnout (82 words) — Boss stress, unrealistic deadlines |
| **MEDIUM_05** | MEDIUM | hinglish_code_mixing | MEDIUM | Shaadi pressure (108 words) — Hinglish profanity, gendered expectations |
| **LONG_02** | LONG | high_risk | **HIGH** | Domestic abuse (247 words) — Financial control, isolation, DV pattern |

## Key Annotation Patterns Demonstrated

### SHORT Reflections (2-12 words)
- **Profanity**: Mirror raw emotion without excessive sanitizing
- **Sarcasm**: Detect from emoji (🙄), hyperbole, context inversion
- **HIGH risk**: Active suicidal ideation — dual review, crisis resources, no platitudes
- **Quality gate**: ≥1 specific detail from input mirrored in good response

### MEDIUM Reflections (40-120 words)
- **Work stress**: Mirror ≥2 specifics (boss behavior, deadlines, burnout signals)
- **Hinglish**: Code-mix naturally, honor cultural context (family hierarchy, gendered duties)
- **Quality gate**: ≥2 specific details, cultural competence for Hinglish

### LONG Reflections (200-300 words)
- **Abuse disclosure**: Mirror ≥3 specifics, trauma-informed empathy
- **Narrative coherence**: Preserve discourse structure (past → present → fear of future)
- **Safety**: NO prescriptive "just leave" advice, micro-steps that account for surveillance
- **Quality gate**: ≥3 specifics, narrative coherence preserved

## Edge Case Patterns

### Sarcasm (SHORT_02)
- **Indicators**: Emoji (🙄, 😒), scare quotes, hyperbole
- **Annotation**: 
  - `invoked`: True emotion (Angry/Frustrated)
  - `expressed`: Literal words (Happy/Excited)
  - `congruence`: LOW (0.15)
  - `sarcasm_detected`: true
- **Good response**: Acknowledges irony ("that eye-roll speaks volumes")
- **Bad response**: Takes literal words at face value ("glad you're having a great day!")

### Profanity (SHORT_01, MEDIUM_01)
- **Hinglish variants**: bakwas, pagal, madarchod, bhenchodchod
- **Annotation**: Keep emotional valence, note `profanity_present: true`
- **Good response**: Mirrors energy without preaching
- **Bad response**: Sanitizes excessively, toxic positivity

### HIGH Risk (SHORT_03, LONG_02)
- **Escalation**: Dual review required, incident report logged
- **Suicidal ideation**: Sad/Depressed/Hopeless, v≈0.05, a≈0.35
- **Domestic abuse**: Fearful/Helpless/Stuck, financial control, isolation patterns
- **Good response**: 
  - Witness pain without fixing
  - Concrete micro-actions (crisis line, change room, hidden cash)
  - NO crisis banner in training data (UI handles)
  - NO prescriptive advice ("just leave", "talk to police")
- **Bad response**: 
  - Platitudes ("everything will be okay")
  - Toxic positivity ("stay strong!")
  - Dangerous advice ("just pack your bags and leave")

### Hinglish (MEDIUM_05)
- **Code-mixing**: Natural blend of EN + HI (yaar, shaadi, bakwas, pagal)
- **Cultural context**: Family hierarchy, gendered expectations ("ladki hoke")
- **Good response**: 
  - Code-mixes to match ("pagal mat hona yaar")
  - Honors family system (micro-actions within hierarchy)
  - Avoids Western individualism ("just set boundaries")
- **Bad response**: 
  - Pure English (cultural disconnect)
  - Prescriptive Western advice ("communicate openly")
  - Romanticizes tradition ("family is a blessing")

## EES-1 Enforcement Examples

### Valid Paths (from examples)
- `Angry/Frustrated/Defeated` (cell_id: 140, tier: A) — Work burnout, rough day
- `Sad/Depressed/Hopeless` (cell_id: 78, tier: A) — Suicidal ideation
- `Fearful/Overwhelmed/Stressed` (cell_id: 176, tier: A) — Wedding pressure
- `Fearful/Helpless/Stuck` (cell_id: 196, tier: C) — Domestic abuse
- `Happy/Excited/Cheerful` (cell_id: 6, tier: C) — Sarcasm expressed emotion

### Invoked vs Expressed Divergence
- **Sarcasm**: Invoked (Angry/Frustrated) ≠ Expressed (Happy/Excited)
- **Inhibition**: Person feels Sad/Depressed but expresses Peaceful/Content (workplace masking)
- **Congruence**: Low (0.15-0.3) when divergence is high

## SFT/DPO Quality Standards

### Banned Phrases (never use in "good")
- "You are valid"
- "You are worthy"
- "Everything happens for a reason"
- "Just breathe"
- "It will be fine"
- "Stay strong"
- "You've got this"

### Good Response Traits
- **Empathetic-stranger voice**: Warm but not invasive
- **Specificity**: Mirror concrete details from input (≥1 SHORT, ≥2 MEDIUM, ≥3 LONG)
- **Poems**: Poetic one-liners that witness emotion (≤4 lines, ≤15 words each)
- **Tips**: Concrete, actionable micro-steps (≤3, locale-ready)
- **Closing line**: Grounding statement, no false promises

### Bad Response Patterns (for DPO)
- **Platitudes**: Generic advice ("this too shall pass")
- **Toxic positivity**: Dismisses pain ("stay positive!")
- **Cheerleader tone**: Patronizing ("chin up!", "you've got this!")
- **Prescriptive**: "Just" statements ("just leave", "just breathe")
- **False promises**: "Everything will be okay"
- **Guilt trips**: "Think about people who care about you"
- **Lack of specificity**: Could apply to anyone

## Safety Protocol Integration

### HIGH Risk Items (SHORT_03, LONG_02)
1. **Flag**: `risk_level: "HIGH"`
2. **Dual review**: Two senior annotators
3. **Incident report**: Log ID in `_meta.escalation`
4. **PII redaction**: [person], [city], [contact]
5. **Crisis resources**: Locale-specific hotlines (UI handles display)
6. **NO crisis banners**: Training data doesn't include UI crisis overlays

### Risk Flag Taxonomy
- `suicidal_ideation`: Active intent, method, timeline
- `self_harm`: Cutting, burning, overdose
- `harm_to_others`: Violence, threats
- `abuse`: Domestic violence, sexual assault, child abuse
- `stalking`: Persistent unwanted contact
- `financial_coercion`: Debt traps, exploitation
- `sociopathic_cues`: Lack of remorse, manipulation
- `profanity_present`: Cuss words (EN/HI/Hinglish)
- `sarcasm_detected`: Tone inversion markers
- `negation_present`: Single, double, contrastive negations

## Usage for Annotators

### When annotating a new reflection:

1. **Determine length bucket**: Count words
   - SHORT: 2-12 words
   - MEDIUM: 40-120 words
   - LONG: 200-300 words

2. **Assess risk level**: Check for crisis signals
   - HIGH: Suicidal ideation, self-harm, abuse, violence
   - MEDIUM: Moderate distress, relationship conflict
   - LOW: Standard emotional content
   - NONE: Neutral or positive

3. **Find similar example**: Match by length + category
   - Profanity → SHORT_01, MEDIUM_01
   - Sarcasm → SHORT_02
   - HIGH risk → SHORT_03, LONG_02
   - Hinglish → MEDIUM_05

4. **Follow example patterns**:
   - Mirror specificity level (≥1, ≥2, ≥3)
   - Match voice (empathetic-stranger, cultural competence)
   - Apply safety protocols (dual review for HIGH)
   - Use EES-1 taxonomy (216 valid states)

5. **Validate against quality gates**:
   - Specificity score ≥0.6 (SHORT), ≥0.7 (MEDIUM), ≥0.8 (LONG)
   - No banned phrases in "good"
   - PII redacted
   - Length-appropriate tips

## Files in This Directory

```
labeling/examples/
├── README.md (this file)
├── SHORT_01_profanity.json
├── SHORT_02_sarcasm.json
├── SHORT_03_suicidal.json (⚠️ HIGH RISK)
├── MEDIUM_01_work_stress.json
├── MEDIUM_05_hinglish.json
└── LONG_02_abuse.json (⚠️ HIGH RISK)
```

## Next Steps

After reviewing these examples, annotators should:
1. Read `labeling/safety_protocol.md` (HIGH risk procedures)
2. Read `labeling/guidelines.md` (complete annotation manual)
3. Review `labeling/schema.md` (field definitions)
4. Practice annotating using these examples as benchmarks
5. Submit first 10 annotations for senior review before full production

## Questions?

- **Safety concerns**: Escalate to safety team immediately
- **Annotation questions**: Consult `guidelines.md` or ask senior annotator
- **Technical issues**: See `schema.md` for field definitions
- **Cultural context**: MEDIUM_05 demonstrates Hinglish cultural competence

---

**Version**: 1.0  
**Last Updated**: 2025-01-20  
**Status**: Ready for annotator training
