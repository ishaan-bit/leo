# Safety Protocol for Labeling & Training Data

## 🚨 CRITICAL: High-Risk Content Handling

This protocol covers annotation, review, and training procedures for **edge-case scenarios** including suicidal ideation, self-harm, harm to others, abuse, harassment, stalking, financial coercion, and sociopathic/psychopathic behavioral cues.

---

## 1. Risk Classification System

### Risk Levels
- **NONE**: Standard emotional content (sad, anxious, frustrated, joyful)
- **LOW**: Mild distress, stress, relationship conflicts (no immediate danger)
- **MEDIUM**: Significant distress, mentions of past harm, financial stress, harassment
- **HIGH**: Active suicidal ideation, self-harm intent, harm to others, ongoing abuse, stalking

### Risk Flags (MUST TAG)
```python
risk_flags = [
    "suicidal_ideation",      # "I want to die", "thinking about ending it"
    "self_harm",              # "I cut myself", "hurting myself helps"
    "harm_to_others",         # "I want to hurt him", violent ideation
    "abuse",                  # Ongoing physical/emotional abuse
    "harassment",             # Workplace/online harassment
    "stalking",               # Being followed, tracked, monitored
    "financial_coercion",     # Partner controlling money, debt threats
    "medical_crisis",         # Untreated serious illness, medication access
    "legal_crisis",           # Criminal charges, custody battles
    "sociopathic_cues",       # Lack of remorse, manipulation, grandiosity
    "psychopathic_cues",      # Callousness, impulsivity, irresponsibility
    "sarcasm",                # For model training (not safety)
    "profanity",              # For cultural context (not safety)
    "negation_complex"        # Double negatives, rhetorical questions
]
```

---

## 2. Annotation Guidelines for High-Risk Content

### 2.1 Suicidal Ideation / Self-Harm

**Examples** (English):
- "I don't want to be here anymore"
- "Everyone would be better off without me"
- "I have a plan and I'm ready"
- "Cutting is the only thing that makes me feel"

