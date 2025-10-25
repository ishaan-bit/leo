#!/usr/bin/env python3
"""
Quick test script for image captioning service
Tests the API endpoint with a sample image
"""

import requests
import sys

def test_caption_service(image_path, custom_prompt=None):
    """Test the /caption endpoint with an image."""
    
    url = 'http://localhost:5050/caption'
    
    try:
        with open(image_path, 'rb') as img_file:
            files = {'image': img_file}
            data = {}
            
            if custom_prompt:
                data['prompt'] = custom_prompt
            
            print(f"📤 Uploading: {image_path}")
            response = requests.post(url, files=files, data=data)
            
            if response.ok:
                result = response.json()
                print(f"\n✅ Success!")
                print(f"Model: {result.get('model')}")
                print(f"\nNarrative:\n{result.get('narrative')}\n")
            else:
                print(f"❌ Error: {response.status_code}")
                print(response.text)
    
    except FileNotFoundError:
        print(f"❌ Image file not found: {image_path}")
    except requests.exceptions.ConnectionError:
        print(f"❌ Could not connect to service. Is it running on port 5050?")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python test_service.py <image_path> [custom_prompt]")
        print("\nExample:")
        print("  python test_service.py photo.jpg")
        print("  python test_service.py sunset.png 'Describe this image poetically'")
        sys.exit(1)
    
    image_path = sys.argv[1]
    custom_prompt = sys.argv[2] if len(sys.argv) > 2 else None
    
    test_caption_service(image_path, custom_prompt)
