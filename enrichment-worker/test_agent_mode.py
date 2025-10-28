"""
Test Agent Mode Scorer - Execute-Once Idempotent Enrichment
=============================================================
Tests the strict enforcement rules from the Agent Mode specification.
"""

import os
import sys
import json
from dotenv import load_dotenv

# Add enrichment-worker to path
sys.path.insert(0, os.path.dirname(__file__))

from src.modules.agent_mode_scorer import AgentModeScorer


def test_agent_mode_scorer():
    """Test Agent Mode Scorer with sample reflections"""
    
    load_dotenv()
    
    print("="*80)
    print("AGENT MODE SCORER TEST")
    print("="*80)
    
    # Initialize scorer
    scorer = AgentModeScorer(
        hf_token=os.getenv('HF_TOKEN'),
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        timezone='Asia/Kolkata'
    )
    
    # Check availability
    if not scorer.is_available():
        print("\n[!] WARNING: Ollama not available - enrichment may fail")
    
    # Test Case 1: "Old playlist while cooking" (nostalgia/longing)
    print("\n" + "="*80)
    print("TEST CASE 1: Old Playlist + Cooking (Expected: Sad → longing → nostalgic)")
    print("="*80)
    
    test1 = {
        'rid': 'test_001',
        'sid': 'user_test',
        'normalized_text': 'Listening to that old playlist while cooking dinner. Steam rises, that chorus drops me in an older kitchen. One song opens a door I painted shut. Company and distance share the counter.',
        'timestamp': '2025-10-28T18:30:00Z',
        'timezone_used': 'Asia/Kolkata'
    }
    
    result1 = scorer.enrich(test1, prev_reflection=None, history=[])
    
    if result1:
        print_result(result1, "Test 1")
        
        # Validate single-token enforcement
        validate_single_tokens(result1, "Test 1")
    else:
        print("[X] Test 1 FAILED - returned None")
    
    # Test Case 2: Short text (should bail with minimal enrichment)
    print("\n" + "="*80)
    print("TEST CASE 2: Too Short Text (Expected: Minimal Enrichment)")
    print("="*80)
    
    test2 = {
        'rid': 'test_002',
        'sid': 'user_test',
        'normalized_text': 'tired',  # Only 5 chars < 12 min
        'timestamp': '2025-10-28T19:00:00Z',
        'timezone_used': 'Asia/Kolkata'
    }
    
    result2 = scorer.enrich(test2, prev_reflection=None, history=[])
    
    if result2:
        print_result(result2, "Test 2")
        
        # Check if minimal enrichment was returned
        if result2.get('_agent_mode', {}).get('attempts') == 0:
            print("✅ Correctly returned minimal enrichment for short text")
        else:
            print("❌ Should have bailed with minimal enrichment")
    else:
        print("[X] Test 2 FAILED - returned None")
    
    # Test Case 3: Multi-word phrases (should be sanitized to single tokens)
    print("\n" + "="*80)
    print("TEST CASE 3: Multi-word Phrases (Expected: Single Token Conversion)")
    print("="*80)
    
    test3 = {
        'rid': 'test_003',
        'sid': 'user_test',
        'normalized_text': 'Feeling stuck in this constant checking habit. Relief from always scrolling. Low progress on letting go.',
        'timestamp': '2025-10-28T20:00:00Z',
        'timezone_used': 'Asia/Kolkata'
    }
    
    result3 = scorer.enrich(test3, prev_reflection=None, history=[])
    
    if result3:
        print_result(result3, "Test 3")
        validate_single_tokens(result3, "Test 3")
    else:
        print("[X] Test 3 FAILED - returned None")
    
    # Test Case 4: With previous reflection (temporal continuity)
    print("\n" + "="*80)
    print("TEST CASE 4: With Previous Reflection (Expected: Temporal WoW Change)")
    print("="*80)
    
    prev_reflection = {
        'rid': 'prev_001',
        'final': {
            'valence': 0.3,
            'arousal': 0.6,
            'wheel': {'primary': 'Angry', 'secondary': 'frustrated', 'tertiary': 'annoyed'}
        },
        'enriched_at': '2025-10-27T18:00:00Z'
    }
    
    test4 = {
        'rid': 'test_004',
        'sid': 'user_test',
        'normalized_text': 'Feeling calmer today. Managed to finish that project. Small relief.',
        'timestamp': '2025-10-28T18:00:00Z',
        'timezone_used': 'Asia/Kolkata'
    }
    
    result4 = scorer.enrich(test4, prev_reflection=prev_reflection, history=[prev_reflection])
    
    if result4:
        print_result(result4, "Test 4")
        
        # Check temporal continuity
        wow = result4.get('temporal', {}).get('wow_change', {})
        if wow.get('valence') is not None:
            print(f"✅ WoW change computed: valence={wow['valence']}, arousal={wow['arousal']}")
        else:
            print("❌ WoW change missing despite prev_reflection")
    else:
        print("[X] Test 4 FAILED - returned None")
    
    print("\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)


def print_result(result: dict, test_name: str):
    """Pretty print enrichment result"""
    print(f"\n{'─'*80}")
    print(f"{test_name} RESULT:")
    print(f"{'─'*80}")
    
    print(f"Language: {result.get('lang_detected')}")
    
    wheel = result.get('wheel', {})
    print(f"Wheel: {wheel.get('primary')} → {wheel.get('secondary')} → {wheel.get('tertiary')}")
    
    print(f"Invoked: {result.get('invoked')}")
    print(f"Expressed: {result.get('expressed')}")
    
    print(f"Valence: {result.get('valence')}")
    print(f"Arousal: {result.get('arousal')}")
    print(f"Confidence: {result.get('confidence')}")
    
    events = result.get('events', [])
    print(f"Events: {[e['label'] for e in events]}")
    
    # Post-enrichment
    post = result.get('post_enrichment', {})
    poems = post.get('poems', [])
    tips = post.get('tips', [])
    closing = post.get('closing_line', '')
    
    print(f"\nPoems ({len(poems)}):")
    for i, poem in enumerate(poems, 1):
        print(f"  {i}. {poem}")
    
    print(f"\nTips ({len(tips)}):")
    for i, tip in enumerate(tips, 1):
        print(f"  {i}. {tip}")
    
    print(f"\nClosing: {closing}")
    
    # Agent Mode metadata
    agent_meta = result.get('_agent_mode', {})
    print(f"\nAgent Mode:")
    print(f"  Attempts: {agent_meta.get('attempts')}")
    print(f"  OOD Penalty: {agent_meta.get('ood_penalty_applied')}")
    print(f"  Latency: {agent_meta.get('latency_ms')}ms")
    
    # Temporal
    temporal = result.get('temporal', {})
    circadian = temporal.get('circadian', {})
    print(f"\nCircadian:")
    print(f"  Phase: {circadian.get('phase')} ({circadian.get('hour_local')}h)")
    print(f"  Sleep Adjacent: {circadian.get('sleep_adjacent')}")
    
    wow = temporal.get('wow_change', {})
    if wow.get('valence') is not None:
        print(f"\nWoW Change:")
        print(f"  Valence: {wow['valence']:+.2f}")
        print(f"  Arousal: {wow['arousal']:+.2f}")


def validate_single_tokens(result: dict, test_name: str):
    """Validate single-token enforcement"""
    print(f"\n{'─'*80}")
    print(f"{test_name} SINGLE-TOKEN VALIDATION:")
    print(f"{'─'*80}")
    
    errors = []
    
    # Check invoked
    invoked = result.get('invoked', '')
    for token in invoked.split('+'):
        clean = token.strip()
        if ' ' in clean:
            errors.append(f"Multi-word invoked: '{clean}'")
    
    # Check expressed
    expressed = result.get('expressed', '')
    for token in expressed.split('/'):
        clean = token.strip()
        if ' ' in clean:
            errors.append(f"Multi-word expressed: '{clean}'")
    
    # Check events
    events = result.get('events', [])
    for event in events:
        label = event.get('label', '')
        if ' ' in label:
            errors.append(f"Multi-word event: '{label}'")
    
    if errors:
        print("❌ VALIDATION ERRORS:")
        for err in errors:
            print(f"  - {err}")
    else:
        print("✅ All tokens are single-token compliant")
        print(f"  Invoked: {invoked}")
        print(f"  Expressed: {expressed}")
        print(f"  Events: {[e['label'] for e in events]}")


if __name__ == "__main__":
    test_agent_mode_scorer()
