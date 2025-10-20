"""
Schema Validation Tests
Tests for enriched reflection schema compliance
"""

import json
from typing import Dict


def validate_enriched_schema(enriched: Dict) -> tuple[bool, list[str]]:
    """
    Validate enriched reflection against schema rules
    
    Returns:
        (is_valid, errors)
    """
    errors = []
    
    # Test 1: Reject if expressed is verbatim input
    if enriched.get('final', {}).get('expressed', '').lower().strip() == \
       enriched.get('normalized_text', '').lower().strip():
        errors.append("FAIL: final.expressed equals input text verbatim")
    
    # Test 2: Assert presence of wheel.primary
    wheel = enriched.get('final', {}).get('wheel', {})
    if not wheel or not wheel.get('primary'):
        errors.append("FAIL: final.wheel.primary is missing or null")
    
    # Test 3: Assert wow_change exists and wow is absent
    temporal = enriched.get('temporal', {})
    if 'wow' in temporal:
        errors.append("FAIL: temporal.wow exists (should be temporal.wow_change)")
    if 'wow_change' not in temporal:
        errors.append("FAIL: temporal.wow_change is missing")
    
    # Test 4: Assert willingness coherence rule
    willingness = enriched.get('willingness', {})
    amplification = willingness.get('amplification', 0)
    willingness_to_express = willingness.get('willingness_to_express', 0)
    
    if amplification > 0.5 and willingness_to_express < 0.3:
        errors.append(f"FAIL: willingness coherence violated (amplification={amplification:.2f}, willingness={willingness_to_express:.2f})")
    
    # Test 5: Assert last_marks consistency with streaks
    streaks = temporal.get('streaks', {})
    last_marks = temporal.get('last_marks', {})
    
    if streaks.get('negative_valence_days', 0) >= 1:
        if not last_marks.get('last_negative_at'):
            errors.append("FAIL: negative streak exists but last_marks.last_negative_at is null")
    
    # Additional validations
    
    # Congruence at top level
    if 'congruence' not in enriched:
        errors.append("FAIL: congruence not at top level")
    
    # Provenance structure
    provenance = enriched.get('provenance', {})
    if 'baseline_version' not in provenance:
        errors.append("FAIL: provenance.baseline_version missing")
    if 'ollama_model' not in provenance:
        errors.append("FAIL: provenance.ollama_model missing")
    if 'latency_ms' in provenance:
        errors.append("FAIL: provenance.latency_ms should be in meta.ollama_latency_ms")
    
    # Meta structure
    meta = enriched.get('meta', {})
    if 'mode' not in meta:
        errors.append("FAIL: meta.mode missing")
    if 'blend' not in meta:
        errors.append("FAIL: meta.blend missing")
    if 'revision' not in meta:
        errors.append("FAIL: meta.revision missing")
    if 'created_at' not in meta:
        errors.append("FAIL: meta.created_at missing")
    if 'ollama_latency_ms' not in meta:
        errors.append("FAIL: meta.ollama_latency_ms missing")
    
    # zscore structure
    zscore = temporal.get('zscore', {})
    if 'window_days' not in zscore:
        errors.append("FAIL: temporal.zscore.window_days missing")
    
    is_valid = len(errors) == 0
    
    return is_valid, errors


