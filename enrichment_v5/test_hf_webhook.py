"""
Test the HF Spaces webhook endpoint
Tests enrichment processing and callback functionality
"""

import requests
import json
import time

# Configuration
HF_WEBHOOK_URL = "https://purist-vagabond-enrichment-api-v5.hf.space/webhook/enrichment"
HF_HEALTH_URL = "https://purist-vagabond-enrichment-api-v5.hf.space/health"

# Test reflections
TEST_CASES = [
    {
        "rid": "test_angry_001",
        "sid": "test_session",
        "normalized_text": "i am so angry at work today, everything is going wrong",
        "expected_primary": "Angry"
    },
    {
        "rid": "test_sad_001",
        "sid": "test_session",
        "normalized_text": "i feel so alone and lost, nothing makes sense anymore",
        "expected_primary": "Sad"
    },
    {
        "rid": "test_happy_001",
        "sid": "test_session",
        "normalized_text": "i am so excited and happy today, everything is perfect",
        "expected_primary": "Happy"
    },
    {
        "rid": "test_fearful_001",
        "sid": "test_session",
        "normalized_text": "i am scared this won't work out, feeling really anxious",
        "expected_primary": "Fearful"
    }
]

def test_health():
    """Test health endpoint"""
    print("="*60)
    print("TEST 1: Health Check")
    print("="*60)
    
    try:
        response = requests.get(HF_HEALTH_URL, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed")
            print(f"Response: {json.dumps(data, indent=2)}")
            
            if data.get('hf_token_configured'):
                print("✅ HF_TOKEN is configured")
            else:
                print("⚠️  HF_TOKEN not configured - add to Space Secrets")
                
            return True
        else:
            print(f"❌ Health check failed: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timeout - Space may be cold starting (wait 30-60s)")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_webhook(test_case, callback_url=None):
    """Test webhook endpoint"""
    print("\n" + "="*60)
    print(f"TEST: {test_case['rid']}")
    print("="*60)
    print(f"Text: {test_case['normalized_text'][:50]}...")
    print(f"Expected Primary: {test_case['expected_primary']}")
    
    payload = {
        "rid": test_case['rid'],
        "sid": test_case['sid'],
        "normalized_text": test_case['normalized_text']
    }
    
    try:
        print("\n📤 Sending webhook request...")
        start_time = time.time()
        
        response = requests.post(
            HF_WEBHOOK_URL,
            json=payload,
            timeout=60  # Allow up to 60s for enrichment
        )
        
        elapsed = time.time() - start_time
        print(f"⏱️  Response time: {elapsed:.2f}s")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                print("✅ Webhook processed successfully")
                
                enrichment = data.get('enrichment', {})
                primary = enrichment.get('primary')
                secondary = enrichment.get('secondary')
                tertiary = enrichment.get('tertiary')
                valence = enrichment.get('valence')
                arousal = enrichment.get('arousal')
                poems = enrichment.get('poems', [])
                tips = enrichment.get('tips', [])
                
                print(f"\n🎭 EMOTIONS:")
                print(f"  Primary:   {primary}")
                print(f"  Secondary: {secondary}")
                print(f"  Tertiary:  {tertiary}")
                
                print(f"\n📊 DIMENSIONS:")
                print(f"  Valence: {valence}")
                print(f"  Arousal: {arousal}")
                
                print(f"\n📜 POEMS ({len(poems)} lines):")
                for i, poem in enumerate(poems, 1):
                    print(f"  {i}. {poem}")
                
                print(f"\n💡 TIPS ({len(tips)} windows):")
                for i, tip in enumerate(tips, 1):
                    print(f"  {i}. {tip}")
                
                # Check if callback was sent
                if data.get('callback_sent'):
                    print(f"\n✅ Callback sent to Vercel")
                else:
                    print(f"\n⚠️  Callback not sent (VERCEL_CALLBACK_URL may not be configured)")
                
                # Validate expected emotion
                if primary == test_case['expected_primary']:
                    print(f"\n✅ Primary emotion matches expected: {primary}")
                else:
                    print(f"\n⚠️  Primary emotion mismatch:")
                    print(f"   Expected: {test_case['expected_primary']}")
                    print(f"   Got:      {primary}")
                
                return True
            else:
                print(f"❌ Webhook failed: {data}")
                return False
        else:
            print(f"❌ Request failed: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("❌ Request timeout (>60s)")
        print("⚠️  If this is first request, Space may be cold starting - try again")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    print("\n" + "🌙"*30)
    print("ENRICHMENT API v5 - WEBHOOK TEST")
    print("🌙"*30 + "\n")
    
    print(f"Webhook URL: {HF_WEBHOOK_URL}")
    print(f"Health URL:  {HF_HEALTH_URL}\n")
    
    # Test 1: Health check
    health_ok = test_health()
    
    if not health_ok:
        print("\n⚠️  Health check failed - Space may be building or down")
        print("Check: https://huggingface.co/spaces/purist-vagabond/enrichment-api-v5")
        return
    
    # Wait a bit between requests
    time.sleep(2)
    
    # Test 2: Quick webhook test (just one emotion)
    print("\n" + "="*60)
    print("QUICK TEST: Single Enrichment")
    print("="*60)
    
    webhook_ok = test_webhook(TEST_CASES[0])
    
    if not webhook_ok:
        print("\n⚠️  Webhook test failed - check Space logs")
        return
    
    # Ask if user wants to run full test suite
    print("\n" + "="*60)
    print("Quick test passed! ✅")
    print("="*60)
    
    run_all = input("\nRun full test suite (4 emotions)? [y/N]: ").strip().lower()
    
    if run_all == 'y':
        results = []
        for test_case in TEST_CASES:
            time.sleep(2)  # Rate limiting
            result = test_webhook(test_case)
            results.append(result)
        
        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        passed = sum(results)
        total = len(results)
        print(f"Passed: {passed}/{total}")
        
        if passed == total:
            print("✅ All tests passed!")
        else:
            print(f"⚠️  {total - passed} test(s) failed")
    
    print("\n" + "="*60)
    print("NEXT STEPS")
    print("="*60)
    print("1. If tests passed, configure Vercel:")
    print("   ENRICHMENT_WEBHOOK_URL=" + HF_WEBHOOK_URL)
    print("\n2. If callback_sent=false, add Space Secret:")
    print("   VERCEL_CALLBACK_URL=https://your-app.vercel.app/api/enrichment/callback")
    print("\n3. Test end-to-end from frontend")
    print("="*60 + "\n")

if __name__ == "__main__":
    main()
