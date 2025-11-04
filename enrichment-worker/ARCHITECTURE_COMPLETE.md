# Variable-Specific Hybridization Architecture

## Executive Summary

This document captures the **complete ML pipeline architecture** for Leo's behavioral inference system, integrating:
1. **EES-1 Enforcement** (6×6×6 Willcox Wheel - 216 emotion states)
2. **Variable-Specific Hybridization** (per-dimension blend topology)
3. **Context-Adaptive Weighting** (behavioral meta-learning)
4. **OpenVINO Integration** (GPU/NPU acceleration)
5. **SFT + DPO/ORPO** (empathetic-stranger voice fine-tuning)

---

## Core Innovation: Per-Variable Blend Topology

### The Problem
Traditional ensemble models use a **single set of weights** across all predictions. This ignores the fact that different psychological dimensions respond differently to signal types:
- **Valence** is well-captured by lexical polarity + transformer
- **Expressed emotion** requires LLM narrative interpretation
- **Temporal comparator** needs historical context (GRU/EMA)

### The Solution
Each output variable gets its **own learned blend vector**:

```python
w_v = [α_Lx, α_Em, α_Tr, α_Tm, α_LL]  # sum(α) = 1.0
```

Where:
- **Lx**: Lexical + statistical (VADER, NRC, n-grams)
- **Em**: Embedding similarity (SentenceTransformers, MiniLM)
- **Tr**: Transformer heads (RoBERTa fine-tuned)
- **Tm**: Temporal model (GRU + EMA smoothing)
- **LL**: LLM composer (OpenVINO fine-tuned 3-7B)

---

## Variable-Specific Weight Profiles

| Variable | Lx | Em | Tr | Tm | LL | Rationale |
|----------|----|----|----|----|-----|-----------|
| **Valence** | 0.35 | 0.20 | 0.25 | 0.20 | 0.00 | Lexical+transformer capture polarity; temporal smooths; no LLM needed |
| **Arousal** | 0.40 | 0.10 | 0.25 | 0.25 | 0.00 | Lexical markers (intensifiers, CAPS) dominate; temporal gives rhythm |
| **Invoked (primary)** | 0.10 | 0.25 | 0.35 | 0.00 | 0.30 | Core via transformer; nuance from embeddings + LLM micro-interpretation |
| **Invoked (tertiary)** | 0.00 | 0.25 | 0.25 | 0.00 | 0.50 | 216 micro-nuances best captured by LLM interpretive layer |
| **Expressed (primary)** | 0.05 | 0.20 | 0.25 | 0.00 | 0.50 | LLM infers social inhibition/self-awareness; lexical minimal |
| **Willingness** | 0.15 | 0.10 | 0.15 | 0.10 | 0.50 | Half driven by narrative nuance/LLM empathy reading |
| **Congruence** | 0.25 | 0.10 | 0.25 | 0.25 | 0.15 | Measurable by invoked/expressed overlap; temporal adds consistency |
| **Comparator (Δ)** | 0.20 | 0.00 | 0.15 | 0.50 | 0.15 | Temporal model dominates (baseline vs current); LLM interprets deviation |
| **Poems/Tips** | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | Fully LLM generation; others provide context only |

**Stored in**: `models/hybrid_v1/blend_weights.json`

---

## Context-Adaptive Weighting

Base weights are **modulated by behavioral cues**:

```python
# Pseudocode for adaptive blending
alpha = base_weights[variable]

if text_len < 30:
    alpha[Lx] += 0.10  # Lexical dominance for short text
    
if lang == 'hi':
    alpha[Em] += 0.10  # Embeddings handle multilingual better
    alpha[Tr] -= 0.10  # Transformer may be English-biased
    
if time_diff < 6h:
    alpha[Tm] += 0.10  # Temporal continuity high
    
if transformer_confidence < 0.5:
    alpha[LL] += 0.20  # Let LLM reinterpret ambiguous text
    alpha[Tr] -= 0.15
    
alpha = normalize(alpha)  # Ensure sum = 1.0
```

