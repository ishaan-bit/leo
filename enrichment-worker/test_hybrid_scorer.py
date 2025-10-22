"""
Test Hybrid Scorer - Verify Schema Compatibility
"""

import sys
import os
from dotenv import load_dotenv

load_dotenv()

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from modules.hybrid_scorer import HybridScorer

# Test reflections
TEST_TEXTS = [
    "completed something I'd been avoiding for weeks, feels good",
    "can't keep up with everything, totally overwhelmed",
    "had the best laugh with friends today",
    "missing how things used to be",
    "spoke up even though I was scared, proud of myself",
]

def test_schema_compatibility():
    """Test that hybrid scorer returns exact schema as ollama_client"""
    
    print("🧪 Testing Hybrid Scorer Schema Compatibility\n")
    
    # Initialize hybrid scorer
    hf_token = os.getenv('HF_TOKEN')
    if not hf_token:
        print("❌ HF_TOKEN not found in environment")
        return False
    
    scorer = HybridScorer(
        hf_token=hf_token,
        ollama_base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
        ollama_model=os.getenv('OLLAMA_MODEL', 'phi3:latest'),
        hf_weight=0.4,
        emb_weight=0.3,
        ollama_weight=0.3
    )
    
    # Check availability
    if not scorer.is_available():
        print("⚠️  Warning: Hybrid scorer dependencies not fully available")
        print("   (HF or Ollama may be down, but continuing test...)\n")
    
    # Test each reflection
    all_valid = True
    for i, text in enumerate(TEST_TEXTS, 1):
        print(f"\n{'='*60}")
        print(f"Test {i}/{len(TEST_TEXTS)}: {text[:50]}...")
        print('='*60)
        
        result = scorer.enrich(text)
        
        if not result:
            print(f"❌ Enrichment failed for text {i}")
            all_valid = False
            continue
        
        # Validate schema
        valid = validate_schema(result, text)
        if not valid:
            all_valid = False
    
    print(f"\n{'='*60}")
    if all_valid:
        print("✅ All tests passed! Schema is compatible.")
    else:
        print("❌ Some tests failed. Check output above.")
    print('='*60)
    
    return all_valid


def validate_schema(result: dict, text: str) -> bool:
    """
    Validate that result matches exact ollama_client schema
    
    Required fields:
    - invoked: str
    - expressed: str
    - wheel: {primary: str, secondary: str}
    - valence: float [0,1]
    - arousal: float [0,1]
    - confidence: float [0,1]
    - events: list[str]
    - warnings: list[str]
    - willingness_cues: {hedges, intensifiers, negations, self_reference}
    """
    errors = []
    
    # Check required top-level fields
    required_fields = ['invoked', 'expressed', 'wheel', 'valence', 'arousal', 'confidence', 'events', 'warnings', 'willingness_cues']
    for field in required_fields:
        if field not in result:
            errors.append(f"Missing field: {field}")
    
    # Check types
    if 'invoked' in result and not isinstance(result['invoked'], str):
        errors.append(f"invoked must be str, got {type(result['invoked'])}")
    
    if 'expressed' in result and not isinstance(result['expressed'], str):
        errors.append(f"expressed must be str, got {type(result['expressed'])}")
    
    if 'wheel' in result:
        if not isinstance(result['wheel'], dict):
            errors.append(f"wheel must be dict, got {type(result['wheel'])}")
        else:
            if 'primary' not in result['wheel']:
                errors.append("wheel.primary missing")
            if 'secondary' not in result['wheel']:
                errors.append("wheel.secondary missing")
            
            # Validate Plutchik emotions
            valid_emotions = ['joy', 'sadness', 'anger', 'fear', 'trust', 'disgust', 'surprise', 'anticipation']
            primary = result['wheel'].get('primary')
            secondary = result['wheel'].get('secondary')
            
            if primary and primary not in valid_emotions:
                errors.append(f"Invalid primary emotion: {primary}")
            if secondary and secondary not in valid_emotions:
                errors.append(f"Invalid secondary emotion: {secondary}")
    
    if 'valence' in result:
        if not isinstance(result['valence'], (int, float)):
            errors.append(f"valence must be float, got {type(result['valence'])}")
        elif not (0 <= result['valence'] <= 1):
            errors.append(f"valence out of range [0,1]: {result['valence']}")
    
    if 'arousal' in result:
        if not isinstance(result['arousal'], (int, float)):
            errors.append(f"arousal must be float, got {type(result['arousal'])}")
        elif not (0 <= result['arousal'] <= 1):
            errors.append(f"arousal out of range [0,1]: {result['arousal']}")
    
    if 'confidence' in result:
        if not isinstance(result['confidence'], (int, float)):
            errors.append(f"confidence must be float, got {type(result['confidence'])}")
        elif not (0 <= result['confidence'] <= 1):
            errors.append(f"confidence out of range [0,1]: {result['confidence']}")
    
    if 'events' in result and not isinstance(result['events'], list):
        errors.append(f"events must be list, got {type(result['events'])}")
    
    if 'warnings' in result and not isinstance(result['warnings'], list):
        errors.append(f"warnings must be list, got {type(result['warnings'])}")
    
    if 'willingness_cues' in result:
        if not isinstance(result['willingness_cues'], dict):
            errors.append(f"willingness_cues must be dict, got {type(result['willingness_cues'])}")
        else:
            required_cue_keys = ['hedges', 'intensifiers', 'negations', 'self_reference']
            for key in required_cue_keys:
                if key not in result['willingness_cues']:
                    errors.append(f"willingness_cues.{key} missing")
    
    # Print results
    if errors:
        print(f"❌ Schema validation FAILED:")
        for error in errors:
            print(f"   - {error}")
        print(f"\nActual result:")
        import json
        print(json.dumps(result, indent=2))
        return False
    else:
        print(f"✅ Schema validation PASSED")
        print(f"   invoked: {result['invoked']}")
        print(f"   expressed: {result['expressed']}")
        print(f"   wheel: primary={result['wheel']['primary']}, secondary={result['wheel']['secondary']}")
        print(f"   valence: {result['valence']:.2f}, arousal: {result['arousal']:.2f}, confidence: {result['confidence']:.2f}")
        print(f"   events: {result['events']}")
        return True


if __name__ == '__main__':
    success = test_schema_compatibility()
    sys.exit(0 if success else 1)
