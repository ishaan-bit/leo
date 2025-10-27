import os
import json
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv()
UPSTASH_URL = os.getenv('UPSTASH_REDIS_REST_URL')
UPSTASH_TOKEN = os.getenv('UPSTASH_REDIS_REST_TOKEN')
SONG_WORKER = 'http://localhost:5051'

reflection_key = 'reflection:test-rid'
reflection = {
    "rid": "test-rid",
    "sid": "s-test",
    "timestamp": "2025-10-27T00:00:00Z",
    "pig_id": "p1",
    "pig_name_snapshot": "TestPig",
    "raw_text": "I feel overwhelmed but trying to move forward",
    "normalized_text": "I feel overwhelmed",
    "lang_detected": "en",
    "input_mode": "typing",
    "typing_summary": "",
    "final": {
        "valence": 0.2,
        "arousal": 0.65,
        "invoked": "overwhelm + worry + progress",
        "expressed": "determined / worried / overwhelmed"
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
        print('Upstash set status:', r.status_code, r.text[:200])

        # Call recommend
        rec_url = f"{SONG_WORKER}/recommend"
        rec_payload = {"rid": "test-rid", "refresh": False}
        r2 = await client.post(rec_url, json=rec_payload, timeout=180.0)
        print('Recommend status:', r2.status_code)
        try:
            print('Recommend response:', json.dumps(r2.json(), indent=2)[:2000])
        except Exception as e:
            print('Recommend raw:', r2.text[:2000])

if __name__ == '__main__':
    asyncio.run(main())
