# Migration Guide: v2.0/v2.1 → v2.2

## Overview

This guide helps you migrate from Enrichment Pipeline v2.0 or v2.1 to v2.2. The v2.2 release adds powerful new features while maintaining backward compatibility with v2.1.

**Migration Complexity:**
- **v2.1 → v2.2:** Low (backward compatible, optional features)
- **v2.0 → v2.2:** Medium (schema changes require updates)

**Estimated Migration Time:**
- v2.1 → v2.2: 1-2 hours
- v2.0 → v2.2: 4-6 hours

---

## What's New in v2.2

### Major Features

1. **Tertiary Emotions** (197 fine-grain states)
2. **Neutral Emotion Detection** (distinguishes true neutral from Peaceful/Calm)
3. **Graded Negation** (4-level negation strength: 0.15 → 0.60)
4. **Litotes Detection** ("not bad" → positive flip)
5. **Profanity-Angry Coupling** (profanity keywords boost Angry emotion)
6. **Confidence Calibration** (3 methods: temperature, Platt, isotonic)
7. **Observability Infrastructure** (structured logging, PII masking, metrics)
8. **Feature Flags** (A/B testing support)

### Schema Changes

**New Fields:**
```typescript
// final object
final.tertiary: string | null                    // NEW: 197 tertiary emotions
final.is_emotion_neutral: boolean                // NEW: True neutral detection
final.is_event_neutral: boolean                  // NEW: Event neutral flag
final.flags.has_negation: boolean                // NEW: Negation detected
final.flags.negation_strength: number            // NEW: 0.15-0.60
final.flags.is_litotes: boolean                  // NEW: Litotes ("not bad")
final.flags.has_profanity: boolean               // NEW: Profanity detected

// calibration object (NEW)
calibration: {
  method: string,
  pre_calibration_confidence: number,
  post_calibration_confidence: number,
  ece: number,
  temperature: number | null
}

// observability object (NEW)
observability: {
  request_id: string,
  latency_ms: number,
  pii_masked: boolean,
  feature_flags: {...},
  pipeline_version: string
}
```

**Deprecated Fields (v2.0 only):**
```typescript
final.invoked: string        // DEPRECATED: Use final.primary
final.expressed: string      // DEPRECATED: Use final.secondary
final.valence: number        // DEPRECATED: Use final.emotion_valence
```

---

## Migration Path

### From v2.1 to v2.2

**Good News:** v2.2 is fully backward compatible with v2.1! No breaking changes.

#### Step 1: Update Dependencies

**Add new dependencies to `requirements.txt`:**
```txt
# Existing dependencies
requests>=2.31.0
python-dotenv>=1.0.0
upstash-redis>=0.15.0

# NEW v2.2 dependencies
numpy>=1.24.0
scipy>=1.10.0
scikit-learn>=1.3.0
```

**Install:**
```bash
pip install -r requirements.txt
```

#### Step 2: Update Import (Optional)

**v2.1 code (still works):**
```python
from src.enrich.pipeline_v2_1 import enrich_v2_1

result = enrich_v2_1(text, user_history)
```

**v2.2 code (recommended):**
```python
from src.enrich.pipeline_v2_2 import enrich_v2_2

result = enrich_v2_2(
    text=text,
    user_history=user_history,
    include_tertiary=True,    # NEW: Enable tertiary emotions
    include_neutral=True,     # NEW: Enable neutral detection
    apply_calibration=True    # NEW: Enable confidence calibration
)
```

#### Step 3: Update Client Code (Optional)

**Access new v2.2 fields:**
```python
# Tertiary emotion
if result.final.tertiary:
    print(f"Fine-grain emotion: {result.final.tertiary}")

# Neutral detection
if result.final.is_emotion_neutral:
    print("Truly neutral affect (not Peaceful/Calm)")

# Negation
if result.final.flags.has_negation:
    print(f"Negation strength: {result.final.flags.negation_strength}")

# Litotes
if result.final.flags.is_litotes:
    print("Litotes detected (e.g., 'not bad')")

# Calibrated confidence
print(f"Confidence: {result.calibration.post_calibration_confidence}")
print(f"ECE: {result.calibration.ece}")
```

#### Step 4: Enable Feature Flags (Optional)

**Add feature flag configuration:**
```python
from src.enrich.observability import FeatureFlagManager

flag_manager = FeatureFlagManager()
flag_manager.set_flag('neutral_detection', enabled=True, rollout_percentage=100)
flag_manager.set_flag('tertiary_emotions', enabled=True, rollout_percentage=100)
flag_manager.set_flag('confidence_calibration', enabled=True, rollout_percentage=50)  # A/B test

# Check flags before enrichment
if flag_manager.is_enabled('tertiary_emotions'):
    result = enrich_v2_2(text, include_tertiary=True)
```

