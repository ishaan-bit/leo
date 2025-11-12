"""
Test phi3:mini sentence generation on HuggingFace Spaces
Tests: headline + primary + secondary → single sentence

NOTE: Using enrichment worker space where phi3:mini is already loaded and working
(confirmed working for domain/control extraction)
"""
import requests
import time

# Use the actual enrichment worker (phi3:mini confirmed working for domain extraction)
SPACE_URL = "https://purist-vagabond-leo-enrichment-worker.hf.space"

def check_ollama_status():
    """Check if Ollama and phi3:mini are ready"""
    try:
        # Try to list models
        response = requests.get(f"{SPACE_URL}/api/tags", timeout=5)
        if response.status_code == 200:
            data = response.json()
            models = data.get('models', [])
            phi3_loaded = any('phi3' in str(m).lower() for m in models)
            print(f"✅ Ollama responding, phi3 loaded: {phi3_loaded}")
            print(f"   Available models: {[m.get('name', m) for m in models] if models else 'none'}")
            return phi3_loaded
        else:
            print(f"⚠️  Ollama API returned {response.status_code}")
            return False
    except Exception as e:
        print(f"⚠️  Could not check Ollama status: {e}")
        return False

def test_sentence_generation():
    """Test phi3:mini generating a sentence from headline + emotions"""
    
    # Test cases
    test_cases = [
        {
            "headline": "I cant believe I still have been able to finish this...",
            "primary": "Strong",
            "secondary": "Proud"
        },
        {
            "headline": "mind went haywire",
            "primary": "Fearful",
            "secondary": "Overwhelmed"
        },
        {
            "headline": "Finally submitted the project on time",
            "primary": "Happy",
            "secondary": "Relieved"
        }
    ]
    
    for i, case in enumerate(test_cases, 1):
        print(f"\n{'='*60}")
        print(f"TEST {i}/{len(test_cases)}")
        print(f"{'='*60}")
        print(f"Headline: {case['headline']}")
        print(f"Primary: {case['primary']}")
        print(f"Secondary: {case['secondary']}")
        
        # Generate prompt - VERY SHORT for CPU performance
        prompt = f"""Context: {case['headline']}
Emotions: {case['primary']}, {case['secondary']}

Write one introspective sentence (15 words):"""
        
        # Call Ollama via HF Space
        payload = {
            "model": "phi3:mini",
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "num_predict": 30,  # Short generation
                "num_ctx": 512,     # Smaller context window
            }
        }
        
        print(f"\n⏱️  Calling phi3:mini on HF Space (CPU inference)...")
        start = time.time()
        
        try:
            response = requests.post(
                f"{SPACE_URL}/api/generate",
                json=payload,
                timeout=120  # 2 minutes for CPU
            )
            
            elapsed = time.time() - start
            
            if response.status_code == 200:
                result = response.json()
                sentence = result.get('response', '').strip()
                
                print(f"✅ Success in {elapsed:.2f}s")
                print(f"\nGenerated Sentence:")
                print(f'"{sentence}"')
                print(f"\nWord count: {len(sentence.split())}")
                
            elif response.status_code == 404:
                print(f"❌ HTTP 404 - Model not loaded yet (took {elapsed:.2f}s)")
                print("   Ollama is running but phi3:mini model not available")
                
            else:
                print(f"❌ HTTP {response.status_code} (took {elapsed:.2f}s)")
                print(f"Response: {response.text[:200]}")
                
        except requests.exceptions.Timeout:
            print(f"⏰ Timeout after 30s")
            
        except Exception as e:
            elapsed = time.time() - start
            print(f"❌ Error after {elapsed:.2f}s: {e}")
    
    print(f"\n{'='*60}")
    print("BENCHMARK COMPLETE")
    print(f"{'='*60}")

if __name__ == "__main__":
    print("🔬 PHI3-MINI SENTENCE GENERATION BENCHMARK")
    print(f"Target: {SPACE_URL}")
    print("\nChecking Ollama status...")
    
    ollama_ready = check_ollama_status()
    
    if not ollama_ready:
        print("\n⚠️  WARNING: phi3:mini may not be loaded yet")
        print("   The model might still be downloading (2GB, ~30min on HF Spaces)")
        print("   Proceeding with test anyway (will show timing for 404 vs success)...\n")
    
    print("\nTesting single-sentence generation from headline + emotions...")
    test_sentence_generation()
