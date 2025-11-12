# Enrichment Pipeline v2.2 - API Contract

## Overview

This document defines the API contract for the Leo Enrichment Pipeline v2.2. All fields, types, and constraints are specified to ensure backward compatibility and consistent integration.

**API Version:** v2.2  
**Last Updated:** 2025-01-20  
**Backward Compatible With:** v2.0, v2.1

---

## Enrichment Function Signature

### `enrich_v2_2()`

**Purpose:** Main enrichment function that processes normalized text and returns comprehensive emotional analysis.

```python
from src.enrich.pipeline_v2_2 import enrich_v2_2

def enrich_v2_2(
    text: str,
    user_history: List[Dict] = [],
    include_tertiary: bool = True,
    include_neutral: bool = True,
    apply_calibration: bool = True,
    calibration_method: str = 'temperature_scaling',
    enable_observability: bool = True,
    request_id: Optional[str] = None
) -> EnrichmentResult:
    """
    Enrich normalized reflection text with v2.2 pipeline.
    
    Args:
        text: Normalized reflection text (1-500 chars)
        user_history: List of past reflections for temporal analytics (max 90)
        include_tertiary: Whether to include tertiary emotion (197 fine-grain states)
        include_neutral: Whether to detect neutral emotions
        apply_calibration: Whether to apply confidence calibration
        calibration_method: 'temperature_scaling' | 'platt_scaling' | 'isotonic_regression'
        enable_observability: Whether to enable logging and metrics
        request_id: Optional request ID for tracing
        
    Returns:
        EnrichmentResult: Complete enrichment result with emotions, valence, domain, etc.
        
    Raises:
        ValueError: If text is empty or > 500 chars
        ValidationError: If user_history format is invalid
    """
```

---

## EnrichmentResult Schema

### Complete Schema