#### Step 5: Validate (Recommended)

**Run tests:**
```bash
pytest tests/test_observability.py -v   # 9 tests
pytest tests/test_calibration.py -v     # 10 tests
pytest tests/test_pipeline_v2_2.py -v   # Integration tests
```

**Check backward compatibility:**
```python
# Ensure v2.1 code still works
from src.enrich.pipeline_v2_1 import enrich_v2_1
result_v2_1 = enrich_v2_1("I'm feeling happy")
assert result_v2_1.final.primary == "Happy"

# Ensure v2.2 returns same results for v2.1 fields
from src.enrich.pipeline_v2_2 import enrich_v2_2
result_v2_2 = enrich_v2_2("I'm feeling happy")
assert result_v2_2.final.primary == "Happy"
```

**✅ Migration Complete!** v2.1 → v2.2 is done.

---

### From v2.0 to v2.2

**Warning:** v2.0 has deprecated fields that require code updates.

#### Step 1: Update Dependencies

Same as v2.1 → v2.2 (see above).

#### Step 2: Update Import

**v2.0 code (deprecated):**
```python
from src.enrich.pipeline_v2_0 import enrich_v2_0

result = enrich_v2_0(text, user_history)
```

**v2.2 code:**
```python
from src.enrich.pipeline_v2_2 import enrich_v2_2

result = enrich_v2_2(
    text=text,
    user_history=user_history,
    include_tertiary=True,
    include_neutral=True,
    apply_calibration=True
)
```

#### Step 3: Update Field Access (BREAKING)

**v2.0 deprecated fields → v2.2 replacements:**

| v2.0 Field | v2.2 Replacement | Notes |
|------------|------------------|-------|
| `final.invoked` | `final.primary` | Same semantics |
| `final.expressed` | `final.secondary` | Same semantics |
| `final.valence` | `final.emotion_valence` | Now separate from event_valence |

**Example migration:**

**v2.0 code:**
```python
result = enrich_v2_0(text)

primary = result.final.invoked         # DEPRECATED
secondary = result.final.expressed     # DEPRECATED
valence = result.final.valence         # DEPRECATED

print(f"Emotion: {primary} → {secondary}, Valence: {valence}")
```

**v2.2 code:**
```python
result = enrich_v2_2(text)

primary = result.final.primary         # NEW
secondary = result.final.secondary     # NEW
valence = result.final.emotion_valence # NEW (was final.valence)

print(f"Emotion: {primary} → {secondary}, Valence: {valence}")
```

#### Step 4: Handle Dual Valence (BREAKING)

**v2.0:** Single `valence` field  
**v2.2:** Separate `emotion_valence` and `event_valence`

**Migration strategy:**

**Option 1: Use emotion_valence (recommended)**
```python
# v2.0
valence = result.final.valence

# v2.2
valence = result.final.emotion_valence  # Use emotion valence
```

**Option 2: Average both valences**
```python
# v2.2 - Average emotion and event valence
avg_valence = (result.final.emotion_valence + result.final.event_valence) / 2
```

**Option 3: Use both separately**
```python
# v2.2 - Use both for richer analysis
emotion_valence = result.final.emotion_valence
event_valence = result.final.event_valence

print(f"Emotion: {emotion_valence:.2f}, Event: {event_valence:.2f}")
# Example: Emotion 0.3 (Sad), Event 0.7 (but good outcome)
```

#### Step 5: Update Database Schema (If Storing Results)

**Add new columns to database:**
```sql
-- Add v2.2 columns
ALTER TABLE reflections ADD COLUMN tertiary VARCHAR(100);
ALTER TABLE reflections ADD COLUMN is_emotion_neutral BOOLEAN DEFAULT FALSE;
ALTER TABLE reflections ADD COLUMN is_event_neutral BOOLEAN DEFAULT FALSE;
ALTER TABLE reflections ADD COLUMN has_negation BOOLEAN DEFAULT FALSE;
ALTER TABLE reflections ADD COLUMN negation_strength FLOAT;
ALTER TABLE reflections ADD COLUMN is_litotes BOOLEAN DEFAULT FALSE;
ALTER TABLE reflections ADD COLUMN has_profanity BOOLEAN DEFAULT FALSE;
ALTER TABLE reflections ADD COLUMN calibrated_confidence FLOAT;
ALTER TABLE reflections ADD COLUMN ece FLOAT;

-- Rename v2.0 columns (if not done in v2.1)
ALTER TABLE reflections RENAME COLUMN invoked TO primary;
ALTER TABLE reflections RENAME COLUMN expressed TO secondary;
ALTER TABLE reflections RENAME COLUMN valence TO emotion_valence;

-- Add event_valence (NEW in v2.1)
ALTER TABLE reflections ADD COLUMN event_valence FLOAT;
```

