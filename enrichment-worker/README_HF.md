---
title: Emotion Enrichment Pipeline v2.0
emoji: 🧠
colorFrom: purple
colorTo: pink
sdk: gradio
sdk_version: 4.44.0
app_file: demo_app.py
pinned: false
license: mit
---

# 🧠 Emotion Enrichment Pipeline v2.0

Advanced emotion analysis with rules-based enrichment - **no LLM calls required!**

## Features

### 1. **Negation Handling**
Detects negations within 3-token window and flips emotions:
- "I'm not happy" → Sad (not Happy)
- "not afraid anymore" → Peaceful (relief)

### 2. **Sarcasm Detection**
Three pattern-based detection methods:
- Pattern A: Positive word + negative context ("Great, another deadline")
- Pattern B: Scare quotes ("'amazing' decision")
- Pattern C: Discourse markers ("yeah right", "as if")

### 3. **Profanity Sentiment**
Classifies profanity as positive hype vs negative frustration:
- "fuck yeah" → positive boost to Happy/Strong
- "fuck this" → negative boost to Angry/Sad
- Arousal boost: +0.05 to +0.12

### 4. **Event Valence Separation**
Distinguishes event positivity from emotional response:
- "Got promoted but terrified" → Event Valence = 1.0 (good), Emotion Valence = 0.3 (fear)
- Enables nuanced understanding: good events can trigger negative emotions

### 5. **Control Detection**
Rule-based detection of perceived control:
- **Low**: Passive voice ("got fired"), helpless markers ("couldn't do anything")
- **High**: Volition verbs ("I decided"), agency markers ("I took control")
- **Medium**: Default for ambiguous cases

### 6. **6-Term Context Rerank**
```
Score = 0.18·HF + 0.18·Similarity + 0.26·Domain + 0.22·Control + 0.04·Polarity + 0.12·EventValence
```
Context-aware reranking prioritizes domain and control over raw HF model scores.

### 7. **Confidence Scoring**
8-component weighted confidence:
- HF model confidence (entropy-based)
- Rerank agreement (HF winner vs rerank winner)
- Negation consistency
- Sarcasm consistency
- Control/polarity/domain confidence
- Secondary similarity score

**Categories**: High (≥0.75), Medium (0.60-0.74), Low (0.45-0.59), Uncertain (<0.45)

## Try It Out

Enter any emotional text to see the pipeline in action. Examples provided cover:
- Negation reversal
- Sarcasm detection
- Profanity sentiment
- Event vs emotion split
- Control detection
- Context-based reranking

## Technical Details

**No LLM Calls**: All processing uses:
- Rule-based pattern matching
- Keyword scoring
- Deterministic algorithms
- Fast, predictable latency

**Modular Architecture**: 9 independent modules:
- `negation.py` - 3-token window negation reversal
- `sarcasm.py` - 3-pattern sarcasm detection
- `profanity.py` - Sentiment classification + arousal boost
- `event_valence.py` - Anchor-based event scoring
- `control.py` - Rule-based control detection
- `polarity.py` - Temporal framing patterns
- `domain.py` - Multi-domain keyword matching
- `va.py` - Expanded valence/arousal ranges
- `rerank.py` - 6-term scoring formula
- `confidence.py` - 8-component confidence

**Acceptance Criteria Met**:
- ✅ ≥80% negation success
- ✅ ≥75% sarcasm direction accuracy
- ✅ Arousal reacts to profanity
- ✅ Control never returns None (defaults to medium)
- ✅ Event valence always emitted
- ✅ Confidence calibration with uncertain flag

## Citation

```bibtex
@software{emotion_enrichment_v2,
  title = {Emotion Enrichment Pipeline v2.0},
  author = {Leo Team},
  year = {2025},
  url = {https://huggingface.co/spaces/YOUR_USERNAME/emotion-enrichment-v2}
}
```

## License

MIT License
