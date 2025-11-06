"""
Simple test script for enrichment_v5 - just one reflection.
"""

import os
import sys
import json
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from enrich.full_pipeline import enrich

def main():
    """Test single reflection."""
    test_text = "i am so angry, all the work gone to waste in an hour"
    
    print("\n" + "="*60)
    print("Testing Enrichment v5")
    print("="*60)
    print(f"\nInput: {test_text}")
    print("\nProcessing...")
    
    try:
        result = enrich(test_text)
        
        print("\n" + "="*60)
        print("ENRICHMENT RESULT")
        print("="*60)
        
        # EVENT CONTEXT
        print("\n📍 EVENT CONTEXT:")
        domain = result.get('domain', {})
        if isinstance(domain, dict):
            domain_str = domain.get('primary', 'N/A')
            if domain.get('secondary'):
                domain_str += f" + {domain.get('secondary')}"
            print(f"   Domain:         {domain_str}")
        print(f"   Control:        {result.get('control', 'N/A')}")
        print(f"   Polarity:       {result.get('polarity', 'N/A')}")
        print(f"   Event Valence:  {result.get('event_valence', 0):.3f}")
        print(f"   Event Presence: {result.get('event_presence', 'N/A')}")
        
        # EMOTION
        print("\n🎭 EMOTION:")
        print(f"   Primary:          {result.get('primary', 'N/A')}")
        print(f"   Secondary:        {result.get('secondary', 'N/A')}")
        print(f"   Tertiary:         {result.get('tertiary', 'N/A')}")
        print(f"   Emotion Presence: {result.get('emotion_presence', 'N/A')}")
        print(f"   Emotion Valence:  {result.get('valence', 0):.3f}")
        print(f"   Emotion Arousal:  {result.get('arousal', 0):.3f}")
        
        # CONFIDENCE
        print("\n📊 CONFIDENCE:")
        print(f"   Overall: {result.get('confidence', 0):.3f} ({result.get('confidence_category', 'N/A')})")
        
        # FLAGS
        print("\n🚩 FLAGS:")
        flags = result.get('flags', {})
        print(f"   Negation:  {flags.get('negation', False)}")
        print(f"   Sarcasm:   {flags.get('sarcasm', False)}")
        print(f"   Profanity: {flags.get('profanity', 'none')}")
        
        # DIALOGUE
        if 'poems' in result and 'tips' in result:
            print("\n🎭 DIALOGUE:")
            poems = result.get('poems', [])
            tips = result.get('tips', [])
            meta = result.get('_dialogue_meta', {})
            
            print(f"   Tone/Band: {meta.get('tone', 'N/A')}/{meta.get('band', 'N/A')} ({meta.get('timer', 'N/A')}s)")
            print("\n   Pig Lines:")
            for i, poem in enumerate(poems, 1):
                print(f"     {i}. {poem}")
            print("\n   Window Rituals:")
            for i, tip in enumerate(tips, 1):
                print(f"     {i}. {tip}")
        
        print("\n" + "="*60)
        print("\n✅ SUCCESS - Pipeline working!\n")
        
        # Show full JSON
        print("Full JSON output:")
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
