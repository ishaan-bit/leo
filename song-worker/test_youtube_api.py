import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def test_youtube_api():
    key = os.getenv('YOUTUBE_API_KEY')
    
    print(f"API Key exists: {bool(key)}")
    if key:
        print(f"API Key length: {len(key)}")
        print(f"API Key preview: {key[:20]}...{key[-10:]}")
    
    if not key:
        print("ERROR: No YouTube API key found in .env")
        return
    
    # Test the API with a simple search
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            'https://www.googleapis.com/youtube/v3/search',
            params={
                'part': 'id,snippet',
                'q': 'yesterday beatles official',
                'type': 'video',
                'maxResults': 1,
                'key': key
            }
        )
        
        print(f"\nAPI Response Status: {response.status_code}")
        print(f"Response body: {response.text[:1000]}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get('items'):
                video = data['items'][0]
                video_id = video['id']['videoId']
                title = video['snippet']['title']
                print(f"\nSUCCESS! Found video:")
                print(f"  Title: {title}")
                print(f"  Video ID: {video_id}")
                print(f"  URL: https://www.youtube.com/watch?v={video_id}")
            else:
                print("\nNo items returned")
        else:
            print(f"\nERROR: API returned status {response.status_code}")

asyncio.run(test_youtube_api())
