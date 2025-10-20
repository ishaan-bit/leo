# 🚨 Risk Detection System

**Status**: ✅ Active  
**Last Updated**: October 20, 2025

---

## Overview

Leo's enrichment pipeline includes **comprehensive risk detection** for mental health crises and physical health emergencies. The system operates at three severity levels:

### 🔴 CRITICAL (Immediate Intervention Required)

These signals indicate **immediate risk** requiring urgent professional help:

| Signal | Triggers | Action Required |
|--------|----------|----------------|
| `CRITICAL_SUICIDE_RISK` | Keywords: "suicide", "kill myself", "end it all", "want to die", "no reason to live", "better off dead", etc. | **IMMEDIATE**: Display crisis helpline, emergency contact |
| `CRITICAL_SELF_HARM_RISK` | Keywords: "self harm", "cut myself", "hurt myself", "burning myself", etc. | **IMMEDIATE**: Display mental health resources |
| `CRITICAL_HEALTH_EMERGENCY` | Keywords: "chest pain", "can't breathe", "severe pain", "collapsed", "overdose", "poisoning", etc. | **IMMEDIATE**: Suggest calling emergency services (911/108) |

### 🟠 ELEVATED (Warning Signs)

These signals indicate **concerning patterns** that need monitoring:

| Signal | Triggers | Action Required |
|--------|----------|----------------|
| `ELEVATED_HOPELESSNESS` | 2+ hopelessness keywords: "hopeless", "pointless", "worthless", "no future", "give up", "no way out", "trapped" | Display supportive resources, suggest professional help |
| `ELEVATED_ISOLATION` | 2+ isolation keywords: "nobody cares", "alone", "no one understands", "abandoned", "burden to everyone" | Encourage social connection, community resources |
| `ELEVATED_PROLONGED_LOW_MOOD` | Valence < 0.3 for 5+ consecutive days | Suggest speaking with mental health professional |

### 🟡 TREND-BASED (Patterns Over Time)

These signals track behavioral patterns that may indicate developing issues:

| Signal | Detection Logic | Meaning |
|--------|-----------------|---------|
| `anergy_trend` | 3+ days of "fatigue" OR "low_progress" events in 5-day window | Loss of energy/motivation - possible depression |
| `persistent_irritation` | 3+ days of "irritation" events in 5-day window | Sustained anger/frustration - burnout risk |
| `declining_valence_trend` | Valence decreasing for 3+ consecutive days | Worsening mood trajectory |
| `emotional_volatility` | Valence std deviation > 0.3 in last 3 reflections | Mood instability - possible bipolar/anxiety |

---

## Technical Implementation

### Detection Flow

```
User writes reflection
    ↓
Frontend normalizes text → Sends to worker queue
    ↓
Worker calls Ollama → Extracts emotions, events
    ↓
RiskSignalDetector.detect(history, events, normalized_text)
    ↓
Checks normalized_text for critical keywords
    ↓
Analyzes event patterns over last 5 days
    ↓
Returns list of risk signals
    ↓
Enriched output includes: "risk_signals_weak": [...]
    ↓
Frontend reads risk_signals → Displays appropriate UI
```

### Code Location

- **Detector Class**: `enrichment-worker/src/modules/analytics.py` → `RiskSignalDetector`
- **Integration**: `enrichment-worker/worker.py` → Line ~245 (`risk_detector.detect()`)
- **Output Field**: Enriched reflection → `risk_signals_weak: []`

### Keyword Lists

**Suicide Keywords** (11 phrases):
- suicide, suicidal, kill myself, end it all, no reason to live, better off dead, want to die, ending my life, not worth living, no point in living, don't want to be here

**Self-Harm Keywords** (7 phrases):
- self harm, self-harm, cut myself, hurt myself, harm myself, cutting, burning myself

**Health Crisis Keywords** (20 phrases):
- chest pain, can't breathe, difficulty breathing, severe pain, extreme pain, unbearable pain, heart racing, dizzy, faint, fainting, collapsed, emergency, urgent care, hospital, ambulance, overdose, poisoning

**Hopelessness Keywords** (15 phrases):
- hopeless, no hope, pointless, meaningless, worthless, no future, nothing matters, give up, giving up, can't go on, no way out, trapped, stuck forever

**Isolation Keywords** (10 phrases):
- nobody cares, alone, lonely, isolated, no one understands, all alone, abandoned, nobody would notice, burden to everyone, better without me

---

## Frontend Integration (TODO)

### Recommended UI Responses

#### For CRITICAL Signals

```typescript
if (enriched.risk_signals_weak.includes('CRITICAL_SUICIDE_RISK')) {
  // Display prominent crisis intervention banner
  showCrisisModal({
    title: "We're Concerned About You",
    message: "If you're having thoughts of suicide, please reach out for help immediately.",
    resources: [
      { name: "National Suicide Prevention Lifeline (US)", phone: "988" },
      { name: "AASRA (India)", phone: "91-22-27546669" },
      { name: "Crisis Text Line", sms: "Text HOME to 741741" }
    ],
    emergency: "If this is an emergency, call 911 (US) or 112 (India)"
  });
}

if (enriched.risk_signals_weak.includes('CRITICAL_HEALTH_EMERGENCY')) {
  showEmergencyBanner({
    title: "Possible Health Emergency",
    message: "Your reflection mentions symptoms that may require immediate medical attention.",
    action: "Call emergency services (911/108) if you're experiencing a medical emergency."
  });
}
```