### Context Features
- `text_len`: Character count
- `lang`: en | hi | hinglish
- `hour`: 0-23 (circadian phase)
- `weekday`: Mon-Sun
- `time_since_last_hours`: Temporal continuity
- `user_reflection_count`: Experience level
- `transformer_confidence`: Model uncertainty
- `lexical_signal_strength`: VADER/NRC intensity
- `embedding_similarity_max`: Semantic clarity
- `temporal_ema_available`: History present

---

## Training Pipeline

### 1. Pre-train Base Components

Each component trained independently on labeled data:

```bash
# Lexical (rule-based, no training)
python scripts/build_lexical.py  # VADER, NRC, n-grams

# Embeddings (SentenceTransformers)
python scripts/train_embeddings.py --model sentence-transformers/all-MiniLM-L6-v2

# Transformer heads (RoBERTa)
python scripts/train_transformer.py --model roberta-base --tasks valence,arousal,invoked,expressed

# Temporal (GRU)
python scripts/train_temporal.py --architecture gru --ema_windows 1d,7d,28d

# LLM (QLoRA fine-tuning)
python scripts/train_sft.py --model microsoft/phi-3-mini-4k --lora_r 16
python scripts/train_dpo.py --base_model phi3-sft --pairs data/dpo/train.jsonl
```

### 2. Generate OOF Predictions

```bash
# 5-fold grouped by user, stratified on primary emotion
python scripts/split_kfold.py --folds 5 --group_by user_id --stratify primary

# Run each base component on validation folds
python scripts/predict_base_components.py --fold all --output data/oof_predictions.jsonl
```

### 3. Train Meta-Blender (LGBM)

```python
# Input: [Lx_pred, Em_pred, Tr_pred, Tm_pred, LL_pred, context_features]
# Output: Optimal α vector per variable

python scripts/train_blender.py \
    --oof_predictions data/oof_predictions.jsonl \
    --output models/hybrid_v1/blend_meta_lgbm.pkl \
    --optimize_per_variable \
    --objective minimize_rmse_f1
```

**Meta-LGBM Architecture**:
- **Input**: 5 base predictions + 10 context features
- **Output**: 5 weights (α) per variable (sum=1.0)
- **Loss**: Per-variable (RMSE for regression, cross-entropy for classification)
- **Optimization**: Optuna hyperparameter search on validation

---

## Inference Flow

```python
def predict(reflection):
    # Extract features
    text = reflection['normalized_text']
    context = extract_context(reflection)  # text_len, lang, hour, etc.
    
    # Base component predictions
    lex_preds = lexical_predictor.predict(text)
    emb_preds = embedding_predictor.predict(text)
    tr_preds = transformer.predict(text)
    tm_preds = temporal.predict(reflection['user_id'], context['time'])
    llm_preds = llm_service.predict(text, context)
    
    # Meta-blender computes adaptive weights
    results = {}
    for var in VARIABLES:
        # Get context-adaptive weights
        alpha = meta_blender.predict_weights(
            var=var,
            context=context,
            confidences={
                'Lx': lex_preds[var]['confidence'],
                'Em': emb_preds[var]['confidence'],
                'Tr': tr_preds[var]['confidence'],
                'Tm': tm_preds[var]['confidence'],
                'LL': llm_preds[var]['confidence']
            }
        )
        
        # Weighted blend
        results[var] = weighted_sum([
            lex_preds[var],
            emb_preds[var],
            tr_preds[var],
            tm_preds[var],
            llm_preds[var]
        ], weights=alpha)
        
        # Store explainability
        results[var]['blend_weights'] = alpha
        results[var]['dominant_component'] = component_names[argmax(alpha)]
    
    return compose_json(results)
```

---

## EES-1 Integration

All emotion outputs (invoked, expressed) **strictly enforce** the 6×6×6 Willcox Wheel:

```python
from src.modules.emotion_enforcer import get_emotion_enforcer

enforcer = get_emotion_enforcer()

# After blend prediction
enforced = enforcer.enforce_hybrid_output({
    'primary': results['invoked_primary'],
    'secondary': results['invoked_secondary'],
    'tertiary': results['invoked_tertiary'],
    'confidence_scores': {...}
})

# Auto-normalize invalid emotions
# Happy/Joyful/Energetic → Happy/Excited/Energetic (snapped to valid path)
```

**Enforcement Points**:
1. **HybridScorer** (Stage-1): After wheel construction
2. **EnrichmentDispatcher** (Stage-2): Before passing to enrichers
3. **Meta-Blender**: Classification heads constrained to 216 valid states

---

## Dataset Requirements

### Perception Labels
- **Target**: ≥20,000 reflections
- **Distribution**: Balanced across 6 primary emotions
- **Languages**: 60% en, 30% hinglish, 10% hi
- **User coverage**: ≥500 unique users
- **Temporal coverage**: ≥3 reflections/user for temporal features

### Generation (SFT)
- **Target**: 5,000 high-quality pairs
- **Composition**:
  - 3,000 manual (expert-labeled)
  - 2,000 augmented (back-translation, paraphrase)
- **Quality gates**:
  - ✅ Mirrors 1-2 user specifics
  - ✅ No banned phrases
  - ✅ Locale-aware (urban India)
  - ✅ EES-1 emotion-grounded

### Generation (DPO)
- **Target**: 3,000 (good, bad) pairs
- **Focus areas**:
  - Cliché avoidance (50%)
  - Specificity (30%)
  - Safety (diagnosis/promises) (20%)
- **Preference strength**: 70% strong, 30% weak

---

## Explainability Layer

### Per-Prediction Transparency

```json
{
  "valence": 0.35,
  "valence_blend": {
    "lexical": 0.40,      // α_Lx (context-adjusted from base 0.35)
    "embedding": 0.20,    // α_Em
    "transformer": 0.20,  // α_Tr (reduced due to low confidence)
    "temporal": 0.20,     // α_Tm
    "llm": 0.00           // α_LL
  },
  "valence_contributions": {
    "lexical": 0.42,      // Lx prediction
    "embedding": 0.38,    // Em prediction
    "transformer": 0.31,  // Tr prediction (flagged low confidence)
    "temporal": 0.33,     // Tm prediction
    "llm": null
  },
  "dominant_component": "lexical",
  "confidence": 0.87,
  "context_adjustments": [
    "short_text: +0.10 lexical, -0.05 transformer",
    "low_transformer_confidence: -0.05 transformer"
  ]
}
```

### Aggregate Analytics

```python
# Which components are most used per variable?
python scripts/analyze_blend_usage.py --run_id exp_001

# Output:
# Valence: Lexical (45%), Transformer (28%), Temporal (20%), Embedding (7%)
# Expressed: LLM (62%), Transformer (20%), Embedding (12%), Lexical (6%)
```

---

## IP Defensibility

### Proprietary Elements

1. **Variable-Specific Hybridization**:
   - Each psychological dimension has its own dynamic topology
   - Not just "model stacking" - behavioral theory-driven

2. **Context-Adaptive Weighting**:
   - Meta-LGBM learns when to trust which sub-brain
   - Uses behavioral cues (language, circadian, expression style)

3. **Temporal Personalization**:
   - Weights evolve per user over time as confidence grows
   - User-specific blend profiles (privacy-preserving)

4. **Bidirectional Architecture**:
   - Same weighting logic runs in reverse for generation
   - Perception → Generation symmetry

5. **Explainability Layer**:
   - Logs which component contributed most
   - Transparent to therapists/researchers
   - Enables clinical validation

### Patent Brief (Draft)

**Title**: "Modular Hybrid Emotion Inference and Expression Synthesis System with Variable-Specific Dynamic Weighting"