#### Step 6: Backfill Event Valence (Optional)

If migrating from v2.0, you need to populate `event_valence` for old records.

**Strategy 1: Copy emotion_valence**
```sql
-- Simplest: assume event_valence = emotion_valence
UPDATE reflections 
SET event_valence = emotion_valence 
WHERE event_valence IS NULL;
```

**Strategy 2: Re-enrich old records**
```python
# Re-run enrichment on old reflections
from src.enrich.pipeline_v2_2 import enrich_v2_2

old_reflections = db.query("SELECT rid, normalized_text FROM reflections WHERE event_valence IS NULL")

for refl in old_reflections:
    result = enrich_v2_2(refl['normalized_text'])
    db.update(refl['rid'], {
        'event_valence': result.final.event_valence,
        'tertiary': result.final.tertiary,
        'is_emotion_neutral': result.final.is_emotion_neutral,
        # ... other new fields
    })
```

#### Step 7: Update API Contracts

**If you have a REST API wrapping enrichment:**

**Update OpenAPI spec:**
```yaml
# openapi.yaml
EnrichmentResult:
  type: object
  properties:
    final:
      type: object
      properties:
        primary:           # RENAMED from 'invoked'
          type: string
          enum: [Happy, Sad, Angry, Fearful, Surprised, Disgusted, Neutral]
        secondary:         # RENAMED from 'expressed'
          type: string
        tertiary:          # NEW
          type: string
          nullable: true
        emotion_valence:   # RENAMED from 'valence'
          type: number
        event_valence:     # NEW
          type: number
        # ... rest of schema
```

**Update API response mapping:**
```python
# API handler
@app.post("/enrich")
def enrich_endpoint(text: str):
    result = enrich_v2_2(text)
    
    return {
        "final": {
            "primary": result.final.primary,
            "secondary": result.final.secondary,
            "tertiary": result.final.tertiary,         # NEW
            "emotion_valence": result.final.emotion_valence,
            "event_valence": result.final.event_valence,
            "is_emotion_neutral": result.final.is_emotion_neutral,  # NEW
            # ... other fields
        },
        "calibration": {                                # NEW
            "confidence": result.calibration.post_calibration_confidence,
            "ece": result.calibration.ece
        }
    }
```

#### Step 8: Validate (Critical)

**Run comprehensive tests:**
```bash
# Unit tests
pytest tests/test_observability.py -v
pytest tests/test_calibration.py -v
pytest tests/test_negation.py -v
pytest tests/test_neutral.py -v
pytest tests/test_pipeline_v2_2.py -v

# Golden Set evaluation
python tests/test_golden_set.py
# Expected: Primary F1 ≥ 0.78, Secondary F1 ≥ 0.70
```

**Regression testing:**
```python
# Ensure v2.2 returns similar results to v2.0 for core fields
from src.enrich.pipeline_v2_0 import enrich_v2_0
from src.enrich.pipeline_v2_2 import enrich_v2_2

test_texts = ["I'm happy", "I'm sad", "I'm angry", "I'm anxious"]

for text in test_texts:
    result_v2_0 = enrich_v2_0(text)
    result_v2_2 = enrich_v2_2(text)
    
    # Primary emotion should match
    assert result_v2_0.final.invoked == result_v2_2.final.primary
    
    # Valence should be similar (within 0.1)
    assert abs(result_v2_0.final.valence - result_v2_2.final.emotion_valence) < 0.1
```

**✅ Migration Complete!** v2.0 → v2.2 is done.

---

## Configuration Changes

### Environment Variables

**New in v2.2:**
```bash
# Confidence calibration
CALIBRATION_METHOD=temperature_scaling  # or platt_scaling, isotonic_regression
CALIBRATION_ENABLED=true

# Observability
ENABLE_PII_MASKING=true
STRUCTURED_LOGGING=true
LOG_LEVEL=INFO

# Feature flags
FEATURE_FLAG_NEUTRAL_DETECTION=true
FEATURE_FLAG_TERTIARY_EMOTIONS=true
FEATURE_FLAG_CONFIDENCE_CALIBRATION=true
```

