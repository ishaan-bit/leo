#!/usr/bin/env python3
"""
Interactive reflection tester for v2.2 pipeline.
Run this to test your reflections and see enrichment output.
"""

from src.enrich.pipeline_v2_2 import enrich_v2_2
import json

def test_reflection(text: str):
    """Test a reflection and print formatted results."""
    print(f"\n{'='*70}")
    print(f"Input: {text}")
    print(f"{'='*70}")
    
    try:
        result = enrich_v2_2(
            text=text,
            include_tertiary=True,
            include_neutral=True
        )
        
        print(f"\n🎭 EMOTIONS:")
        print(f"  Primary:   {result.primary}")
        print(f"  Secondary: {result.secondary}")
        print(f"  Tertiary:  {result.tertiary if result.tertiary else 'N/A'}")
        
        print(f"\n📊 DIMENSIONS:")
        print(f"  Emotion Valence: {result.emotion_valence:.3f} [0=negative, 1=positive]")
        print(f"  Event Valence:   {result.event_valence:.3f}")
        print(f"  Arousal:         {result.arousal:.3f} [0=calm, 1=energized]")
        
        print(f"\n🏷️  CONTEXT:")
        print(f"  Domain:   {result.domain}")
        print(f"  Control:  {result.control}")
        print(f"  Polarity: {result.polarity}")
        
        print(f"\n🔍 LINGUISTIC FLAGS:")
        has_negation = result.flags.get('has_negation', False)
        negation_strength = result.flags.get('negation_strength', 0.0)
        if has_negation:
            print(f"  Negation:  ✓ (strength: {negation_strength:.2f})")
        else:
            print(f"  Negation:  ✗")
        print(f"  Litotes:   {'✓' if result.flags.get('is_litotes', False) else '✗'}")
        print(f"  Profanity: {'✓' if result.flags.get('has_profanity', False) else '✗'}")
        print(f"  Sarcasm:   {'✓' if result.flags.get('has_sarcasm', False) else '✗'}")
        
        if result.tertiary_confidence is not None:
            print(f"\n💯 TERTIARY CONFIDENCE: {result.tertiary_confidence:.3f}")
        
        print(f"\n📝 PRESENCE:")
        print(f"  Emotion: {result.emotion_presence}")
        print(f"  Event:   {result.event_presence}")
        
        print(f"\n{'='*70}\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("\n🧠 Leo Enrichment Pipeline v2.2 - Interactive Tester")
    print("=" * 70)
    print("Type your reflection and press Enter to see enrichment output.")
    print("Type 'quit' or 'exit' to stop.")
    print("=" * 70)
    
    while True:
        try:
            text = input("\n💭 Your reflection: ").strip()
            
            if not text:
                continue
                
            if text.lower() in ['quit', 'exit', 'q']:
                print("\n👋 Goodbye!\n")
                break
                
            test_reflection(text)
            
        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!\n")
            break
        except EOFError:
            print("\n\n👋 Goodbye!\n")
            break
