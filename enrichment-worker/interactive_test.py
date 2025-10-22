import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from modules.hybrid_scorer import HybridScorer
from modules.post_enricher import PostEnricher

def main():
    # Initialize Stage-1 (Hybrid Scorer)
    scorer = HybridScorer(
        hf_token=os.getenv('HF_TOKEN'),
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        ollama_model=os.getenv('OLLAMA_MODEL', 'phi3:latest'),
        hf_weight=float(os.getenv('HF_WEIGHT', '0.4')),
        emb_weight=float(os.getenv('EMB_WEIGHT', '0.3')),
        ollama_weight=float(os.getenv('OLLAMA_WEIGHT', '0.3')),
        timeout=int(os.getenv('OLLAMA_TIMEOUT', '30'))
    )
    
    # Initialize Stage-2 (Post-Enricher)
    post_enricher = PostEnricher(
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        ollama_model=os.getenv('OLLAMA_MODEL', 'phi3:latest'),
        temperature=float(os.getenv('STAGE2_TEMPERATURE', '0.8')),
        timeout=int(os.getenv('STAGE2_TIMEOUT', '120'))  # 2 minutes default
    )
    
    print("\n" + "="*80)
    print("🔬 TWO-STAGE ENRICHMENT PIPELINE")
    print("   Stage-1: Hybrid Scorer (HF + Embeddings + Ollama)")
    print("   Stage-2: Post-Enricher (Creative Content)")
    print("="*80)
    
    while True:
        text = input("\n> ").strip()
        
        if not text or text.lower() in ['quit', 'exit', 'q']:
            break
        
        try:
            # Stage-1: Hybrid enrichment
            print("\n" + "="*80)
            print("STAGE-1: ANALYTICAL ENRICHMENT")
            print("="*80)
            result = scorer.enrich(text)
            result['status'] = 'enriched'  # Mark as Stage-1 complete
            
            # Stage-2: Post-enrichment
            print("\n" + "="*80)
            print("STAGE-2: CREATIVE POST-PROCESSING")
            print("="*80)
            final = post_enricher.run_post_enrichment(result)
            
            # Show full output
            print("\n" + "="*80)
            print("FINAL OUTPUT (BOTH STAGES)")
            print("="*80)
            print(json.dumps(final, indent=2, ensure_ascii=False))
            print("="*80 + "\n")
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"\n❌ {type(e).__name__}: {e}\n")
            import traceback
            traceback.print_exc()

if __name__ == '__main__':
    main()