#### For ELEVATED Signals

```typescript
if (enriched.risk_signals_weak.includes('ELEVATED_HOPELESSNESS')) {
  showSupportiveBanner({
    title: "Feeling Hopeless?",
    message: "It sounds like you're going through a difficult time. You don't have to face this alone.",
    suggestions: [
      "Talk to a mental health professional",
      "Reach out to a trusted friend or family member",
      "Explore therapy options (BetterHelp, Talkspace, local counselors)"
    ]
  });
}

if (enriched.risk_signals_weak.includes('ELEVATED_PROLONGED_LOW_MOOD')) {
  showTrendAlert({
    title: "We've Noticed a Pattern",
    message: "Your mood has been consistently low for several days. Consider speaking with a professional.",
    cta: "Find a therapist near you"
  });
}
```

#### For TREND Signals

```typescript
if (enriched.risk_signals_weak.includes('anergy_trend')) {
  showInsightCard({
    emoji: "😴",
    title: "Energy Pattern Detected",
    message: "You've mentioned fatigue multiple times recently. Self-care might help.",
    tips: [
      "Prioritize sleep (7-9 hours)",
      "Take short walks",
      "Consider a mental health check-in"
    ]
  });
}
```

---

## Privacy & Ethics

### Data Handling

- ✅ **No data leaves your system** (local Ollama, local worker)
- ✅ **No third-party AI services** see user reflections
- ✅ **Risk signals stored only in Upstash** (encrypted at rest)
- ✅ **No automatic reporting** to authorities (user maintains full control)

### Ethical Guidelines

1. **Non-Diagnostic**: Risk signals are **informational only**, not clinical diagnoses
2. **User Autonomy**: User decides whether to seek help
3. **Transparent**: User should know detection is happening (show in UI)
4. **Culturally Sensitive**: Keywords tuned for English (India/US context)
5. **Professional Backup**: System should suggest licensed professionals, not replace them

### Limitations

- ⚠️ **Keyword-based detection** can have false positives/negatives
- ⚠️ **English-only** (multilingual support needed for production)
- ⚠️ **No context awareness** (e.g., "I feel like I could die of embarrassment" vs actual crisis)
- ⚠️ **Pattern lag**: Trend signals need 3-5 days of data

---

## Testing Risk Detection

### Test Cases

Create reflections with these texts to verify detection:

#### Critical Suicide Risk
```
"I can't do this anymore. I just want to end it all. Nobody would even notice if I was gone."
```
Expected: `CRITICAL_SUICIDE_RISK`, `ELEVATED_HOPELESSNESS`, `ELEVATED_ISOLATION`

#### Critical Health Emergency
```
"Having severe chest pain and difficulty breathing. Feel like I'm going to collapse."
```
Expected: `CRITICAL_HEALTH_EMERGENCY`

#### Elevated Hopelessness
```
"Everything feels pointless and meaningless. There's no future for me, might as well give up."
```
Expected: `ELEVATED_HOPELESSNESS`

#### Anergy Trend (requires 3+ days of fatigue)
Day 1: "Feeling tired and unproductive today."  
Day 2: "Still exhausted, didn't get much done."  
Day 3: "Another day of fatigue and low progress."  
Day 4: "Can't shake this exhaustion."  

Expected on Day 4: `anergy_trend`

---

## Production Checklist

Before deploying risk detection to production:

- [ ] **Legal Review**: Consult lawyer about liability for crisis detection
- [ ] **Clinical Review**: Have mental health professional review keyword lists
- [ ] **UI Design**: Create non-alarming but clear crisis intervention modals
- [ ] **Resource Database**: Compile region-specific crisis hotlines
- [ ] **False Positive Handling**: Add user feedback ("Not in crisis" option)
- [ ] **Localization**: Translate keywords for target languages (Hindi, etc.)
- [ ] **Testing**: Verify all risk levels trigger appropriate UI
- [ ] **Documentation**: Add privacy policy section on mental health monitoring
- [ ] **Opt-Out**: Consider allowing users to disable risk detection

---

## Crisis Resources (India)

| Organization | Contact | Hours |
|--------------|---------|-------|
| **AASRA** | 91-22-27546669 | 24/7 |
| **Vandrevala Foundation** | 1860-2662-345 | 24/7 |
| **iCall** | 91-22-25521111 | Mon-Sat 8am-10pm |
| **Sneha India** | 91-44-24640050 | 24/7 |
| **Jeevan Aastha** | 1800-233-3330 | 24/7 |

## Crisis Resources (US)

| Organization | Contact | Hours |
|--------------|---------|-------|
| **988 Suicide & Crisis Lifeline** | 988 (call/text) | 24/7 |
| **Crisis Text Line** | Text HOME to 741741 | 24/7 |
| **SAMHSA National Helpline** | 1-800-662-4357 | 24/7 |
| **Trevor Project** (LGBTQ+) | 1-866-488-7386 | 24/7 |

---

**Remember**: This is a **support tool**, not a replacement for professional mental health care. When in doubt, encourage users to seek licensed help. 💙
