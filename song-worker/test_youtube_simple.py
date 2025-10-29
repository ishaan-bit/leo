import httpx
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test_youtube_api():
    api_key = os.getenv('YOUTUBE_API_KEY')
    print(f"API Key: {api_key[:10]}...{api_key[-5:]}")
    
    # Simple search test
    async with httpx.AsyncClient(timeout=30.0) as client:
        search_url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "id,snippet",
            "q": "emotional jazz blues 1970s official",
            "type": "video",
            "maxResults": 5,
            "key": api_key,
        }
        
        print(f"\nTesting search: {params['q']}")
        response = await client.get(search_url, params=params)
        
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Error: {response.text}")
        else:
            data = response.json()
            print(f"Results: {len(data.get('items', []))}")
            for item in data.get('items', [])[:3]:
                print(f"  - {item['snippet']['title']}")
                print(f"    ID: {item['id']['videoId']}")

if __name__ == "__main__":
    asyncio.run(test_youtube_api())
