# Hybrid Scorer Integration

## What Changed

**Replaced:** `OllamaClient` (single-model enrichment)  
**With:** `HybridScorer` (HF + Embeddings + Ollama fusion)

## Why

The original Ollama-only approach produced inconsistent results:
- Repeated baseline contamination (`['fatigue','irritation','low_progress']` for everything)
- Wheel incoherence (illegal primary/secondary pairs)
- Valence/arousal disagreement
- Poor invoked/expressed text support

## How It Works

### 3-Stage Fusion Pipeline

1. **HF Zero-Shot (0.4 weight)**
   - Uses `facebook/bart-large-mnli` for Plutchik emotion classification
   - Extended with emotion synonyms for better matching
   - Returns probability distribution across 8 core emotions

2. **Sentence Embeddings (0.3 weight)**
   - Uses `sentence-transformers/all-MiniLM-L6-v2`
   - Computes similarity between text and:
     - **Driver lexicon** (for `invoked`) - 29 terms like fatigue, overwhelm, connection, pride
     - **Surface tone lexicon** (for `expressed`) - 24 terms like tense, playful, deflated, calm

3. **Ollama Rerank (0.3 weight)**
   - Uses phi3 with minimal deterministic prompt
   - Proposes primary, secondary, invoked (≤3), expressed (≤3)
   - Validates and boosts fusion confidence

### Deterministic Correction Pass

After fusion, the scorer applies correction rules:

- **Fix illegal wheel pairs**: Deny surprise+disgust unless disgust keywords present
- **Validate invoked/expressed**: Keep only text-supported labels (lexical match)
- **Reconcile valence/arousal**: 
  - Joy/trust/pride → high valence
  - Overwhelm/withdrawal/exhaustion → low valence
  - Sadness/trust → lower arousal
  - Fear/anger/surprise → higher arousal

## Schema Compatibility

✅ **NO BREAKING CHANGES** - Output schema is identical to `OllamaClient`:

```python
{
  "invoked": str,              # e.g., "fatigue + irritation"
  "expressed": str,            # e.g., "tense / deflated"
  "wheel": {
    "primary": str,            # Single Plutchik emotion
    "secondary": str           # Adjacent Plutchik emotion
  },
  "valence": float,            # [0, 1]
  "arousal": float,            # [0, 1]
  "confidence": float,         # [0, 1]
  "events": list[str],         # ≤3 items
  "warnings": list[str],       # Risk/quality flags
  "willingness_cues": {        # Nested object
    "hedges": list[str],
    "intensifiers": list[str],
    "negations": list[str],
    "self_reference": list[str]
  }
}
```

## Integration Points

### worker.py Changes

**Line 17:**
```python
from src.modules.hybrid_scorer import HybridScorer
```

**Lines 38-46:**
```python
ollama_client = HybridScorer(
    hf_token=os.getenv('HF_TOKEN'),
    ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    ollama_model=os.getenv('OLLAMA_MODEL', 'phi3:latest'),
    hf_weight=float(os.getenv('HF_WEIGHT', '0.4')),
    emb_weight=float(os.getenv('EMB_WEIGHT', '0.3')),
    ollama_weight=float(os.getenv('OLLAMA_WEIGHT', '0.3')),
    timeout=int(os.getenv('OLLAMA_TIMEOUT', '30'))
)
```

**Line 101:** No change - still calls `ollama_client.enrich(normalized_text)`

### Environment Variables

Add to `.env`:

```bash
# Hugging Face API token
HF_TOKEN=hf_xxxxxxxxxxxxx

# Fusion weights (optional, defaults shown)
HF_WEIGHT=0.4
EMB_WEIGHT=0.3
OLLAMA_WEIGHT=0.3
```

## Testing Strategy

1. **Health check:** `ollama_client.is_available()` now checks both HF and Ollama
2. **Schema validation:** Output passes same validation as before
3. **Integration test:** Run `debug_worker.py` with sample reflections
4. **Reference validation:** Compare against 12 expected reference enrichments

## Expected Improvements

Based on discrepancy analysis, expect:
- ✅ Correct primary in **≥10/12** reflections (was ~6/12)
- ✅ Secondary within adjacency in **≥9/12** (was ~4/12)
- ✅ Invoked contains correct driver in **≥10/12** (was ~3/12)
- ✅ Expressed matches surface tone in **≥9/12** (was ~5/12)
- ✅ Valence/arousal consistent with emotion (was divergent)

## Tuning Knobs

If results need adjustment, tune these without code changes:

```bash
# More weight to HF (stronger semantic understanding)
HF_WEIGHT=0.5
EMB_WEIGHT=0.25
OLLAMA_WEIGHT=0.25

# More weight to Ollama (trust LLM rerank more)
HF_WEIGHT=0.3
EMB_WEIGHT=0.2
OLLAMA_WEIGHT=0.5
```

Weights must sum to 1.0.

## Rollback Plan

If hybrid scorer fails:

1. Revert `worker.py` line 17: `from src.modules.ollama_client import OllamaClient`
2. Revert lines 38-46 to original `OllamaClient(...)` initialization
3. Remove `HF_TOKEN` from `.env`
4. Restart worker

## Monitoring

Check logs for:
- `🧠 Hybrid Enrichment Pipeline` - indicates hybrid scorer active
- HF/Embedding scores in console output
- Latency (should be ~2-4s for HF + Ollama, was ~1-2s Ollama-only)

## Next Steps

1. Add HF_TOKEN to production `.env`
2. Test with debug_worker.py
3. Monitor first 50 enrichments for quality
4. Adjust fusion weights if needed
5. Document final weight configuration once converged