**Claims**:
1. A behavioral inference system wherein sub-model contributions are dynamically weighted per target variable and contextual meta-features
2. A meta-learning layer that adapts blend topology based on text characteristics, temporal continuity, and model confidence
3. A bidirectional architecture enabling both perception (text → emotion) and generation (emotion → text) using symmetric weighting logic
4. An explainability layer that decomposes predictions into interpretable component contributions
5. Integration with strict emotion taxonomy (EES-1) for clinical/research validity

---

## Deployment Architecture

### Feature Flags

```bash
# Enrichment implementation
ENRICH_IMPL=legacy|openvino  # Default: legacy

# Canary rollout
ENRICH_CANARY_PERCENT=0-100  # Default: 0 (disabled)

# Model bundle
PERCEPTION_MODEL_BUNDLE=models/hybrid_v1/  # Path to blend bundle

# Auto-rollback
AUTO_ROLLBACK=true|false  # Default: true

# Device selection
OV_DEVICE=GPU|NPU|CPU  # Default: GPU (Intel Arc)
```

### Model Bundle Structure

```
models/hybrid_v1/
├── manifest.yaml                    # Dependency graph, versions
├── blend_weights.json               # Base α vectors per variable
├── blend_meta_lgbm.pkl              # Meta-blender (LGBM)
├── config.yaml                      # Component mappings
├── lexical/
│   ├── vader_lexicon.pkl
│   ├── nrc_lexicon.pkl
│   └── tfidf_vectorizer.pkl
├── embeddings/
│   ├── sentence_transformer.onnx    # OpenVINO IR
│   └── label_embeddings.npy
├── transformer/
│   ├── roberta_valence_head.onnx
│   ├── roberta_arousal_head.onnx
│   ├── roberta_invoked_head.onnx
│   └── roberta_expressed_head.onnx
├── temporal/
│   ├── gru_model.onnx
│   └── ema_baselines.json
└── llm/
    ├── phi3_dpo_openvino.xml        # OpenVINO IR
    ├── phi3_dpo_openvino.bin
    └── tokenizer/
```

### Healthcheck

```python
@app.get("/health")
def health():
    bundle = load_model_bundle(PERCEPTION_MODEL_BUNDLE)
    
    # Boot-time probe
    test_reflection = {
        "normalized_text": "I feel grateful today",
        "lang": "en",
        "timestamp": "2025-11-02T10:00:00Z"
    }
    
    result = bundle.predict(test_reflection)
    
    return {
        "status": "healthy",
        "bundle_version": bundle.version,
        "components": {
            "lexical": "ok",
            "embeddings": "ok",
            "transformer": "ok",
            "temporal": "ok",
            "llm": f"ok (device: {bundle.llm_device})"  # GPU|NPU|CPU
        },
        "ees1_enforcement": "enabled",
        "test_prediction": {
            "valence": result['valence'],
            "dominant_component": result['valence_blend']['dominant']
        }
    }
```

---

## Evaluation Metrics

### Perception

```python
# Run full evaluation
python scripts/eval_perception.py --bundle models/hybrid_v1/ --test_set data/curated/test.jsonl

# Metrics:
# - Valence/Arousal: RMSE, MAE, Pearson r
# - Primary emotion: macro-F1, hierarchy-aware F1
# - Secondary/Tertiary: top-3 accuracy
# - Calibration: ECE, MCE
# - Per-user averages
# - Hinglish slice metrics
```

**Acceptance Criteria**:
- Macro-F1 (primary) ≥ legacy ± 5%
- Valence RMSE ≤ legacy + 0.05
- ECE ≤ 0.05 (well-calibrated)
- Hinglish performance ≥ 90% of English

### Generation

```python
# Run generation evaluation
python scripts/eval_generation.py --bundle models/hybrid_v1/ --test_set data/sft/test.jsonl

# Metrics:
# - Specificity: overlap with user text (ROUGE, BERTScore)
# - Warmth: sentiment analysis
# - Concreteness: vs abstract noun count
# - Platitude penalty: banned phrase detection
# - Safety: diagnosis/promise filter
# - Human eval: win-rate vs legacy
```

**Acceptance Criteria**:
- ≥80% pass style gate
- Human eval win-rate ≥60% vs legacy
- ≤2% safety filter failures
- Banned phrases: 0% in good outputs

