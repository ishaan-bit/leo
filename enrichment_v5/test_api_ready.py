"""
Quick test of the FastAPI endpoint before deploying to HF Spaces.
"""

import sys
from pathlib import Path

# Test if FastAPI is available
try:
    import fastapi
    import uvicorn
    print("✅ FastAPI and Uvicorn installed")
except ImportError:
    print("❌ FastAPI not installed. Run: pip install fastapi uvicorn[standard] pydantic")
    sys.exit(1)

# Test enrichment pipeline
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from enrich.full_pipeline import enrich

print("\n" + "="*60)
print("Testing Enrichment Pipeline")
print("="*60)

test_text = "i am so angry, all the work gone to waste in an hour"
print(f"\nInput: {test_text}")

try:
    result = enrich(test_text)
    
    print("\n✅ Enrichment successful!")
    print(f"   Primary: {result.get('primary')}")
    print(f"   Valence: {result.get('valence')}")
    print(f"   Arousal: {result.get('arousal')}")
    print(f"   Poems: {len(result.get('poems', []))} lines")
    print(f"   Tips: {len(result.get('tips', []))} windows")
    
    print("\n" + "="*60)
    print("✅ Ready to deploy!")
    print("="*60)
    print("\nNext steps:")
    print("1. Test locally: python app.py")
    print("2. Visit: http://localhost:7860/docs")
    print("3. Deploy to HF Spaces (see DEPLOYMENT_GUIDE.md)")
    print()
    
except Exception as e:
    print(f"\n❌ Enrichment failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
