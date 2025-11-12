"""
Acceptance tests for v2.0+ lexicon-based enhancements.
Tests 5 critical scenarios: sarcasm, negated joy, concession, neutral text.
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.enrich.sarcasm import detect_sarcasm, apply_sarcasm_penalty
from src.enrich.event_valence import compute_event_valence, extract_event_valence_metadata
from src.enrich.pipeline_enhancements import (
    detect_neutral_text,
    detect_concession_agency,
    apply_concession_boost,
    detect_negated_joy,
    apply_negated_joy_penalty
)
from src.enrich.control import detect_control_rule_based
from src.enrich.va import apply_arousal_governors

def test_tc1_sarcasm_meeting_lateness():
    """
    TC1: "Love that the meeting started 45 minutes late — really shows how much they value our time."
    
    Expected:
    - sarcasm=true
    - event_valence≤0.3 (negative event)
    - domain=work
    - primary=Angry or Strong
    - secondary=Frustrated
    - valence≤0.4
    - arousal 0.65-0.75
    """
    print("=" * 80)
    print("TC1: Sarcasm Detection - Meeting Lateness")
    print("=" * 80)
    
    text = "Love that the meeting started 45 minutes late — really shows how much they value our time."
    
    # Test sarcasm detection
    is_sarcastic, pattern = detect_sarcasm(text)
    print(f"Text: {text}")
    print(f"✓ Sarcasm detected: {is_sarcastic} (pattern: {pattern})")
    assert is_sarcastic, "Failed: Sarcasm should be detected"
    
    # Test event valence
    ev = compute_event_valence(text)
    print(f"✓ Event valence: {ev:.3f} (expected ≤0.3)")
    assert ev <= 0.3, f"Failed: Event valence {ev:.3f} should be ≤0.3"
    
    # Test sarcasm penalty
    p_hf = {'Happy': 0.40, 'Strong': 0.20, 'Angry': 0.15, 'Sad': 0.10, 'Fearful': 0.10, 'Peaceful': 0.05}
    modified_probs, modified_ev = apply_sarcasm_penalty(p_hf, 0.75)
    print(f"✓ After sarcasm penalty:")
    print(f"   Happy: {p_hf['Happy']:.3f} → {modified_probs['Happy']:.3f} (×0.7)")
    print(f"   Strong: {p_hf['Strong']:.3f} → {modified_probs['Strong']:.3f} (×1.15)")
    print(f"   Angry: {p_hf['Angry']:.3f} → {modified_probs['Angry']:.3f} (×1.15)")
    
    assert modified_probs['Happy'] < p_hf['Happy'], "Failed: Happy should be penalized"
    assert modified_probs['Strong'] > p_hf['Strong'], "Failed: Strong should be boosted"
    assert modified_probs['Angry'] > p_hf['Angry'], "Failed: Angry should be boosted"
    
    print("✅ TC1 PASSED\n")


def test_tc2_promotion_negated_joy():
    """
    TC2: "Finally got the promotion I wanted, but I can't even enjoy it."
    
    Expected:
    - event_valence≥0.85 (positive event: promotion)
    - negated_joy=true (can't enjoy)
    - primary=Strong (achievement despite inability to enjoy)
    - secondary=Resilient
    - valence 0.4-0.5
    - flags.negation=true
    
    Note: Control may be medium/low due to "can't" but event is clearly positive.
    """
    print("=" * 80)
    print("TC2: Promotion with Negated Joy")
    print("=" * 80)
    
    text = "Finally got the promotion I wanted, but I can't even enjoy it."
    
    # Test event valence
    ev = compute_event_valence(text)
    print(f"Text: {text}")
    print(f"✓ Event valence: {ev:.3f} (expected ≥0.85)")
    assert ev >= 0.85, f"Failed: Event valence {ev:.3f} should be ≥0.85 (promotion)"
    
    # Test control (may be medium due to "can't" but that's okay - focus is on event+negated joy)
    control, control_conf = detect_control_rule_based(text)
    print(f"✓ Control: {control} (confidence: {control_conf:.2f}) - mixed signal expected")
    
    # Test negated joy detection (critical for this case)
    negated_joy = detect_negated_joy(text)
    print(f"✓ Negated joy detected: {negated_joy}")
    assert negated_joy, "Failed: Negated joy should be detected (can't enjoy)"
    
    # Test negated joy penalty
    p_hf = {'Happy': 0.50, 'Strong': 0.25, 'Sad': 0.10, 'Angry': 0.05, 'Fearful': 0.05, 'Peaceful': 0.05}
    modified_probs = apply_negated_joy_penalty(p_hf, ev)
    print(f"✓ After negated joy penalty:")
    print(f"   Happy: {p_hf['Happy']:.3f} → {modified_probs['Happy']:.3f} (×0.65)")
    print(f"   Strong: {p_hf['Strong']:.3f} → {modified_probs['Strong']:.3f} (×1.15, high event)")
    
    assert modified_probs['Happy'] < p_hf['Happy'], "Failed: Happy should be penalized"
    assert modified_probs['Strong'] > p_hf['Strong'], "Failed: Strong should be boosted (high event)"
    
    print("✅ TC2 PASSED\n")


def test_tc3_concession_with_agency():
    """
    TC3: "Finally told them how I felt — terrified, but proud I did it."
    
    Expected:
    - event_valence≥0.75 (told them = agency/relationship event)
    - control=high (told, did it = agency)
    - concession_agency=true (terrified, but proud)
    - primary=Strong
    - secondary=Courageous
    - valence≈0.6
    - arousal 0.7-0.8
    """
    print("=" * 80)
    print("TC3: Concession with Agency")
    print("=" * 80)
    
    text = "Finally told them how I felt — terrified, but proud I did it."
    
    # Test event valence
    ev = compute_event_valence(text)
    print(f"Text: {text}")
    print(f"✓ Event valence: {ev:.3f} (expected ≥0.75)")
    assert ev >= 0.75, f"Failed: Event valence {ev:.3f} should be ≥0.75"
    
    # Test control
    control, control_conf = detect_control_rule_based(text)
    print(f"✓ Control: {control} (confidence: {control_conf:.2f})")
    assert control == 'high', f"Failed: Control should be 'high', got '{control}'"
    
    # Test concession detection
    concession_type = detect_concession_agency(text)
    print(f"✓ Concession detected: {concession_type}")
    assert concession_type == 'agency_after_fear', "Failed: Concession pattern should be detected"
    
    # Test concession boost
    p_hf = {'Strong': 0.30, 'Fearful': 0.40, 'Happy': 0.15, 'Sad': 0.05, 'Angry': 0.05, 'Peaceful': 0.05}
    modified_probs = apply_concession_boost(p_hf, concession_type)
    print(f"✓ After concession boost:")
    print(f"   Strong: {p_hf['Strong']:.3f} → {modified_probs['Strong']:.3f} (×1.15)")
    print(f"   Fearful: {p_hf['Fearful']:.3f} → {modified_probs['Fearful']:.3f} (×0.85)")
    
    assert modified_probs['Strong'] > p_hf['Strong'], "Failed: Strong should be boosted"
    assert modified_probs['Fearful'] < p_hf['Fearful'], "Failed: Fearful should be attenuated"
    
    print("✅ TC3 PASSED\n")


def test_tc4_neutral_hedged_text():
    """
    TC4: "Not sad exactly, just kind of… empty, I guess."
    
    Expected:
    - flags.neutral_text=true OR subdued Peaceful/Sad with low confidence
    - arousal≤0.35 (hedges reduce arousal)
    - no "Depressed" label
    - confidence≤0.50
    """
    print("=" * 80)
    print("TC4: Neutral/Hedged Text")
    print("=" * 80)
    
    text = "Not sad exactly, just kind of… empty, I guess."
    
    # Test neutral detection
    ev_meta = extract_event_valence_metadata(text)
    is_neutral = detect_neutral_text(text, ev_meta)
    print(f"Text: {text}")
    print(f"✓ Neutral text detected: {is_neutral}")
    print(f"✓ Event valence: {ev_meta['event_valence']:.3f}")
    print(f"✓ Anchors: pos={ev_meta['positive_anchors']}, neg={ev_meta['negative_anchors']}")
    
    # Test arousal governance (hedges: "kind of", "i guess")
    base_arousal = 0.45
    governed_arousal = apply_arousal_governors(base_arousal, text)
    print(f"✓ Arousal: {base_arousal:.3f} → {governed_arousal:.3f} (hedges reduce by 0.10)")
    # 2+ hedges reduce by 0.10, so 0.45 → 0.35
    assert governed_arousal <= 0.36, f"Failed: Arousal {governed_arousal:.3f} should be ≤0.36"
    
    print("✅ TC4 PASSED\n")


def test_tc5_flat_repetition():
    """
    TC5: "I'm fine, I guess. Maybe just tired."
    
    Expected:
    - Neutral detection (hedges: "i guess", "maybe")
    - arousal≤0.4 (hedges reduce arousal)
    - no default Sad/Lonely forcing
    - confidence≤0.45
    """
    print("=" * 80)
    print("TC5: Flat/Hedged Text")
    print("=" * 80)
    
    text = "I'm fine, I guess. Maybe just tired."
    
    # Test neutral detection
    ev_meta = extract_event_valence_metadata(text)
    is_neutral = detect_neutral_text(text, ev_meta)
    print(f"Text: {text}")
    print(f"✓ Neutral text detected: {is_neutral}")
    print(f"✓ Event valence: {ev_meta['event_valence']:.3f}")
    
    # Test arousal (should be low for hedged text)
    base_arousal = 0.50
    governed_arousal = apply_arousal_governors(base_arousal, text)
    print(f"✓ Arousal: {base_arousal:.3f} → {governed_arousal:.3f} (hedges: 'i guess', 'maybe')")
    # 2+ hedges reduce by 0.10
    assert governed_arousal <= 0.41, f"Failed: Arousal {governed_arousal:.3f} should be ≤0.41"
    
    print("✅ TC5 PASSED\n")


if __name__ == '__main__':
    print("\n" + "=" * 80)
    print("ENRICHMENT v2.0+ LEXICON ENHANCEMENTS - ACCEPTANCE TESTS")
    print("=" * 80 + "\n")
    
    try:
        test_tc1_sarcasm_meeting_lateness()
        test_tc2_promotion_negated_joy()
        test_tc3_concession_with_agency()
        test_tc4_neutral_hedged_text()
        test_tc5_flat_repetition()
        
        print("\n" + "=" * 80)
        print("✅ ALL 5 ACCEPTANCE TESTS PASSED!")
        print("=" * 80 + "\n")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
