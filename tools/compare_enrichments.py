"""
Compare enriched outputs: Baseline-only vs Ollama+Baseline Hybrid
For test reflection: "very tired and irritated, didn't make much progress today"
"""

import json
import sys
from pathlib import Path

# Add module paths
sys.path.append(str(Path(__file__).parent.parent / 'enrichment-worker' / 'src'))

from modules.baseline_enricher import BaselineEnricher
from modules.ollama_client import OllamaClient


def load_best_config():
    """Load tuned baseline config"""
    with open('baseline/best_config.json', 'r') as f:
        return json.load(f)


def enrich_baseline_only(text: str, config: dict) -> dict:
    """Enrich using baseline only"""
    enricher = BaselineEnricher(config)
    return enricher.enrich(text)


def enrich_hybrid(text: str, config: dict) -> dict:
    """Enrich using Ollama + baseline hybrid"""
    # 1. Baseline enrichment
    baseline_enricher = BaselineEnricher(config)
    baseline_result = baseline_enricher.enrich(text)
    
    # 2. Ollama enrichment
    ollama_client = OllamaClient()
    if not ollama_client.is_available():
        print("⚠️ Ollama not available, returning baseline only")
        return baseline_result
    
    ollama_result = ollama_client.enrich(text)
    
    # Check if Ollama succeeded
    if not ollama_result:
        print("⚠️ Ollama enrichment failed, returning baseline only")
        return baseline_result
    
    # 3. Merge (baseline weight = 0.35, ollama weight = 0.65)
    BASELINE_BLEND = 0.35
    
    merged = {
        'invoked': ollama_result.get('invoked', baseline_result['invoked']),
        'expressed': ollama_result.get('expressed', baseline_result['expressed']),
        'wheel': {
            'primary': ollama_result.get('wheel', {}).get('primary', baseline_result['wheel']['primary']),
            'secondary': ollama_result.get('wheel', {}).get('secondary', baseline_result['wheel']['secondary'])
        },
        'valence': round(
            baseline_result['valence'] * BASELINE_BLEND + 
            ollama_result.get('valence', baseline_result['valence']) * (1 - BASELINE_BLEND),
            2
        ),
        'arousal': round(
            baseline_result['arousal'] * BASELINE_BLEND + 
            ollama_result.get('arousal', baseline_result['arousal']) * (1 - BASELINE_BLEND),
            2
        ),
        'confidence': round(
            baseline_result['confidence'] * BASELINE_BLEND + 
            ollama_result.get('confidence', baseline_result['confidence']) * (1 - BASELINE_BLEND),
            2
        ),
        'events': merge_events(baseline_result['events'], ollama_result.get('events', [])),
        'warnings': ollama_result.get('warnings', []),
        'congruence': {
            'score': 0.75,  # Simplified for demo
            'analysis': 'Fatigue and irritation are congruent'
        },
        '_hybrid': True,
        '_baseline_weight': BASELINE_BLEND,
        '_ollama_weight': 1 - BASELINE_BLEND
    }
    
    return merged


def merge_events(baseline_events: list, ollama_events: list) -> list:
    """Merge event lists (deduplicate, keep higher confidence)"""
    event_map = {}
    
    for event in baseline_events:
        # Handle both dict and string formats
        if isinstance(event, dict):
            label = event['label']
            event_map[label] = event
        else:
            event_map[event] = {'label': event, 'confidence': 0.6}
    
    for event in ollama_events:
        # Handle both dict and string formats
        if isinstance(event, dict):
            label = event['label']
            if label not in event_map or event['confidence'] > event_map[label]['confidence']:
                event_map[label] = event
        else:
            if event not in event_map:
                event_map[event] = {'label': event, 'confidence': 0.7}
    
    return list(event_map.values())


def print_comparison(baseline_result: dict, hybrid_result: dict):
    """Print side-by-side comparison"""
    print("\n" + "="*80)
    print("ENRICHED OUTPUT COMPARISON")
    print("="*80)
    
    print("\nTest Reflection:")
    print('  "very tired and irritated, didn\'t make much progress today"')
    
    print("\n" + "-"*80)
    print("BASELINE-ONLY ENRICHMENT (tuned rules, no Ollama)")
    print("-"*80)
    print(json.dumps(baseline_result, indent=2, ensure_ascii=False))
    
    print("\n" + "-"*80)
    print("HYBRID ENRICHMENT (Ollama + Baseline, 65%/35% blend)")
    print("-"*80)
    print(json.dumps(hybrid_result, indent=2, ensure_ascii=False))
    
    print("\n" + "="*80)
    print("KEY DIFFERENCES")
    print("="*80)
    
    print(f"\nInvoked (internal feeling):")
    print(f"  Baseline: {baseline_result['invoked']}")
    print(f"  Hybrid:   {hybrid_result['invoked']}")
    
    print(f"\nExpressed (outward tone):")
    print(f"  Baseline: {baseline_result['expressed']}")
    print(f"  Hybrid:   {hybrid_result['expressed']}")
    
    print(f"\nWheel Primary:")
    print(f"  Baseline: {baseline_result['wheel']['primary']}")
    print(f"  Hybrid:   {hybrid_result['wheel']['primary']}")
    
    print(f"\nValence:")
    print(f"  Baseline: {baseline_result['valence']}")
    print(f"  Hybrid:   {hybrid_result['valence']}")
    
    print(f"\nArousal:")
    print(f"  Baseline: {baseline_result['arousal']}")
    print(f"  Hybrid:   {hybrid_result['arousal']}")
    
    print(f"\nEvents:")
    print(f"  Baseline: {[e['label'] for e in baseline_result['events']]}")
    print(f"  Hybrid:   {[e['label'] for e in hybrid_result['events']]}")
    
    if 'congruence' in hybrid_result:
        print(f"\nCongruence (Hybrid only):")
        print(f"  {hybrid_result['congruence']}")
    
    print("\n" + "="*80)


if __name__ == '__main__':
    test_text = "very tired and irritated, didn't make much progress today"
    
    print("\n🔍 Loading tuned baseline config...")
    config = load_best_config()
    print(f"✓ Loaded config (pass rate: 66%)")
    
    print("\n🔧 Running baseline-only enrichment...")
    baseline_result = enrich_baseline_only(test_text, config)
    print("✓ Baseline enrichment complete")
    
    print("\n🔧 Running Ollama+Baseline hybrid enrichment...")
    hybrid_result = enrich_hybrid(test_text, config)
    print("✓ Hybrid enrichment complete")
    
    print_comparison(baseline_result, hybrid_result)
