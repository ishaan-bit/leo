import os
import json
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()
UPSTASH_URL = os.getenv('UPSTASH_REDIS_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN')
SONG_WORKER = 'http://localhost:5051'

reflection_key = 'reflection:test-films'
reflection = {
    "rid": "test-films",
    "sid": "s-test",
    "timestamp": "2025-10-27T00:00:00Z",
    "pig_id": "p1",
    "pig_name_snapshot": "TestPig",
    "raw_text": "I feel hopeful and inspired",
    "normalized_text": "I feel hopeful",
    "lang_detected": "en",
    "input_mode": "typing",
    "typing_summary": "",
    "final": {
        "valence": 0.7,
        "arousal": 0.5,
        "invoked": "hope + inspiration + peace",
        "expressed": "hopeful / inspired / calm"
    },
    "client_context": {"locale": "en-US"}
}

async def main():
    if not UPSTASH_URL or not UPSTASH_TOKEN:
        print('Upstash env not configured')
        return

    async with httpx.AsyncClient() as client:
        # Set reflection
        set_url = f"{UPSTASH_URL}/set/{reflection_key}"
        value = json.dumps(reflection)
        payload = {"value": value, "ex": 3600}
        headers = {"Authorization": f"Bearer {UPSTASH_TOKEN}", "Content-Type": "application/json"}
        r = await client.post(set_url, headers=headers, json=payload)
        print('Upstash set status:', r.status_code)

        # Call recommend
        rec_url = f"{SONG_WORKER}/recommend"
        rec_payload = {"rid": "test-films", "refresh": False}
        print('\nCalling song worker...\n')
        r2 = await client.post(rec_url, json=rec_payload, timeout=240.0)
        print(f'\nRecommend status: {r2.status_code}')
        
        if r2.status_code == 200:
            data = r2.json()
            print('\n=== SONGS ===')
            print(f"EN: {data['tracks']['en']['title']} - {data['tracks']['en']['artist']}")
            print(f"    URL: {data['tracks']['en']['youtube_url']}")
            print(f"HI: {data['tracks']['hi']['title']} - {data['tracks']['hi']['artist']}")
            print(f"    URL: {data['tracks']['hi']['youtube_url']}")
            
            print('\n=== FILMS ===')
            print(f"EN: {data['films']['en']['title']} - {data['films']['en']['director']}")
            print(f"    URL: {data['films']['en']['youtube_url']}")
            print(f"HI: {data['films']['hi']['title']} - {data['films']['hi']['director']}")
            print(f"    URL: {data['films']['hi']['youtube_url']}")
        else:
            print('Error response:', r2.text[:1000])

if __name__ == '__main__':
    asyncio.run(main())
