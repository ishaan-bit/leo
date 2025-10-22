"""
Test Stage-2 post-enrichment directly with a sample input
"""

import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from modules.post_enricher import PostEnricher

def main():
    # Sample hybrid result (Stage-1 output) - CONFUSION scenario
    hybrid_result = {
        "normalized_text": "I don't know what I feel right now, just a weird mix of everything.",
        "invoked": "doubt + confusion + mixed feelings",
        "expressed": "confused / anxious / overwhelmed",
        "wheel": {
            "primary": "Scared",
            "secondary": "confused",
            "tertiary": "puzzled"
        },
        "valence": 0.35,
        "arousal": 0.65,
        "events": [
            {"label": "confusion", "confidence": 0.9},
            {"label": "doubt", "confidence": 0.85},
            {"label": "overwhelm", "confidence": 0.8}
        ],
        "status": "enriched"
    }
    
    print("🧪 Testing Stage-2 Post-Enrichment (Confusion scenario)")
    print(f"   Input: {hybrid_result['normalized_text']}")
    print(f"   Wheel: {hybrid_result['wheel']['primary']} → {hybrid_result['wheel']['secondary']} → {hybrid_result['wheel']['tertiary']}")
    print(f"   Valence: {hybrid_result['valence']}, Arousal: {hybrid_result['arousal']}")
    
    # Initialize post-enricher with longer timeout
    post_enricher = PostEnricher(
        ollama_base_url="http://localhost:11434",
        ollama_model="phi3:latest",
        temperature=0.8,
        timeout=120  # 2 minutes for safety
    )
    
    # Check if Ollama available
    if not post_enricher.is_available():
        print("❌ Ollama not available at http://localhost:11434")
        return
    
    print("✅ Ollama is available")
    
    # Run post-enrichment
    final = post_enricher.run_post_enrichment(hybrid_result)
    
    # Print results
    import json
    print("\n" + "="*80)
    print("STAGE-2 OUTPUT:")
    print("="*80)
    if 'post_enrichment' in final:
        print(json.dumps(final['post_enrichment'], indent=2, ensure_ascii=False))
    else:
        print("❌ No post_enrichment field generated")
    print("="*80)

if __name__ == '__main__':
    main()
