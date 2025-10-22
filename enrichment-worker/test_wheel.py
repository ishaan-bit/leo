import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from modules.hybrid_scorer import HybridScorer

def main():
    scorer = HybridScorer(
        hf_token=os.getenv('HF_TOKEN'),
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        ollama_model=os.getenv('OLLAMA_MODEL', 'phi3:latest'),
        hf_weight=float(os.getenv('HF_WEIGHT', '0.4')),
        emb_weight=float(os.getenv('EMB_WEIGHT', '0.3')),
        ollama_weight=float(os.getenv('OLLAMA_WEIGHT', '0.3')),
        timeout=int(os.getenv('OLLAMA_TIMEOUT', '30'))
    )
    
    # Test reflection
    test_text = "He said something that really stung, even if I pretended it didn't."
    
    print(f"\n🧪 Testing: {test_text}\n")
    
    result = scorer.enrich(test_text)
    
    print("\n" + "="*80)
    print("FULL JSON OUTPUT:")
    print("="*80)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("="*80 + "\n")

if __name__ == '__main__':
    main()