**Updated .env.example:**
```bash
# Copy new .env.example
cp .env.example .env

# Add v2.2 variables
echo "CALIBRATION_METHOD=temperature_scaling" >> .env
echo "CALIBRATION_ENABLED=true" >> .env
echo "ENABLE_PII_MASKING=true" >> .env
echo "STRUCTURED_LOGGING=true" >> .env
```

---

## Rollback Plan

### v2.2 → v2.1 Rollback

**If you encounter issues, rollback is straightforward:**

1. **Restore previous code:**
   ```bash
   git checkout v2.1
   ```

2. **Restore dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Restart worker:**
   ```bash
   python worker.py
   ```

4. **Database:** No changes needed (v2.2 columns can remain, just unused)

### Data Safety

**v2.2 does NOT delete v2.1 data:**
- All v2.1 fields remain intact
- New v2.2 fields are additive (nullable)
- No data loss on rollback

---

## Testing Strategy

### Pre-Migration Testing

**1. Backup production data:**
```bash
# Backup Redis
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/redis_pre_v2.2.rdb

# Backup database (if using)
pg_dump enrichment_db > /backup/enrichment_pre_v2.2.sql
```

**2. Test in staging:**
```bash
# Deploy v2.2 to staging
git checkout v2.2
pip install -r requirements.txt
python worker.py  # Run in staging environment

# Process test reflections
curl -X POST http://staging:8000/enrich -d '{"text": "I am feeling happy"}'

# Validate results
pytest tests/ -v
```

### Post-Migration Testing

**1. Smoke tests:**
```bash
# Test health endpoint
curl http://localhost:8001/healthz

# Process one reflection
curl -X POST http://localhost:8000/enrich -d '{"text": "I am tired"}'
```

**2. Regression tests:**
```bash
# Run Golden Set
python tests/test_golden_set.py

# Expected: No regressions in F1 scores
```

**3. Performance tests:**
```bash
# Benchmark latency
python tests/benchmark_latency.py

# Expected: P95 < 100ms
```

**4. Monitor for 24 hours:**
- Check error rate (should be < 1%)
- Check latency (P95 < 100ms)
- Check ECE (should be ≤ 0.08)
- Check Neutral rate (5-10%)

---

## Breaking Changes Summary

### v2.0 → v2.2 Breaking Changes

| Change | Impact | Migration Required |
|--------|--------|-------------------|
| `final.invoked` → `final.primary` | High | Update all references |
| `final.expressed` → `final.secondary` | High | Update all references |
| `final.valence` → `final.emotion_valence` | High | Update all references |
| Added `final.event_valence` | Medium | Decide how to handle dual valence |
| Database schema changes | Medium | Run ALTER TABLE statements |
| API contract changes | Medium | Update OpenAPI spec |

### v2.1 → v2.2 Breaking Changes

**None!** v2.2 is fully backward compatible with v2.1.

---

## Frequently Asked Questions

### Q: Do I need to re-enrich old reflections?

**A:** No, not required. Old reflections remain valid. But if you want new v2.2 features (tertiary emotions, neutral detection, calibration), you can re-enrich selectively.

### Q: Will v2.1 code still work?

**A:** Yes! v2.1 code is fully supported. The `enrich_v2_1()` function still works and returns the same results.

### Q: How do I enable only some v2.2 features?

**A:** Use feature flags:
```python
result = enrich_v2_2(
    text=text,
    include_tertiary=False,        # Disable tertiary emotions
    include_neutral=True,          # Enable neutral detection
    apply_calibration=True         # Enable calibration
)
```

### Q: What if calibration makes confidence worse?

**A:** Calibration should always improve ECE. If not:
1. Check you have enough training data (≥ 200 examples)
2. Try a different calibration method (Platt or isotonic)
3. Disable calibration: `apply_calibration=False`

### Q: How do I handle the new `event_valence` field?

**A:** Three options:
1. Use only `emotion_valence` (ignore `event_valence`)
2. Average both: `(emotion_valence + event_valence) / 2`
3. Use both separately for richer analysis

### Q: Can I migrate gradually (feature by feature)?

**A:** Yes! Enable features incrementally:
- **Week 1:** Migrate to v2.2 with all new features disabled
- **Week 2:** Enable neutral detection
- **Week 3:** Enable tertiary emotions
- **Week 4:** Enable confidence calibration

### Q: What's the performance impact of v2.2?