```typescript
interface EnrichmentResult {
  // Identity
  rid: string;                    // Reflection ID, format: "refl_{ulid}"
  sid: string;                    // Session ID, format: "sess_{ulid}"
  timestamp: string;              // ISO 8601 timestamp
  timezone_used: string;          // Timezone for circadian analysis
  normalized_text: string;        // Input text (PII-masked if observability enabled)
  
  // Core Emotions (v2.2)
  final: {
    primary: PrimaryEmotion;              // One of 6 primary emotions
    secondary: SecondaryEmotion | null;   // One of 36 secondary emotions
    tertiary: TertiaryEmotion | null;     // One of 197 tertiary emotions (if include_tertiary=true)
    
    // Valence & Arousal
    emotion_valence: number;      // [0.0, 1.0] - How positive the emotion is
    event_valence: number;        // [0.0, 1.0] - How positive the event is
    arousal: number;              // [0.0, 1.0] - Activation/energy level
    
    // Contextual Dimensions
    domain: Domain;               // Life domain: Self | Work | Relationship | Health | Finance | Life
    control: Control;             // High | Low
    polarity: Polarity;           // Positive | Negative
    
    // Neutral Detection (v2.2)
    is_emotion_neutral: boolean;  // True if emotion is truly neutral (not Peaceful/Calm)
    is_event_neutral: boolean;    // True if event is neutral
    
    // Confidence
    confidence: number;           // [0.0, 1.0] - Overall prediction confidence
    
    // Flags (v2.2)
    flags: {
      has_negation: boolean;          // Negation detected ("not happy")
      negation_strength: number;      // [0.0, 1.0] - Strength of negation
      is_litotes: boolean;            // Litotes detected ("not bad" → positive)
      has_profanity: boolean;         // Profanity detected
      has_sarcasm: boolean;           // Sarcasm detected
      sarcasm_strength: number;       // [0.0, 1.0] - Strength of sarcasm
    };
  };
  
  // Congruence
  congruence: number;             // [0.0, 1.0] - Emotion-event alignment
  
  // Temporal Analytics
  temporal: {
    ema: {
      valence_1d: number;         // 1-day EMA of valence
      valence_7d: number;         // 7-day EMA of valence
      valence_28d: number;        // 28-day EMA of valence
      arousal_1d: number;
      arousal_7d: number;
      arousal_28d: number;
    };
    zscore: {
      valence: number;            // Z-score of current valence vs. history
      arousal: number;
      control: number;
    };
    wow_change: {
      valence: number;            // Week-over-week change
      arousal: number;
    };
    circadian: {
      hour_of_day: number;        // 0-23
      is_sleep_adjacent: boolean; // Within 2 hours of typical sleep time
      time_of_day_label: string;  // "morning" | "afternoon" | "evening" | "night"
    };
    streaks: {
      positive_valence_days: number;
      negative_valence_days: number;
      high_arousal_days: number;
      low_arousal_days: number;
    };
    last_marks: {
      last_positive_date: string | null;
      last_negative_date: string | null;
      days_since_positive: number | null;
      days_since_negative: number | null;
    };
  };
  
  // Recursion (Thread Linking)
  recursion: {
    is_recursive: boolean;
    parent_rid: string | null;
    similarity_score: number;     // [0.0, 1.0]
    thread_depth: number;         // How many levels deep in thread
  };
  
  // Comparator (Event Norms)
  comparator: {
    event_class: string;          // e.g., "work_stress", "relationship_conflict"
    norm_valence: number;         // Typical valence for this event class
    norm_arousal: number;
    deviation_valence: number;    // How much user deviates from norm
    deviation_arousal: number;
    percentile: number;           // [0.0, 1.0] - User's position in distribution
  };
  
  // Willingness to Express
  willingness: {
    score: number;                // [0.0, 1.0] - Overall willingness
    inhibition_markers: number;   // Count of inhibition markers ("kind of", "maybe")
    amplification_markers: number;// Count of amplification markers ("very", "extremely")
    linguistic_cues: string[];    // List of detected cues
  };
  
  // Latent State
  state: {
    ema_state: number;            // [-1.0, 1.0] - EMA-based state estimate
    state_label: string;          // "depleted" | "neutral" | "energized"
    state_stability: number;      // [0.0, 1.0] - How stable the state is
  };
  
  // Input Quality
  quality: {
    char_length: number;
    word_count: number;
    sentence_count: number;
    avg_word_length: number;
    is_too_short: boolean;        // < 10 chars
    is_too_long: boolean;         // > 500 chars
    has_punctuation: boolean;
    quality_score: number;        // [0.0, 1.0]
  };
  
  // Risk Signals (Weak)
  risk_signals_weak: string[];    // e.g., ["anergy", "persistent_irritation"]
  
  // Calibration (v2.2)
  calibration: {
    method: string;               // "temperature_scaling" | "platt_scaling" | "isotonic_regression"
    pre_calibration_confidence: number;  // Raw confidence before calibration
    post_calibration_confidence: number; // Calibrated confidence
    ece: number;                  // Expected Calibration Error [0.0, 1.0]
    temperature: number | null;   // Temperature parameter (if temperature_scaling)
  };
  
  // Observability (v2.2)
  observability: {
    request_id: string;           // Unique request ID for tracing
    latency_ms: number;           // Total enrichment latency
    pii_masked: boolean;          // Whether PII was masked in logs
    feature_flags: {
      neutral_detection: boolean;
      tertiary_emotions: boolean;
      confidence_calibration: boolean;
      sarcasm_detection: boolean;
      profanity_coupling: boolean;
    };
    pipeline_version: string;     // "v2.2"
  };
  
  // Provenance
  provenance: {
    enriched_at: string;          // ISO 8601 timestamp of enrichment
    enrichment_version: string;   // "v2.2"
    ollama_model: string;         // "phi3:latest"
    pipeline_stages: string[];    // List of stages executed
  };
  
  // Metadata
  meta: {
    worker_id: string;            // Worker instance ID
    processing_time_ms: number;   // Total processing time
    cache_hit: boolean;           // Whether result was cached
  };
}
```

---

## Emotion Taxonomies

### Primary Emotions (6 total)

```typescript
type PrimaryEmotion = 
  | "Happy"
  | "Sad"
  | "Angry"
  | "Fearful"
  | "Surprised"
  | "Disgusted"
  | "Neutral";  // Only if include_neutral=true
```

**Constraints:**
- Always present (never null)
- Exactly one primary emotion per reflection
- "Neutral" only returned if `include_neutral=true` AND emotion_presence="none"

### Secondary Emotions (36 total)

