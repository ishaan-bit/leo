# Baseline Tuning Report

**Pass Rate**: 66.0%
**Avg Score**: 0.635
**Passes**: 33/50

## Score Distribution

| Range | Count |
|-------|-------|
| 0.0-0.2 | 1 |
| 0.2-0.4 | 6 |
| 0.4-0.6 | 10 |
| 0.6-0.8 | 17 |
| 0.8-1.0 | 16 |

## Best Config

```json
{
  "fatigue_weight": 1.0,
  "irritation_weight": 1.2,
  "progress_weight": 0.9,
  "joy_weight": 1.1,
  "anxiety_weight": 1.3,
  "hedge_penalty": 0.15,
  "intensifier_boost": 0.2,
  "negation_flip": 0.4,
  "fatigue_threshold": 0.25,
  "irritation_threshold": 0.3,
  "anxiety_threshold": 0.35,
  "joy_threshold": 0.6,
  "baseline_valence": 0.5,
  "baseline_arousal": 0.5,
  "min_valence": 0.05,
  "max_valence": 0.95,
  "min_arousal": 0.05,
  "max_arousal": 0.95
}
```

## Sample Results (First 5)

### 1. ex_001

**Text**: exhausted after long day, nothing went right

**Expected**: {
  "events": [
    "fatigue",
    "frustration"
  ],
  "wheel_primary": "sadness",
  "valence_range": [
    0.15,
    0.35
  ],
  "arousal_range": [
    0.25,
    0.45
  ]
}

**Got Events**: ['fatigue']
**Got Wheel**: sadness
**Got Valence**: 0.2
**Got Arousal**: 0.35

**Score**: 0.867 (events: 0.267, wheel: 0.200, valence: 0.200, arousal: 0.200)

### 2. ex_002

**Text**: so angry, people keep ignoring my requests

**Expected**: {
  "events": [
    "anger",
    "irritation"
  ],
  "wheel_primary": "anger",
  "valence_range": [
    0.2,
    0.4
  ],
  "arousal_range": [
    0.65,
    0.85
  ]
}

**Got Events**: ['anger', 'irritation', 'anxiety']
**Got Wheel**: anger
**Got Valence**: 0.07
**Got Arousal**: 0.95

**Score**: 0.520 (events: 0.320, wheel: 0.200, valence: 0.000, arousal: 0.000)

### 3. ex_003

**Text**: feeling stuck, made no progress on the project

**Expected**: {
  "events": [
    "low_progress",
    "frustration"
  ],
  "wheel_primary": "sadness",
  "valence_range": [
    0.25,
    0.45
  ],
  "arousal_range": [
    0.35,
    0.55
  ]
}

**Got Events**: ['progress', 'low_progress']
**Got Wheel**: joy
**Got Valence**: 0.5
**Got Arousal**: 0.72

**Score**: 0.200 (events: 0.200, wheel: 0.000, valence: 0.000, arousal: 0.000)

### 4. ex_004

**Text**: worried about tomorrow's presentation, can't sleep

**Expected**: {
  "events": [
    "anxiety",
    "anticipation"
  ],
  "wheel_primary": "fear",
  "valence_range": [
    0.25,
    0.45
  ],
  "arousal_range": [
    0.7,
    0.9
  ]
}

**Got Events**: ['irritation', 'anxiety']
**Got Wheel**: anger
**Got Valence**: 0.21
**Got Arousal**: 0.95

**Score**: 0.200 (events: 0.200, wheel: 0.000, valence: 0.000, arousal: 0.000)

### 5. ex_005

**Text**: really happy with how the meeting went today

**Expected**: {
  "events": [
    "accomplishment",
    "joy"
  ],
  "wheel_primary": "joy",
  "valence_range": [
    0.7,
    0.9
  ],
  "arousal_range": [
    0.55,
    0.75
  ]
}

**Got Events**: ['joy']
**Got Wheel**: joy
**Got Valence**: 0.9
**Got Arousal**: 0.76

**Score**: 0.667 (events: 0.267, wheel: 0.200, valence: 0.200, arousal: 0.000)