def test_sample_enriched():
    """Test with a sample enriched object"""
    
    # Valid sample
    valid_enriched = {
        "rid": "refl_test_123",
        "sid": "sess_test",
        "timestamp": "2025-10-20T04:05:22.017Z",
        "timezone_used": "Asia/Kolkata",
        "normalized_text": "very tired and irritated",
        "final": {
            "invoked": "fatigue + frustration",
            "expressed": "irritated / deflated",
            "expressed_text": None,
            "wheel": {"primary": "sadness", "secondary": "anger"},
            "valence": 0.25,
            "arousal": 0.60,
            "confidence": 0.80,
            "events": [{"label": "fatigue", "confidence": 0.90}],
            "warnings": []
        },
        "congruence": 0.80,
        "temporal": {
            "ema": {"v_1d": 0.25, "v_7d": 0.25, "v_28d": 0.25, "a_1d": 0.60, "a_7d": 0.60, "a_28d": 0.60},
            "zscore": {"valence": None, "arousal": None, "window_days": 90},
            "wow_change": {"valence": None, "arousal": None},
            "streaks": {"positive_valence_days": 0, "negative_valence_days": 1},
            "last_marks": {"last_positive_at": None, "last_negative_at": "2025-10-20T04:05:22.017Z", "last_risk_at": None},
            "circadian": {"hour_local": 9.6, "phase": "morning", "sleep_adjacent": False}
        },
        "willingness": {
            "willingness_to_express": 0.55,
            "inhibition": 0.0,
            "amplification": 0.67,
            "dissociation": 0.0,
            "social_desirability": 0.0
        },
        "comparator": {
            "expected": {"invoked": "tired", "expressed": "exhausted", "valence": 0.25, "arousal": 0.30},
            "deviation": {"valence": 0.0, "arousal": 0.30},
            "note": "Fatigue: arousal higher than expected."
        },
        "recursion": {
            "method": "hybrid(semantic+lexical+time)",
            "links": [],
            "thread_summary": "",
            "thread_state": "new"
        },
        "state": {
            "valence_mu": 0.25,
            "arousal_mu": 0.60,
            "energy_mu": 0.425,
            "fatigue_mu": 0.575,
            "sigma": 0.3,
            "confidence": 0.5
        },
        "quality": {"text_len": 24, "uncertainty": 0.20},
        "risk_signals_weak": [],
        "provenance": {
            "baseline_version": "rules@v1",
            "ollama_model": "phi3:latest"
        },
        "meta": {
            "mode": "hybrid-local",
            "blend": 0.35,
            "revision": 1,
            "created_at": "2025-10-20T04:05:23.000Z",
            "ollama_latency_ms": 14803,
            "warnings": []
        }
    }
    
    is_valid, errors = validate_enriched_schema(valid_enriched)
    
    print("=" * 80)
    print("SCHEMA VALIDATION TEST")
    print("=" * 80)
    print()
    
    if is_valid:
        print("✅ PASS: All validations passed!")
    else:
        print("❌ FAIL: Validation errors found:")
        for error in errors:
            print(f"   • {error}")
    
    print()
    
    # Test invalid cases
    print("Testing invalid cases:")
    print()
    
    # Invalid: expressed = input
    invalid_1 = valid_enriched.copy()
    invalid_1['final']['expressed'] = invalid_1['normalized_text']
    is_valid, errors = validate_enriched_schema(invalid_1)
    print(f"1. Expressed = input: {'PASS' if not is_valid else 'FAIL'} ({len(errors)} errors)")
    
    # Invalid: no wheel.primary
    invalid_2 = valid_enriched.copy()
    invalid_2['final']['wheel'] = {'primary': None, 'secondary': None}
    is_valid, errors = validate_enriched_schema(invalid_2)
    print(f"2. No wheel.primary: {'PASS' if not is_valid else 'FAIL'} ({len(errors)} errors)")
    
    # Invalid: wow instead of wow_change
    invalid_3 = valid_enriched.copy()
    invalid_3['temporal']['wow'] = invalid_3['temporal'].pop('wow_change')
    is_valid, errors = validate_enriched_schema(invalid_3)
    print(f"3. wow instead of wow_change: {'PASS' if not is_valid else 'FAIL'} ({len(errors)} errors)")
    
    # Invalid: willingness incoherence
    invalid_4 = valid_enriched.copy()
    invalid_4['willingness']['amplification'] = 0.80
    invalid_4['willingness']['willingness_to_express'] = 0.20
    is_valid, errors = validate_enriched_schema(invalid_4)
    print(f"4. Willingness incoherence: {'PASS' if not is_valid else 'FAIL'} ({len(errors)} errors)")
    
    # Invalid: negative streak but no last_negative_at
    invalid_5 = valid_enriched.copy()
    invalid_5['temporal']['last_marks']['last_negative_at'] = None
    is_valid, errors = validate_enriched_schema(invalid_5)
    print(f"5. Negative streak missing last_negative_at: {'PASS' if not is_valid else 'FAIL'} ({len(errors)} errors)")
    
    print()


if __name__ == '__main__':
    test_sample_enriched()