### Ablation Studies

```python
# Per-variable component importance
python scripts/eval_blender.py --ablation --bundle models/hybrid_v1/

# Output:
# Valence:
#   - Lexical only:      RMSE 0.18 (Δ +0.07)
#   - + Transformer:     RMSE 0.13 (Δ +0.02)
#   - + Temporal:        RMSE 0.11 (baseline)
#   - Full blend (meta): RMSE 0.10 (Δ -0.01) ← best
#
# Expressed (tertiary):
#   - LLM only:          F1 0.62 (Δ +0.08)
#   - + Embedding:       F1 0.68 (Δ +0.02)
#   - Full blend (meta): F1 0.70 (baseline) ← best
```

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/data_qa.yml
name: Data QA & Model Tests

on: [push, pull_request]

jobs:
  validate_schema:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate EES-1 hierarchy
        run: python scripts/validate_ees1_schema.py
      
      - name: Check blend weights
        run: python scripts/validate_blend_weights.py --check_sum_one
      
      - name: Run data QA
        run: python scripts/qa_dataset.py --input data/curated/*.jsonl
  
  smoke_training:
    runs-on: ubuntu-latest
    steps:
      - name: Mini training run
        run: |
          python scripts/train_blender.py \
            --smoke_test \
            --max_samples 100 \
            --max_iter 10
      
      - name: Golden set comparison
        run: python scripts/golden_compare.py --threshold 0.95
  
  integration_test:
    runs-on: ubuntu-latest
    steps:
      - name: Test enrichment worker
        run: |
          docker-compose up -d enrichment-worker
          python tests/test_enrich_e2e.py --bundle models/hybrid_v1/
```

---

## Migration from Legacy

### Phase 1: Shadow Mode (Week 1-2)
```bash
ENRICH_IMPL=legacy
ENRICH_CANARY_PERCENT=0  # New model runs but results discarded
LOG_BLEND_PREDICTIONS=true  # Compare outputs
```

### Phase 2: Canary Rollout (Week 3-4)
```bash
ENRICH_IMPL=openvino
ENRICH_CANARY_PERCENT=5  # 5% traffic → 10% → 25% → 50%
AUTO_ROLLBACK=true
```

### Phase 3: Full Deployment (Week 5)
```bash
ENRICH_IMPL=openvino
ENRICH_CANARY_PERCENT=100
LEGACY_FALLBACK_ENABLED=true  # Keep legacy warm for 2 weeks
```

---

## Monitoring

### Key Metrics

```python
# Real-time dashboards
- Blend weight distribution per variable
- Dominant component usage %
- Context adjustment frequency
- Transformer confidence trends
- LLM fallback rate
- EES-1 correction rate
- Latency per component (Lx < Em < Tr < Tm < LL)
- Device utilization (GPU/NPU/CPU)
```

### Alerts

```yaml
- Blend weight sum != 1.0 (critical)
- EES-1 correction rate > 10% (warning)
- LLM device fallback to CPU (warning)
- Transformer confidence < 0.3 for >5% traffic (critical)
- Temporal model missing history for >20% users (warning)
```

---

## Next Steps

### Immediate (Week 1)
1. ✅ Directory structure created
2. ✅ Blend weights config finalized
3. ✅ Labeling schema documented
4. ⏳ Create example labeled data
5. ⏳ Build data ingestion scripts

### Short-term (Week 2-4)
- Implement base component trainers
- Build meta-blender training pipeline
- Generate 5k SFT + 3k DPO datasets
- Run grouped k-fold CV
- Export OpenVINO bundles

### Medium-term (Week 5-8)
- Integration testing with enrichment worker
- Canary rollout (5% → 100%)
- Human evaluation (n=100 reflections)
- Performance benchmarking
- Documentation + runbooks

---

**Status**: 🚀 Architecture Finalized, Implementation In Progress  
**Last Updated**: Nov 2, 2025  
**Version**: 1.0
