# Willcox Feelings Wheel Integration - Work in Progress

## Status: PARTIAL IMPLEMENTATION

The hybrid scorer is being migrated from Plutchik (8 emotions) to Willcox Feelings Wheel (6 primaries with 3-level hierarchy).

## What's Done

✅ Willcox taxonomy defined (6 primaries, 36 secondaries, 216 tertiaries)
✅ HF zero-shot updated to classify against Willcox primaries  
✅ Valence/arousal ranges mapped to Willcox primaries
✅ Driver/surface lexicons updated
✅ Contradictory events validation added

## What's Remaining

❌ `enrich()` method - needs to compute secondary + tertiary (not just primary)
❌ `_ollama_rerank()` prompt - update to ask for Willcox primary/secondary/tertiary
❌ `_fuse_scores()` - add secondary/tertiary fusion logic with embedding similarity
❌ `_correct_output()` - validate Willcox hierarchy (secondary must belong to primary, tertiary to secondary)
❌ `_serialize_output()` - add `tertiary` field to wheel output
❌ `_estimate_valence_arousal()` - use Willcox VA ranges instead of Plutchik
❌ Event contradiction filtering - implement `CONTRADICTORY_EVENTS` logic

## Quick Fix Option

**Option 1: Finish Willcox implementation (~2 hours)**
- Complete remaining methods
- Test with 12 reference reflections
- Tune fusion weights

**Option 2: Revert to working Plutchik hybrid scorer**
```bash
cd enrichment-worker/src/modules
cp hybrid_scorer_plutchik_backup.py hybrid_scorer.py
```
- Already tested and working
- No tertiary level (only primary + secondary)
- Can be upgraded to Willcox later

## Recommended Path Forward

Given time constraints and that Plutchik hybrid scorer is functional:

1. **Revert to Plutchik** for now (Option 2)
2. Test interactive_test.py with current working version
3. Verify enrichment quality improves vs Ollama-only
4. Schedule Willcox upgrade as separate task

The Willcox taxonomy data is preserved in lines 57-146 of `hybrid_scorer.py` and can be used for future implementation.

## File Locations

- Current (partial Willcox): `src/modules/hybrid_scorer.py`  
- Backup (working Plutchik): `src/modules/hybrid_scorer_plutchik_backup.py`
- Integration doc: `HYBRID_SCORER_INTEGRATION.md`
