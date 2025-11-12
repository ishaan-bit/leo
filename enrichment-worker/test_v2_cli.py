"""
CLI Test for Enrichment Pipeline v2.0
Enter moments and see enrichment results
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from enrich.pipeline import enrich


def mock_hf_probs(text: str) -> dict:
    """Mock HF probabilities based on keywords."""
    text_lower = text.lower()
    
    # Emotion keyword detection
    if any(word in text_lower for word in ['happy', 'great', 'awesome', 'excited', 'love', 'joy']):
        return {'Happy': 0.6, 'Strong': 0.15, 'Peaceful': 0.1, 'Sad': 0.07, 'Angry': 0.05, 'Fearful': 0.03}
    elif any(word in text_lower for word in ['angry', 'furious', 'annoyed', 'frustrated', 'pissed']):
        return {'Angry': 0.55, 'Fearful': 0.2, 'Sad': 0.1, 'Happy': 0.08, 'Strong': 0.05, 'Peaceful': 0.02}
    elif any(word in text_lower for word in ['sad', 'depressed', 'down', 'upset', 'cry', 'unhappy']):
        return {'Sad': 0.6, 'Fearful': 0.15, 'Angry': 0.1, 'Peaceful': 0.08, 'Happy': 0.05, 'Strong': 0.02}
    elif any(word in text_lower for word in ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'fearful', 'nervous', 'haywire']):
        return {'Fearful': 0.6, 'Sad': 0.15, 'Angry': 0.1, 'Peaceful': 0.08, 'Happy': 0.05, 'Strong': 0.02}
    elif any(word in text_lower for word in ['calm', 'peaceful', 'relaxed', 'content', 'relief']):
        return {'Peaceful': 0.6, 'Happy': 0.15, 'Strong': 0.1, 'Sad': 0.08, 'Angry': 0.05, 'Fearful': 0.02}
    elif any(word in text_lower for word in ['strong', 'confident', 'powerful', 'capable', 'proud', 'accomplished']):
        return {'Strong': 0.6, 'Happy': 0.15, 'Peaceful': 0.1, 'Fearful': 0.08, 'Angry': 0.05, 'Sad': 0.02}
    else:
        # Default neutral distribution
        return {'Peaceful': 0.3, 'Happy': 0.25, 'Strong': 0.2, 'Sad': 0.1, 'Angry': 0.08, 'Fearful': 0.07}


def mock_embeddings(text: str) -> dict:
    """Mock embeddings for all 36 secondary emotions."""
    text_lower = text.lower()
    
    # All 36 secondaries from wheel.txt with baseline scores
    secondaries = {
        # Happy secondaries
        'Excited': 0.3, 'Interested': 0.3, 'Energetic': 0.3, 
        'Playful': 0.3, 'Creative': 0.3, 'Optimistic': 0.3,
        # Strong secondaries
        'Confident': 0.3, 'Proud': 0.3, 'Respected': 0.3, 
        'Courageous': 0.3, 'Hopeful': 0.3, 'Resilient': 0.3,
        # Peaceful secondaries
        'Loving': 0.3, 'Grateful': 0.3, 'Thoughtful': 0.3, 
        'Content': 0.3, 'Serene': 0.3, 'Thankful': 0.3,
        # Sad secondaries
        'Lonely': 0.3, 'Vulnerable': 0.3, 'Hurt': 0.3, 
        'Depressed': 0.3, 'Guilty': 0.3, 'Grief': 0.3,
        # Angry secondaries
        'Mad': 0.3, 'Disappointed': 0.3, 'Humiliated': 0.3, 
        'Aggressive': 0.3, 'Frustrated': 0.3, 'Critical': 0.3,
        # Fearful secondaries
        'Anxious': 0.3, 'Insecure': 0.3, 'Overwhelmed': 0.3, 
        'Weak': 0.3, 'Rejected': 0.3, 'Helpless': 0.3,
    }
    
    # Boost relevant secondaries based on keywords
    if 'success' in text_lower or 'promoted' in text_lower or 'accomplished' in text_lower:
        secondaries['Proud'] = 0.85
        secondaries['Confident'] = 0.80
        secondaries['Excited'] = 0.75
    elif 'working' in text_lower or 'trying' in text_lower or 'pushing' in text_lower:
        secondaries['Resilient'] = 0.82
        secondaries['Determined'] = 0.78 if 'Determined' in secondaries else 0.78
        secondaries['Frustrated'] = 0.70
    elif 'anxious' in text_lower or 'worried' in text_lower or 'nervous' in text_lower:
        secondaries['Anxious'] = 0.85
        secondaries['Overwhelmed'] = 0.75
        secondaries['Insecure'] = 0.70
    elif 'sad' in text_lower or 'depressed' in text_lower:
        secondaries['Depressed'] = 0.85
        secondaries['Hurt'] = 0.75
        secondaries['Lonely'] = 0.70
    elif 'angry' in text_lower or 'frustrated' in text_lower:
        secondaries['Frustrated'] = 0.85
        secondaries['Mad'] = 0.80
        secondaries['Disappointed'] = 0.75
    elif 'calm' in text_lower or 'peaceful' in text_lower or 'content' in text_lower:
        secondaries['Content'] = 0.85
        secondaries['Serene'] = 0.80
        secondaries['Grateful'] = 0.75
    
    return secondaries


def print_result(text: str, result: dict):
    """Pretty print enrichment result."""
    print("\n" + "="*80)
    print(f"TEXT: {text}")
    print("="*80)
    
    # Emotions
    print(f"\nEMOTIONS:")
    print(f"  Primary:    {result['primary']}")
    print(f"  Secondary:  {result['secondary']}")
    
    # Valence & Arousal
    print(f"\nVALENCE & AROUSAL:")
    print(f"  Emotion Valence: {result['valence']:.3f}  (0=negative, 1=positive)")
    print(f"  Event Valence:   {result['event_valence']:.3f}  (positivity of event itself)")
    print(f"  Arousal:         {result['arousal']:.3f}  (0=calm, 1=energized)")
    
    # Context
    print(f"\nCONTEXT:")
    print(f"  Domain:   {result['domain']['primary']}", end='')
    if result['domain']['secondary']:
        print(f" + {result['domain']['secondary']} ({result['domain']['mixture_ratio']:.0%} mix)")
    else:
        print()
    print(f"  Control:  {result['control']}")
    print(f"  Polarity: {result['polarity']}")
    
    # Confidence
    print(f"\nCONFIDENCE:")
    print(f"  Overall: {result['confidence']:.3f} ({result['confidence_category']})")
    
    # Flags
    flags_str = []
    if result['flags']['negation']:
        flags_str.append("NEGATION")
    if result['flags']['sarcasm']:
        flags_str.append("SARCASM")
    if result['flags']['profanity'] != 'none':
        flags_str.append(f"PROFANITY ({result['flags']['profanity']})")
    
    if flags_str:
        print(f"\nFLAGS: {', '.join(flags_str)}")
    
    print("="*80)


def main():
    """Interactive CLI for testing enrichment."""
    print("\n" + "="*80)
    print("ENRICHMENT PIPELINE v2.0 - INTERACTIVE TEST")
    print("="*80)
    print("\nFeatures:")
    print("  - Negation reversal (e.g., 'not happy' -> Sad)")
    print("  - Sarcasm detection (e.g., 'Great, another deadline...')")
    print("  - Profanity sentiment (positive vs negative)")
    print("  - Event valence separation")
    print("  - Control & domain extraction")
    print("  - 8-component confidence scoring")
    print("\nType 'quit' or 'exit' to stop")
    print("="*80)
    
    while True:
        print("\n")
        text = input("Enter a moment/reflection: ").strip()
        
        if not text:
            continue
            
        if text.lower() in ['quit', 'exit', 'q']:
            print("\nGoodbye!")
            break
        
        try:
            # Mock inputs (in production, these would come from actual models)
            p_hf = mock_hf_probs(text)
            secondary_similarity = mock_embeddings(text)
            driver_scores = {}
            history = []
            user_priors = {'domain': {}, 'control': {}}
            
            # Run enrichment
            result = enrich(text, p_hf, secondary_similarity, driver_scores, history, user_priors)
            
            # Print result
            print_result(text, result)
            
        except Exception as e:
            print(f"\nERROR: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    main()