```typescript
type SecondaryEmotion = 
  // Happy derivatives
  | "Content" | "Peaceful" | "Grateful" | "Excited" | "Proud" | "Hopeful"
  
  // Sad derivatives
  | "Melancholic" | "Lonely" | "Disappointed" | "Regretful" | "Hopeless" | "Grieving"
  
  // Angry derivatives
  | "Frustrated" | "Irritated" | "Resentful" | "Bitter" | "Furious" | "Indignant"
  
  // Fearful derivatives
  | "Anxious" | "Worried" | "Insecure" | "Overwhelmed" | "Panicked" | "Vulnerable"
  
  // Surprised derivatives
  | "Amazed" | "Confused" | "Startled" | "Curious" | "Shocked" | "Bewildered"
  
  // Disgusted derivatives
  | "Contemptuous" | "Revolted" | "Uncomfortable" | "Ashamed" | "Guilty" | "Embarrassed";
```

**Constraints:**
- Optional (can be null)
- Must align with primary emotion (e.g., "Melancholic" only if primary="Sad")
- Normalized to canonical 36 secondary emotions

### Tertiary Emotions (197 total)

```typescript
type TertiaryEmotion = string;  // One of 197 fine-grain emotions
```

**Examples:**
- "Wistful" (Sad → Melancholic → Wistful)
- "Euphoric" (Happy → Excited → Euphoric)
- "Exasperated" (Angry → Frustrated → Exasperated)

**Constraints:**
- Optional (only if `include_tertiary=true`)
- Must align with secondary emotion
- See `src/enrich/tertiary_emotions.py` for full list

### Domains (6 total)

```typescript
type Domain = 
  | "Self"           // Personal growth, identity, self-reflection
  | "Work"           // Career, productivity, professional life
  | "Relationship"   // Romantic, family, friendships
  | "Health"         // Physical health, fitness, wellness
  | "Finance"        // Money, financial stress, economic concerns
  | "Life";          // General life, existential, ambiguous
```

**Constraints:**
- Always present (never null)
- Exactly one domain per reflection
- "Life" is default for ambiguous cases

### Control (2 levels)

```typescript
type Control = "High" | "Low";
```

**Definition:**
- **High**: Sense of agency, autonomy, empowerment
- **Low**: Helplessness, lack of control, passivity

### Polarity (2 levels)

```typescript
type Polarity = "Positive" | "Negative";
```

**Definition:**
- **Positive**: Desirable, pleasant, constructive
- **Negative**: Undesirable, unpleasant, destructive

---

## Validation Rules

### Input Validation

**Text (required):**
- Type: `string`
- Min length: 1 character
- Max length: 500 characters
- Must be normalized (lowercase, no extra whitespace)

**User History (optional):**
- Type: `List[Dict]`
- Max length: 90 reflections
- Each reflection must have: `rid`, `timestamp`, `valence`, `arousal`

**Include Tertiary (optional):**
- Type: `boolean`
- Default: `true`

**Include Neutral (optional):**
- Type: `boolean`
- Default: `true`

**Apply Calibration (optional):**
- Type: `boolean`
- Default: `true`

**Calibration Method (optional):**
- Type: `string`
- Allowed values: `"temperature_scaling"`, `"platt_scaling"`, `"isotonic_regression"`
- Default: `"temperature_scaling"`

### Output Validation

**Valence & Arousal:**
- Type: `number`
- Range: `[0.0, 1.0]`
- Precision: 2 decimal places

**Confidence:**
- Type: `number`
- Range: `[0.0, 1.0]`
- Target: > 0.5 (after calibration)
- ECE: ≤ 0.08

**Timestamps:**
- Format: ISO 8601 (`2025-01-20T12:00:00Z`)
- Timezone: UTC or specified timezone

**IDs:**
- Format: `{type}_{ulid}`
- Examples: `refl_01HWXYZ`, `sess_01HWXYZ`

---

## Backward Compatibility

### v2.1 → v2.2

**Guaranteed Compatibility:**
- All v2.1 fields are present in v2.2
- v2.1 clients can safely ignore new v2.2 fields
- `enrich_v2_1()` function still available (deprecated)

**New Fields in v2.2:**
- `final.tertiary` (optional, null if `include_tertiary=false`)
- `final.is_emotion_neutral`, `final.is_event_neutral`
- `final.flags.has_negation`, `final.flags.negation_strength`, `final.flags.is_litotes`
- `calibration.*` (full calibration object)
- `observability.*` (full observability object)

**Deprecated in v2.2:**
- `final.invoked`, `final.expressed` (replaced by `primary`, `secondary`, `tertiary`)
- `final.valence` (replaced by `emotion_valence`, `event_valence`)

