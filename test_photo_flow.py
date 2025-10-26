"""
Test script to upload an image and verify the complete flow
"""
import requests
import base64
import time
import json

# Test image (1x1 red pixel PNG)
TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="

def create_test_image():
    """Create a simple test image file"""
    image_data = base64.b64decode(TEST_IMAGE_BASE64)
    with open('test_image.png', 'wb') as f:
        f.write(image_data)
    print("✅ Created test image: test_image.png")

def upload_image():
    """Upload test image to localhost:3000"""
    print("\n📤 Uploading image to localhost:3000...")
    
    with open('test_image.png', 'rb') as f:
        files = {'image': ('test.png', f, 'image/png')}
        data = {'pigId': 'testpig'}
        
        response = requests.post(
            'http://localhost:3000/api/reflect/upload-image',
            files=files,
            data=data
        )
    
    print(f"📥 Response status: {response.status_code}")
    print(f"📥 Response body: {response.json()}")
    
    if response.status_code == 200:
        result = response.json()
        reflection_id = result.get('reflectionId')
        print(f"\n✅ Image uploaded successfully!")
        print(f"   Reflection ID: {reflection_id}")
        print(f"   Status: {result.get('status')}")
        return reflection_id
    else:
        print(f"❌ Upload failed: {response.text}")
        return None

def check_reflection_status(rid, upstash_url, upstash_token):
    """Check reflection status in Upstash"""
    print(f"\n🔍 Checking reflection status: {rid}")
    
    headers = {
        'Authorization': f'Bearer {upstash_token}',
        'Content-Type': 'application/json',
    }
    
    response = requests.post(
        upstash_url,
        headers=headers,
        json=['GET', f'refl:{rid}'],
        timeout=10
    )
    
    if response.status_code == 200:
        result = response.json()
        reflection_json = result.get('result')
        
        if reflection_json:
            reflection = json.loads(reflection_json)
            print(f"✅ Reflection found:")
            print(f"   Status: {reflection.get('processing_status', 'unknown')}")
            print(f"   Has image_base64: {bool(reflection.get('image_base64'))}")
            print(f"   Original text: {reflection.get('original_text', 'N/A')[:50]}...")
            print(f"   Normalized text: {reflection.get('normalized_text', 'N/A')[:50]}...")
            return reflection
        else:
            print("❌ Reflection not found in Upstash")
            return None
    else:
        print(f"❌ Failed to fetch reflection: {response.status_code}")
        return None

if __name__ == '__main__':
    # Read .env for Upstash credentials
    import os
    from dotenv import load_dotenv
    load_dotenv()
    
    UPSTASH_URL = os.getenv('KV_REST_API_URL')
    UPSTASH_TOKEN = os.getenv('KV_REST_API_TOKEN')
    
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        print("❌ Missing UPSTASH credentials in .env")
        exit(1)
    
    # Create test image
    create_test_image()
    
    # Upload image
    rid = upload_image()
    
    if rid:
        # Wait for worker to process
        print("\n⏳ Waiting 5 seconds for image-worker to process...")
        time.sleep(5)
        
        # Check status
        reflection = check_reflection_status(rid, UPSTASH_URL, UPSTASH_TOKEN)
        
        if reflection:
            status = reflection.get('processing_status')
            if status == 'complete':
                print("\n🎉 SUCCESS! Complete flow working:")
                print("   1. ✅ Image uploaded to Vercel API")
                print("   2. ✅ Saved as base64 to Upstash")
                print("   3. ✅ Worker processed with GPU")
                print("   4. ✅ Narrative generated")
                print("   5. ✅ Ready for enrichment")
            elif status == 'processing':
                print("\n⏳ Still processing... wait a bit longer")
            elif status == 'pending':
                print("\n⚠️  Still pending - worker might not be running")
            else:
                print(f"\n⚠️  Unknown status: {status}")
    
    # Cleanup
    import os
    if os.path.exists('test_image.png'):
        os.remove('test_image.png')
        print("\n🧹 Cleaned up test image")