**A:**
- Tertiary emotions: +10ms latency
- Neutral detection: +5ms latency
- Calibration: +2ms latency
- Total: +15-20ms (still within P95 < 100ms target)

### Q: How do I test backward compatibility?

**A:** Run both v2.1 and v2.2 side-by-side:
```python
from src.enrich.pipeline_v2_1 import enrich_v2_1
from src.enrich.pipeline_v2_2 import enrich_v2_2

text = "I'm feeling happy"

result_v2_1 = enrich_v2_1(text)
result_v2_2 = enrich_v2_2(text)

# Compare core fields
assert result_v2_1.final.primary == result_v2_2.final.primary
assert abs(result_v2_1.final.emotion_valence - result_v2_2.final.emotion_valence) < 0.1
```

---

## Support & Resources

**Documentation:**
- README.md - Overview and setup
- RUNBOOK.md - Operational procedures
- API_CONTRACT.md - Full schema documentation

**Testing:**
- tests/test_observability.py - Observability tests
- tests/test_calibration.py - Calibration tests
- tests/test_pipeline_v2_2.py - Integration tests

**Support:**
- GitHub Issues: Report migration issues
- Email: devops@example.com
- Slack: #enrichment-worker

**Migration Assistance:**
- Automated migration script: `scripts/migrate_v2.0_to_v2.2.py` (TODO)
- Database migration script: `scripts/migrate_db_v2.2.sql` (TODO)

---

## Migration Checklist

### v2.1 → v2.2 Checklist

- [ ] Update `requirements.txt` with v2.2 dependencies
- [ ] Run `pip install -r requirements.txt`
- [ ] Update imports to use `enrich_v2_2` (optional)
- [ ] Enable tertiary emotions: `include_tertiary=True` (optional)
- [ ] Enable neutral detection: `include_neutral=True` (optional)
- [ ] Enable calibration: `apply_calibration=True` (optional)
- [ ] Update client code to access new fields (optional)
- [ ] Run tests: `pytest tests/ -v`
- [ ] Deploy to staging
- [ ] Validate in staging for 24 hours
- [ ] Deploy to production
- [ ] Monitor for 48 hours

### v2.0 → v2.2 Checklist

- [ ] Update `requirements.txt` with v2.2 dependencies
- [ ] Run `pip install -r requirements.txt`
- [ ] Update imports to use `enrich_v2_2`
- [ ] Replace `final.invoked` → `final.primary`
- [ ] Replace `final.expressed` → `final.secondary`
- [ ] Replace `final.valence` → `final.emotion_valence`
- [ ] Handle new `final.event_valence` field
- [ ] Update database schema (ALTER TABLE statements)
- [ ] Backfill `event_valence` for old records (optional)
- [ ] Update API contracts (OpenAPI spec)
- [ ] Update API response mapping
- [ ] Run unit tests: `pytest tests/ -v`
- [ ] Run Golden Set: `python tests/test_golden_set.py`
- [ ] Run regression tests
- [ ] Deploy to staging
- [ ] Validate in staging for 24 hours
- [ ] Run performance benchmarks
- [ ] Deploy to production
- [ ] Monitor for 72 hours

---

## Timeline

**Recommended Migration Timeline:**

**Week 1: Preparation**
- Day 1-2: Review migration guide
- Day 3-4: Update dependencies, run tests locally
- Day 5: Deploy to staging

**Week 2: Staging Validation**
- Day 1-5: Test in staging, validate results
- Day 6-7: Fix any issues

**Week 3: Production Rollout**
- Day 1: Deploy to production (5% traffic)
- Day 2-3: Increase to 50% traffic
- Day 4-5: Increase to 100% traffic
- Day 6-7: Monitor and optimize

**Week 4: Cleanup**
- Day 1-3: Decommission v2.0/v2.1 (if desired)
- Day 4-5: Update documentation
- Day 6-7: Post-migration review

---

## Conclusion

**v2.2 is a significant upgrade** with powerful new features:
- Tertiary emotions for nuanced analysis
- Neutral detection for better accuracy
- Graded negation and litotes for language understanding
- Confidence calibration for reliable predictions
- Observability for production monitoring

**Migration is straightforward:**
- v2.1 → v2.2: Backward compatible, optional features
- v2.0 → v2.2: Schema changes, but clear migration path

**Follow this guide step-by-step**, test thoroughly, and you'll be running v2.2 successfully!

For questions or issues, reach out via GitHub Issues or Slack (#enrichment-worker).

**Happy enriching! 🚀**