**Migration Path:**
```python
# v2.1 code (still works)
from src.enrich.pipeline_v2_1 import enrich_v2_1
result = enrich_v2_1(text)

# v2.2 code (recommended)
from src.enrich.pipeline_v2_2 import enrich_v2_2
result = enrich_v2_2(text, include_tertiary=True, include_neutral=True)

# Access new fields
if result.final.is_emotion_neutral:
    print("Truly neutral affect detected")
```

### v2.0 → v2.2

**Breaking Changes:**
- `emotion_valence` and `event_valence` are now separate (was single `valence`)
- `primary`, `secondary` now use canonical taxonomy (not free-text)

**Migration Required:**
- Update clients to handle `emotion_valence` + `event_valence` separately
- Map old emotion names to canonical taxonomy (see `MIGRATION_v2.0_to_v2.2.md`)

---

## Error Handling

### Error Codes

```typescript
enum EnrichmentErrorCode {
  INVALID_INPUT = "INVALID_INPUT",           // Text is empty or > 500 chars
  VALIDATION_ERROR = "VALIDATION_ERROR",     // Schema validation failed
  OLLAMA_TIMEOUT = "OLLAMA_TIMEOUT",         // Ollama request timed out
  OLLAMA_ERROR = "OLLAMA_ERROR",             // Ollama returned error
  REDIS_ERROR = "REDIS_ERROR",               // Redis connection failed
  CALIBRATION_ERROR = "CALIBRATION_ERROR",   // Confidence calibration failed
  INTERNAL_ERROR = "INTERNAL_ERROR"          // Unexpected error
}
```

### Error Response

```typescript
interface EnrichmentError {
  error: {
    code: EnrichmentErrorCode;
    message: string;
    details: Record<string, any>;
    timestamp: string;
    request_id: string;
  };
}
```

### Example Error Responses

**Invalid Input:**
```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Text exceeds maximum length of 500 characters",
    "details": {
      "text_length": 612,
      "max_length": 500
    },
    "timestamp": "2025-01-20T12:00:00Z",
    "request_id": "req_abc123"
  }
}
```

**Ollama Timeout:**
```json
{
  "error": {
    "code": "OLLAMA_TIMEOUT",
    "message": "Ollama request timed out after 30 seconds",
    "details": {
      "timeout_ms": 30000,
      "model": "phi3:latest"
    },
    "timestamp": "2025-01-20T12:00:00Z",
    "request_id": "req_abc123"
  }
}
```

---

## Performance Guarantees

### Latency Targets

**Without User History:**
- P50: < 50ms
- P95: < 100ms
- P99: < 200ms

**With User History (90 reflections):**
- P50: < 80ms
- P95: < 150ms
- P99: < 300ms

### Throughput Targets

- **Single worker**: > 10 reflections/sec
- **Horizontal scaling**: Linear up to 10 workers

### Availability Targets

- **Uptime**: ≥ 99.5%
- **Success rate**: > 99%

---

## Quality Guarantees

### Accuracy Targets

**Golden Set Performance:**
- Primary Emotion F1: ≥ 0.78
- Secondary Emotion F1: ≥ 0.70
- Tertiary Emotion F1: ≥ 0.60
- Domain Accuracy: ≥ 0.85

**Calibration Quality:**
- Expected Calibration Error (ECE): ≤ 0.08
- Confidence correlation with accuracy: > 0.7

### Prediction Rates

**Expected Distributions:**
- Neutral rate: 5-10% (when `include_neutral=true`)
- Negation rate: 15-20%
- Litotes rate: 2-5%
- Profanity rate: 5-8%
- Sarcasm rate: 3-6%

---

## Versioning & Deprecation Policy

### Semantic Versioning

**Format:** `v{major}.{minor}.{patch}`

- **Major**: Breaking changes (e.g., schema changes)
- **Minor**: New features, backward compatible (e.g., v2.1 → v2.2)
- **Patch**: Bug fixes, no API changes

### Deprecation Timeline

**Deprecation Notice:**
- Announced 90 days before deprecation
- Documented in `CHANGELOG.md`
- Warning logs added to deprecated functions

**Support Policy:**
- Current version (v2.2): Fully supported
- Previous minor version (v2.1): Supported for 180 days
- Previous major version (v1.x): Deprecated, security fixes only

**Migration Support:**
- Migration guides provided (see `MIGRATION_v2.0_to_v2.2.md`)
- Compatibility shims available for 180 days
- Automated migration scripts where possible

---

## Testing & Validation

### Golden Set

**Purpose:** Standardized test set for accuracy validation

