import os
import httpx
from dotenv import load_dotenv
load_dotenv()
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY') or os.getenv('GOOGLE_TRANSLATE_API_KEY', '')
search_query = 'Here Comes The Sun The Beatles official music video'
params = {
    'part': 'id,snippet',
    'q': search_query + ' official music video',
    'type': 'video',
    'videoDefinition': 'high',
    'videoDuration': 'medium',
    'maxResults': 10,
    'key': YOUTUBE_API_KEY
}
print('Using key length:', len(YOUTUBE_API_KEY))
import asyncio
async def main():
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get('https://www.googleapis.com/youtube/v3/search', params=params)
        print('status', r.status_code)
        try:
            print(r.text[:2000])
        except Exception as e:
            print('error reading body', e)

asyncio.run(main())