**Examples** (Hinglish):
- "Mujhe jeena nahi hai ab" (I don't want to live anymore)
- "Sab khatam kar dena chahti hu" (I want to end everything)
- "Nobody cares, toh kya farak padega?" (Nobody cares, so what difference will it make?)

**Annotation Requirements**:
- ✅ **DO**: Label valence (very low, 0.0-0.15), arousal (varies), invoked/expressed (Sad/Depressed/Hopeless)
- ✅ **DO**: Tag `risk_flags: ["suicidal_ideation"]`, `risk_level: "high"`
- ✅ **DO**: Add `crisis_context: true` for UI escalation metadata
- ❌ **DON'T**: Create SFT/DPO outputs with crisis banners (UI responsibility)
- ❌ **DON'T**: Use platitudes like "it gets better" or "you matter"

**SFT "Good" Response** (if included in training):
```json
{
  "poems": [
    "The weight you're carrying is heavy",
    "And it's okay to feel this tired",
    "You don't have to carry it alone right now"
  ],
  "tips": [
    "Reach out to someone you trust, even if it's just one text",
    "The crisis helpline (AASRA: 9820466726) is available 24/7"
  ],
  "closing_line": "I'm hearing how exhausted you feel. Please connect with support.",
  "crisis_resources": true  // UI will inject actual banner
}
```

**Dual Review Required**: Two senior annotators must agree on risk_level=high items.

---

### 2.2 Harm to Others / Violent Ideation

**Examples**:
- "I want to hurt him for what he did to me"
- "If I see her with someone else, I don't know what I'll do"
- "They deserve to suffer like I suffered"

**Examples** (Hinglish):
- "Usko marna chahti hu" (I want to kill him/her)
- "Revenge lena hai, whatever it takes"
- "Dekh lunga usko" (I'll deal with him)

**Annotation Requirements**:
- ✅ Tag `risk_flags: ["harm_to_others"]`, `risk_level: "high"`
- ✅ Label invoked (Angry/Aggressive or Sad/Hurt), expressed (may be suppressed)
- ✅ Note in `labeler_notes`: "Threat assessment needed; do not train empathetic response"
- ❌ **EXCLUDE from SFT/DPO training entirely** - too risky for generative model
- ✅ Include in **perception** training (for detection) but flag for UI escalation only

---

### 2.3 Abuse / Harassment / Stalking

**Examples**:
- "He checks my phone every day and gets violent if I don't answer"
- "My manager makes sexual comments and threatens my job"
- "He follows me to work and waits outside my building"
- "My in-laws took my salary and won't let me leave the house"

**Examples** (Hinglish):
- "Saas nahin jaane deti ghar se bahar, paise bhi le leti hai" (MIL doesn't let me leave, takes my money)
- "Office mein boss touch karta hai, complain karun toh job jayegi" (Boss touches me, if I complain I'll lose my job)
- "Husband ne mara aur phone tod diya" (Husband hit me and broke my phone)

**Annotation Requirements**:
- ✅ Tag `risk_flags: ["abuse", "harassment", "stalking", "financial_coercion"]` as applicable
- ✅ `risk_level: "medium"` (ongoing abuse) or `"high"` (imminent danger)
- ✅ Label congruence (often LOW - victims may minimize/rationalize)
- ✅ For SFT, **validate empathetic response**:
  - Mirror specific details ("You mentioned he checks your phone daily")
  - No victim-blaming ("You should have left")
  - No prescriptive advice ("File a police report" - too legal)
  - Safety-focused validation ("What you're experiencing is serious and not okay")

**SFT "Good" Example**:
```json
{
  "poems": [
    "Your safety matters, even when others make you doubt it",
    "The fear you feel is real and valid"
  ],
  "tips": [
    "Document incidents privately (photos, notes with dates)",
    "Reach out to NCW Helpline (7827-170-170) or trusted friend",
    "Keep important documents and some cash in a safe place"
  ],
  "closing_line": "You deserve to feel safe. Resources exist when you're ready."
}
```

---

### 2.4 Sociopathic / Psychopathic Cues

**Behavioral Markers**:
- Lack of remorse: "I don't care that I hurt her, she deserved it"
- Manipulation: "I told him I loved him to get what I wanted"
- Grandiosity: "I'm smarter than everyone, rules don't apply to me"
- Impulsivity: "I quit my job on a whim and left the country"
- Callousness: "Her dog died and I felt nothing, just annoyed she was crying"

**Examples** (Hinglish):
- "Maine usko cheat kiya but I don't feel bad, it was fun" (I cheated but no regret)
- "Rules mere liye nahi hai, I always find a way around" (Rules don't apply to me)

**Annotation Requirements**:
- ✅ Tag `risk_flags: ["sociopathic_cues"]` or `["psychopathic_cues"]`
- ✅ `risk_level: "low"` (personality traits) unless combined with harm intent (`"high"`)
- ✅ Label willingness (often HIGH - no social inhibition), congruence (HIGH - expresses freely)
- ✅ For SFT: **DO NOT generate empathetic response** - exclude from training or use neutral tone
- ❌ Avoid validation ("Your feelings are valid") - inappropriate for manipulative/harmful behavior

**Decision**: Include in **perception** training (for detection) but **exclude from SFT/DPO** to avoid training model to empathize with harmful patterns.

---

### 2.5 Profanity / Cuss Words (Cultural Context)

**Purpose**: Model urban India speech patterns (women 25-35); profanity signals arousal/intensity.

**Indian English / Hinglish Examples**:
- "Fucking bugs everywhere in my room"
- "Meri zindagi toh bekar hai yaar" (My life is shit)
- "Chutiya boss keeps piling work on me"
- "Sala koi nahi samajhta" (Nobody fucking understands)
- "BC yeh kya ho raha hai" (WTF is happening)

**Annotation Requirements**:
- ✅ Tag `risk_flags: ["profanity"]` (for filtering, not safety)
- ✅ Label arousal (MODERATE to HIGH - profanity indicates activation)
- ✅ Redact **PII** but keep profanity if culturally authentic
- ✅ For SFT: **Mirror tone but clean up output**
  - Input: "Fucking tired of this shit job"
  - Good poems: "The exhaustion you're feeling is real and heavy" (NO profanity in output)
  - Bad poems: "Your fucking job sucks" (too informal, mirrors toxicity)

---

### 2.6 Sarcasm / Negation / Complex Irony

**Examples**:
- "Oh great, another wonderful day of feeling like garbage" (sarcastic)
- "I'm 'fine', just absolutely fantastic" (quotes = sarcasm cue)
- "I'm not not happy" (double negative = actually happy? or confused?)
- "Sure, I'm totally in love with my life right now 🙄" (emoji + sarcasm)

**Hinglish**:
- "Haan, bahut khush hu main" with context suggesting opposite (Yeah, I'm SO happy - NOT)
- "Mast zindagi hai yaar" (Great life, dude) - tone matters

**Annotation Requirements**:
- ✅ Tag `risk_flags: ["sarcasm"]` or `["negation_complex"]`
- ✅ Label **true underlying emotion** (not surface):
  - "I'm fine" (sarcastic) → valence=0.2, invoked=Sad/Depressed, expressed=Peaceful/Content
  - Congruence = LOW
- ✅ For SFT: **Acknowledge subtext without calling out sarcasm directly**
  - Good: "Even when you say you're fine, it sounds like things feel heavy"
  - Bad: "You're being sarcastic, so you're actually sad" (too direct)

---

## 3. PII Redaction (MANDATORY)

### What to Redact
- **Names**: "Priya told me..." → "[NAME] told me..."
- **Phone numbers**: "Call me at 98204-XXXXX" → "Call me at [PHONE]"
- **Emails**: "Write to me@domain.com" → "Write to [EMAIL]"
- **Specific locations**: "I live in Bandra West" → "I live in [AREA] Mumbai"
- **Workplace identifiers**: "I work at Infosys Pune" → "I work at [COMPANY] Pune"
- **Financial details**: "I owe 50,000 rupees" → "I owe [AMOUNT] rupees"

### What to KEEP
- **City-level**: "Mumbai", "Delhi", "Bangalore" (for locale features)
- **Cultural texture**: "saas" (MIL), "bua" (aunt), "colony", "society" (Indian apartment complex)
- **Profanity**: (if authentic to expression)
- **General places**: "office", "home", "gym", "temple", "market"

### Redaction Script
```python
# In scripts/anonymize.py
import re

patterns = {
    "phone": r"\b\d{5}[-\s]?\d{5}\b|\+91[-\s]?\d{10}\b",
    "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "name": load_indian_name_list(),  # NER model + Indian name corpus
    "money": r"\b\d{1,2}[,\d]*\s?(?:rupees?|rs\.?|₹|lakhs?|crores?)\b"
}
```

---

## 4. Escalation & Review Process

### Tier 1: Standard Annotation
- Trained labelers handle NONE/LOW/MEDIUM risk items
- Quality checks: inter-annotator agreement ≥80% on valence/arousal, ≥70% on primary emotion

### Tier 2: Senior Review (HIGH RISK)
- **Trigger**: `risk_level: "high"` or flags: suicidal_ideation, harm_to_others, active abuse
- **Process**: Dual review by 2 senior annotators + 1 clinical advisor (psychologist consultant)
- **Decision**: Include in perception training? Include in SFT/DPO? Exclude entirely?
- **Safety gate**: If disagreement on risk_level, escalate to clinical advisor

### Tier 3: Clinical Advisory Board
- Quarterly review of HIGH-risk dataset samples
- Audit SFT/DPO outputs for harmful patterns (e.g., minimizing abuse, blaming victim)
- Update banned phrases list based on emergent bad patterns

---

## 5. Banned Phrases (Empathetic Output)

### NEVER Use in SFT/DPO "Good" Outputs
```
- "You are valid"
- "Just breathe"
- "It will all be fine"
- "Tomorrow is a new day"
- "You are stronger than you think"
- "Everything happens for a reason"
- "Time heals all wounds"
- "Sit with your feelings"
- "Honor your emotions"
- "You deserve better" (unless abuse context, then OK)
- "You should talk to someone" (prescriptive)
- "You need to..." (any prescriptive)
- "Hydrate / Take a walk / Self-care" (generic)
- "This too shall pass"
- "You've got this"
- "Sending you love and light"
```

**Banned Phrases File**: `data/meta/banned_phrases.txt` (400+ entries, updatable)

---

## 6. Length-Specific Safety Considerations

### SHORT (2-12 words)
- Often emotionally charged one-liners: "FUcking bugs everywhere", "I hate myself"
- HIGH arousal, profanity common
- SFT response: **Keep it equally brief** (1-2 line poem, 1 tip max, short closing)

### MEDIUM (40-120 words)
- Narrative with context; easier to assess risk
- May contain mixed emotions (anger + sadness)
- SFT response: Standard format (2-3 poems, 2-3 tips, closing)

### LONG (200-300 words)
- Multi-paragraph; may escalate or de-escalate within text
- Look for **turning points**: "At first I was angry, but then I realized..."
- Label **final emotional state** (end of text) for invoked/expressed
- SFT response: **Still keep brief** (no length creep in outputs)

---

## 7. Language-Specific Notes

### English
- Watch for sarcasm cues: quotes, italics, emoji (🙄, 😒)
- Profanity: fucking, shit, hell, damn, asshole, bitch

### Hindi
- Profanity: बकवास (bakwas), बेकार (bekaar), साला (saala), चूतिया (chutiya)
- Negation: नहीं (nahi), मत (mat), न (na)
- Sarcasm: context-dependent; check for contradictory words

### Hinglish (Code-Mixed)
- Most culturally rich; hardest to parse
- Mix of English profanity + Hindi sentiment: "Yeh life toh fucked hai yaar"
- Watch for false friends: "timepass" (casual, not serious), "tension mat le" (don't stress)

---

## 8. QA Checklist (Per Item)

Before accepting a labeled item:
- [ ] PII redacted (names, phones, emails, specific addresses)
- [ ] Risk flags assigned if applicable
- [ ] Risk level = HIGH → dual review completed?
- [ ] Emotion hierarchy valid (EES-1 schema: primary → secondary → tertiary)
- [ ] Valence/arousal in [0,1], willingness in [0,1], congruence in [0,1]
- [ ] Length bucket assigned correctly (SHORT ≤12 words, LONG ≥200 words)
- [ ] If SFT "good": no banned phrases present
- [ ] If DPO "bad": documented why it's bad (diagnosis/promise/platitude/generic)
- [ ] Blend targets included (per-variable α vectors)

---

## 9. Crisis Resource List (For UI, NOT Model Outputs)

### India-Specific
- **AASRA**: 91-22-2754-6669 (24/7 suicide prevention)
- **Vandrevala Foundation**: 1860-2662-345 (mental health)
- **NCW Helpline**: 7827-170-170 (women's issues, harassment)
- **Childline**: 1098 (abuse, minors)
- **POCSO e-Box**: https://ncpcr.gov.in/index1.php?lang=1&level=1&sublinkid=149&lid=1513 (child sexual abuse)

### When to Trigger (UI Decision)
- `risk_level: "high"` + flags: suicidal_ideation, self_harm → Banner with AASRA
- Abuse/stalking → NCW Helpline
- Model does NOT generate crisis banners - UI layer responsibility

---

## 10. Ethical Commitments

1. **Consent**: Only use data where user consented to research; exclude if `consent.research == false`
2. **Anonymity**: PII-scrubbed, no re-identification possible
3. **Benefit**: Training improves empathetic response quality for underserved populations (urban India women)
4. **Non-maleficence**: No prescriptive/diagnostic outputs; no harm amplification
5. **Cultural Sensitivity**: Hinglish/Hindi treated as first-class; avoid Western therapy-speak
6. **Transparency**: Labelers informed of use case; clinical board reviews outputs quarterly

---

## 11. Annotator Mental Health

### Exposure Limits
- Max 50 HIGH-risk items per annotator per week
- Mandatory 15-minute break after every 10 HIGH-risk items
- Debrief sessions biweekly with team lead

### Red Flags (Annotator Burnout)
- Desensitization: "It's just another suicide note"
- Vicarious trauma: Annotator experiencing nightmares, anxiety
- **Action**: Rotate to LOW-risk items for 2 weeks; offer counseling support

---

## 12. Acceptance Criteria (Safety Audit)

Before dataset release:
- [ ] Zero PII leaks detected (run `scripts/audit_pii.py`)
- [ ] All HIGH-risk items dual-reviewed (100% coverage)
- [ ] Banned phrases: 0% in SFT/DPO "good" outputs (run `scripts/qa_dataset.py --check-banned`)
- [ ] Clinical advisory board sign-off on HIGH-risk sample (n=100 random)
- [ ] Annotator well-being check: no burnout cases requiring intervention
- [ ] Escalation log reviewed: all HIGH-risk items accounted for

---

**Version**: 1.0  
**Last Updated**: Nov 2, 2025  
**Review Frequency**: Quarterly (clinical board) + Ad-hoc (if new edge case discovered)  
**Contact**: [Safety Lead Email] / [Clinical Advisor]