**Format:**
```json
{
  "id": "example_001",
  "text": "I'm feeling anxious about tomorrow's presentation",
  "expected": {
    "primary": "Fearful",
    "secondary": "Anxious",
    "tertiary": "Nervous",
    "emotion_valence": 0.3,
    "event_valence": 0.25,
    "arousal": 0.75,
    "domain": "Work",
    "control": "Low",
    "polarity": "Negative"
  }
}
```

**Current Size:** 32 examples (target: 200+)

### Test Coverage

**Unit Tests:**
- `test_observability.py`: 9 tests (PII masking, logging, metrics)
- `test_calibration.py`: 10 tests (3 calibration methods, ECE)
- `test_negation.py`: Negation & litotes detection
- `test_neutral.py`: Neutral emotion detection
- `test_pipeline_v2_2.py`: End-to-end integration

**Coverage Target:** > 85%

### Contract Testing

**Pact Tests:**
- Schema validation for all output fields
- Type checking for all parameters
- Range validation for numeric fields

**Regression Tests:**
- Golden Set runs on every commit
- Performance benchmarks on every release
- Backward compatibility tests for deprecated APIs

---

## API Usage Examples

### Basic Usage

```python
from src.enrich.pipeline_v2_2 import enrich_v2_2

# Simple enrichment
text = "I'm feeling tired today"
result = enrich_v2_2(text)

print(result.final.primary)        # "Sad"
print(result.final.secondary)      # "Melancholic"
print(result.final.emotion_valence) # 0.35
```

### With User History

```python
user_history = [
    {"rid": "refl_001", "timestamp": "2025-01-19T12:00:00Z", "valence": 0.6, "arousal": 0.5},
    {"rid": "refl_002", "timestamp": "2025-01-19T18:00:00Z", "valence": 0.4, "arousal": 0.7},
]

result = enrich_v2_2(text, user_history=user_history)

print(result.temporal.ema.valence_1d)  # 0.48 (EMA of recent valence)
print(result.temporal.zscore.valence)  # -0.5 (below user's baseline)
```

### With Custom Configuration

```python
result = enrich_v2_2(
    text=text,
    user_history=user_history,
    include_tertiary=True,
    include_neutral=True,
    apply_calibration=True,
    calibration_method='platt_scaling',  # Use Platt scaling instead of temperature
    enable_observability=True,
    request_id='req_custom_123'
)

print(result.final.tertiary)                      # "Wistful"
print(result.calibration.method)                  # "platt_scaling"
print(result.calibration.post_calibration_confidence)  # 0.74
print(result.observability.request_id)            # "req_custom_123"
```

### Batch Processing

```python
texts = ["I'm happy", "I'm sad", "I'm angry"]
results = [enrich_v2_2(text) for text in texts]

# Aggregate results
primaries = [r.final.primary for r in results]
print(primaries)  # ["Happy", "Sad", "Angry"]
```

---

## OpenAPI Specification

For machine-readable API contract, see `openapi_v2.2.yaml` (TODO: generate from schema).

---

## Change Log

### v2.2 (2025-01-20)

**Added:**
- Tertiary emotions (197 fine-grain states)
- Neutral emotion detection (`is_emotion_neutral`, `is_event_neutral`)
- Graded negation (`has_negation`, `negation_strength`)
- Litotes detection (`is_litotes`)
- Profanity coupling (`has_profanity`)
- Confidence calibration (3 methods: temperature, Platt, isotonic)
- Observability infrastructure (structured logging, PII masking, metrics)
- Feature flags for A/B testing

**Changed:**
- Emotion taxonomy now canonical (36 secondary, 197 tertiary)
- Valence split into `emotion_valence` and `event_valence`

**Deprecated:**
- `final.invoked`, `final.expressed` (use `primary`, `secondary`, `tertiary`)
- `final.valence` (use `emotion_valence`, `event_valence`)

### v2.1 (2024-12-15)

**Added:**
- Dual valence (emotion + event)
- Sarcasm detection
- Profanity-Angry coupling

### v2.0 (2024-11-01)

**Added:**
- 6 primary emotions
- 36 secondary emotions
- Domain taxonomy (6 domains)
- Control & polarity dimensions

---

## License

MIT License - See LICENSE file for details.

---

## Support

For questions or issues with this API contract:
- **Documentation:** See README.md, RUNBOOK.md, MIGRATION_v2.0_to_v2.2.md
- **Issues:** GitHub Issues
- **Email:** devops@example.com
- **Slack:** #enrichment-worker
