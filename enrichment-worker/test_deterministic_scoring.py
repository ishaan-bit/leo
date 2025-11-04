"""
Test Deterministic Scoring - See the new event-based reranking in action
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from modules.hybrid_scorer import HybridScorer

# Test reflections with different event characteristics
TEST_CASES = [
    {
        "text": "My boss cancelled my presentation at the last minute",
        "expected": "work domain, low control → should boost fearful/angry"
    },
    {
        "text": "I finally finished that project I've been working on for months",
        "expected": "work domain, high control → should boost strong/happy"
    },
    {
        "text": "Worried about the exam tomorrow, haven't studied enough",
        "expected": "study domain, planned polarity → should boost fearful"
    },
    {
        "text": "My partner and I had a huge fight, feeling terrible",
        "expected": "relationship domain → should boost sad/angry"
    },
    {
        "text": "Didn't get the promotion I was hoping for",
        "expected": "work domain, did_not_happen + work → angry override"
    }
]

def test_deterministic_scoring():
    """Test the new deterministic scoring system"""
    
    print("🧪 Testing Deterministic Scoring System")
    print("="*70)
    
    # Initialize hybrid scorer (no Ollama, just HF + embeddings + deterministic rerank)
    hf_token = os.getenv('HF_TOKEN')
    if not hf_token:
        print("❌ HF_TOKEN not found in environment")
        print("Please set HF_TOKEN in enrichment-worker/.env")
        return False
    
    scorer = HybridScorer(
        hf_token=hf_token,
        use_ollama=False  # Use deterministic scoring instead
    )
    
    print(f"✅ Initialized HybridScorer (deterministic mode)")
    print()
    
    # Test each case
    for i, case in enumerate(TEST_CASES, 1):
        text = case['text']
        expected = case['expected']
        
        print(f"\n{'='*70}")
        print(f"Test Case {i}/{len(TEST_CASES)}")
        print(f"Text: {text}")
        print(f"Expected: {expected}")
        print('='*70)
        
        # Enrich
        result = scorer.enrich(text)
        
        if not result:
            print(f"❌ Enrichment failed")
            continue
        
        # Display results
        wheel = result.get('wheel', {})
        meta = result.get('meta', {})
        context = meta.get('context', {})
        
        print(f"\n📊 RESULTS:")
        print(f"   Event Context:")
        if isinstance(context, dict):
            print(f"      headline: {context.get('event_headline', 'N/A')}")
            print(f"      domain: {context.get('event_domain', 'N/A')}")
            print(f"      control: {context.get('event_control', 'N/A')}")
            print(f"      polarity: {context.get('event_polarity', 'N/A')}")
        else:
            print(f"      {context}")
        
        print(f"\n   Emotion Chain:")
        print(f"      {wheel.get('primary', 'N/A')} → {wheel.get('secondary', 'N/A')} → {wheel.get('tertiary', 'N/A')}")
        
        # Show score terms if available
        score_terms = result.get('score_terms')
        if score_terms:
            print(f"\n   Score Breakdown:")
            print(f"      Total: {result.get('score', 0):.3f}")
            print(f"      α·HF:      {score_terms.get('alpha_hf', 0):.3f}")
            print(f"      β·Sim:     {score_terms.get('beta_sim_ter', 0):.3f}")
            print(f"      γ·Domain:  {score_terms.get('gamma_domain', 0):.3f}")
            print(f"      δ·Control: {score_terms.get('delta_control', 0):.3f}")
            print(f"      ε·Polar:   {score_terms.get('epsilon_polarity', 0):.3f}")
            print(f"      κ·Core:    {score_terms.get('kappa_sim_core', 0):.3f}")
        
        print()
    
    print("\n" + "="*70)
    print("✅ Test complete! Check the score breakdowns above.")
    print("="*70)
    
    return True


if __name__ == '__main__':
    # Load HF token from .env
    from pathlib import Path
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('HF_TOKEN='):
                    os.environ['HF_TOKEN'] = line.split('=', 1)[1].strip().strip('"').strip("'")
    
    test_deterministic_scoring()
