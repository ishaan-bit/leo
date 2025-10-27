"""
Song Recommendation Worker - LLM-Powered (1960-1975 Era)

Uses Ollama phi3 with GPU acceleration to generate fresh, contextual song suggestions
based on emotional analysis from Stage-1 reflections.

Endpoint: POST /recommend
Body: { "rid": "reflection-id", "refresh": false }
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import json
import re
from typing import Optional, Literal
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
import urllib.parse

# Load environment variables
load_dotenv()

app = FastAPI(title="Song Recommendation Worker", version="2.0-llm")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
# Prefer an explicit YouTube key; fallback to GOOGLE_TRANSLATE_API_KEY for legacy setups
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY") or os.getenv("GOOGLE_TRANSLATE_API_KEY", "")

# Request/Response models
class SongRequest(BaseModel):
    rid: str
    refresh: bool = False

class SongPick(BaseModel):
    title: str
    artist: str
    year: int
    youtube_search: str
    youtube_url: str
    source_confidence: Literal['high', 'medium', 'low']
    why: str

class FilmPick(BaseModel):
    title: str
    director: str
    year: int
    festival: str  # e.g., "Sundance 2024", "Cannes 2024"
    duration_minutes: int
    youtube_search: str
    youtube_url: str
    source_confidence: Literal['high', 'medium', 'low']
    why: str

class SongRecommendation(BaseModel):
    rid: str
    moment_id: str
    lang_default: Literal['en', 'hi']
    tracks: dict[str, SongPick]
    embed: dict
    meta: dict

# Upstash Redis helpers
async def get_from_upstash(key: str):
    """Fetch data from Upstash Redis"""
    if not UPSTASH_REDIS_REST_URL or not UPSTASH_REDIS_REST_TOKEN:
        raise HTTPException(500, "Upstash credentials not configured")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{UPSTASH_REDIS_REST_URL}/get/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            return json.loads(data['result']) if data.get('result') else None
        return None

async def set_in_upstash(key: str, value: dict, ex: int = 86400):
    """Store data in Upstash Redis with expiry (default 24h)"""
    if not UPSTASH_REDIS_REST_URL or not UPSTASH_REDIS_REST_TOKEN:
        raise HTTPException(500, "Upstash credentials not configured")
    
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{UPSTASH_REDIS_REST_URL}/set/{key}",
            headers={"Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}"},
            json={"value": json.dumps(value), "ex": ex}
        )

def get_emotion_buckets(valence: float, arousal: float):
    """Map valence/arousal to mood buckets"""
    valence_bucket = 'negative' if valence <= -0.15 else 'positive' if valence >= 0.15 else 'neutral'
    arousal_bucket = 'low' if arousal <= 0.33 else 'high' if arousal >= 0.67 else 'medium'
    return valence_bucket, arousal_bucket

async def get_youtube_video_url(search_query: str, is_hindi: bool = False, is_short_film: bool = False) -> str:
    """
    Search YouTube and return direct video URL with proper filtering:
    - Music videos: 4-5 minutes, 500k+ likes
    - Short films: 3-7 minutes, festival quality
    """
    try:
        print(f"[DEBUG] YouTube API Key present: {bool(YOUTUBE_API_KEY)}, length: {len(YOUTUBE_API_KEY) if YOUTUBE_API_KEY else 0}")
        if not YOUTUBE_API_KEY or len(YOUTUBE_API_KEY) < 20:
            # Fallback to scraping if no API key
            print("[!] No valid YouTube API key, using search fallback")
            suffix = " short film" if is_short_film else " official music video"
            encoded_query = urllib.parse.quote_plus(search_query + suffix)
            return f"https://www.youtube.com/results?search_query={encoded_query}&sp=EgQQARgC"
        
        # Use YouTube Data API v3 to search
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Step 1: Search for videos
            search_url = "https://www.googleapis.com/youtube/v3/search"
            suffix = " short film" if is_short_film else " official music video"
            search_params = {
                "part": "id,snippet",
                "q": search_query + suffix,
                "type": "video",
                "videoDefinition": "high",  # HD videos only
                "videoDuration": "medium",  # 4-20 minutes
                "maxResults": 10,  # Get multiple to filter
                "key": YOUTUBE_API_KEY
            }
            
            search_response = await client.get(search_url, params=search_params)
            if search_response.status_code != 200:
                # Log full error body for debugging
                try:
                    err_text = search_response.text
                except Exception:
                    err_text = '<unreadable response body>'
                print(f"[!] YouTube API search error: {search_response.status_code} - {err_text}")
                encoded_query = urllib.parse.quote_plus(search_query)
                return f"https://www.youtube.com/results?search_query={encoded_query}"

            search_data = search_response.json()
            if not search_data.get('items'):
                # Log response for debugging when items are empty
                print(f"[!] YouTube search returned no items: {json.dumps(search_data)[:1000]}")
                encoded_query = urllib.parse.quote_plus(search_query)
                return f"https://www.youtube.com/results?search_query={encoded_query}"
            if not search_data.get('items'):
                print("[!] No YouTube search results")
                encoded_query = urllib.parse.quote_plus(search_query)
                return f"https://www.youtube.com/results?search_query={encoded_query}"
            
            # Step 2: Get video details for filtering
            video_ids = [item['id']['videoId'] for item in search_data['items']]
            videos_url = "https://www.googleapis.com/youtube/v3/videos"
            videos_params = {
                "part": "contentDetails,statistics,status",  # Added status for availability check
                "id": ",".join(video_ids),
                "key": YOUTUBE_API_KEY
            }
            
            videos_response = await client.get(videos_url, params=videos_params)
            if videos_response.status_code != 200:
                # Return first result if details API fails
                first_video_id = video_ids[0]
                return f"https://www.youtube.com/watch?v={first_video_id}"
            
            videos_data = videos_response.json()
            
            # Step 3: Filter videos by criteria
            for video in videos_data.get('items', []):
                try:
                    video_id = video['id']
                    duration = video['contentDetails']['duration']  # Format: PT4M32S
                    stats = video['statistics']
                    video_status = video.get('status', {})
                    
                    # Check if video is actually playable
                    upload_status = video_status.get('uploadStatus', '')
                    privacy_status = video_status.get('privacyStatus', '')
                    embeddable = video_status.get('embeddable', True)
                    
                    if upload_status != 'processed':
                        print(f"[SKIP] Video {video_id} not processed: {upload_status}")
                        continue
                    
                    if privacy_status not in ['public', 'unlisted']:
                        print(f"[SKIP] Video {video_id} not public: {privacy_status}")
                        continue
                    
                    # Parse ISO 8601 duration (PT4M32S -> 272 seconds)
                    import re
                    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
                    if not match:
                        continue
                    
                    hours = int(match.group(1) or 0)
                    minutes = int(match.group(2) or 0)
                    seconds = int(match.group(3) or 0)
                    total_seconds = hours * 3600 + minutes * 60 + seconds
                    
                    # Duration: 4-5 minutes (240-300 seconds) for both EN and HI
                    if total_seconds > 300:  # 5 minutes max
                        print(f"[SKIP] Video {video_id} too long: {total_seconds}s")
                        continue
                    if total_seconds < 240:  # 4 minutes min
                        print(f"[SKIP] Video {video_id} too short: {total_seconds}s")
                        continue
                    
                    # Relaxed criteria for Hindi songs (older Bollywood may have lower engagement)
                    if is_hindi:
                        like_count = int(stats.get('likeCount', 0))
                        if like_count < 50000:  # 50k likes minimum for Hindi
                            print(f"[SKIP] Video {video_id} not enough likes: {like_count}")
                            continue
                        
                        view_count = int(stats.get('viewCount', 0))
                        if view_count < 500000:  # 500k views minimum for Hindi
                            print(f"[SKIP] Video {video_id} not enough views: {view_count}")
                            continue
                    else:
                        # Stricter for English songs (more popular on YouTube)
                        like_count = int(stats.get('likeCount', 0))
                        if like_count < 500000:  # 500k likes minimum for English
                            print(f"[SKIP] Video {video_id} not enough likes: {like_count}")
                            continue
                        
                        view_count = int(stats.get('viewCount', 0))
                        if view_count < 1000000:  # 1M views minimum for English
                            print(f"[SKIP] Video {video_id} not enough views: {view_count}")
                            continue
                    
                    lang_label = "HI" if is_hindi else "EN"
                    print(f"[OK] Found {lang_label} video {video_id}: {total_seconds}s, {like_count} likes, {view_count} views, status={privacy_status}")
                    return f"https://www.youtube.com/watch?v={video_id}"
                    
                except (KeyError, ValueError) as e:
                    print(f"[SKIP] Error parsing video: {e}")
                    continue
            
            # If no video passed filters, return first result anyway
            print("[!] No videos passed filters, using first result")
            first_video_id = video_ids[0]
            return f"https://www.youtube.com/watch?v={first_video_id}"
    
    except Exception as e:
        print(f"[YouTube API Error] {e}")
        import traceback
        traceback.print_exc()
        encoded_query = urllib.parse.quote_plus(search_query)
        return f"https://www.youtube.com/results?search_query={encoded_query}"


async def generate_songs_with_llm(
    valence: float,
    arousal: float,
    invoked: str,
    expressed: str
) -> dict:
    """Use Ollama phi3 to generate contextual song recommendations"""
    
    prompt = f"""You are a music curator with encyclopedic knowledge of 1960-1975 songs. Suggest TWO real, verifiable songs that match this emotion:

EMOTION DATA:
- Valence: {valence:.2f} (-1=very negative, 0=neutral, +1=very positive)
- Arousal: {arousal:.2f} (0=calm/low-energy, 1=excited/high-energy)
- What they felt: "{invoked}"
- How they described it: "{expressed}"

STRICT REQUIREMENTS:
1. ONE English song - must be a REAL song from 1960-1975 (The Beatles, Rolling Stones, Dylan, Simon & Garfunkel, etc.)
2. ONE Hindi song - must be a REAL Bollywood/ghazal from 1960-1975 (Lata, Kishore, Rafi, Asha, etc.)
   - For Hindi songs: Write the title in ENGLISH LETTERS (transliteration), NOT Devanagari script
   - Example: "Lag Jaa Gale" NOT "लग जा गले"
   - Example: "Pyar Kiya To Darna Kya" NOT "प्यार किया तो डरना क्या"
   - IMPORTANT: Suggest DIFFERENT Hindi songs based on the emotion - don't always use "Lag Jaa Gale"
   - Consider variety: Kishore Kumar, Mohammed Rafi, Asha Bhosle, Mukesh, etc.
3. Songs must match the valence (emotion positivity/negativity) and arousal (energy level)
4. Only suggest songs you are CERTAIN exist - no invented titles
5. Match the SPECIFIC emotion - happy songs for positive valence, sad songs for negative valence

OUTPUT (JSON only):
{{
  "en": {{
    "title": "Exact Song Title",
    "artist": "Exact Artist Name",
    "year": 1970,
    "why": "How this matches the emotion (2 sentences max)"
  }},
  "hi": {{
    "title": "Song Title in English script (e.g., 'Lag Jaa Gale')",
    "artist": "Artist Name",
    "year": 1970,
    "why": "How this matches the emotion (2 sentences max)"
  }}
}}"""

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:  # Increased to 120s for Ollama
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "phi3:latest",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.8,
                        "top_p": 0.9,
                        "num_predict": 500,
                    }
                }
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code}")
            
            data = response.json()
            raw_response = data.get('response', '')
            
            # Parse JSON from LLM response
            json_text = raw_response.strip()
            json_match = re.search(r'```json\s*(\{[\s\S]*?\})\s*```', raw_response) or \
                        re.search(r'(\{[\s\S]*\})', raw_response)
            
            if json_match:
                json_text = json_match.group(1)
            
            # Clean common JSON formatting issues
            json_text = json_text.replace('\n', ' ')  # Remove newlines
            json_text = re.sub(r',\s*}', '}', json_text)  # Remove trailing commas
            json_text = re.sub(r',\s*]', ']', json_text)  # Remove trailing commas in arrays
            
            try:
                parsed = json.loads(json_text)
            except json.JSONDecodeError as e:
                print(f"[LLM Error] JSONDecodeError: {e}")
                print(f"[LLM Raw] {raw_response[:500]}")
                # Fallback: Use default songs
                return {
                    "en": SongPick(
                        title="Here Comes The Sun",
                        artist="The Beatles",
                        year=1969,
                        youtube_search="Here Comes The Sun The Beatles official",
                        youtube_url=await get_youtube_video_url("Here Comes The Sun The Beatles official", is_hindi=False),
                        source_confidence='medium',
                        why="Classic uplifting song with positive emotions"
                    ).model_dump(),
                    "hi": SongPick(
                        title="Pyar Hua Ikrar Hua",
                        artist="Lata Mangeshkar, Manna Dey",
                        year=1955,
                        youtube_search="Pyar Hua Ikrar Hua original song",
                        youtube_url=await get_youtube_video_url("Pyar Hua Ikrar Hua original song", is_hindi=True),
                        source_confidence='medium',
                        why="Timeless romantic melody with gentle emotions"
                    ).model_dump()
                }
            
            # Build response with direct YouTube URLs (search and extract first video)
            en_search = f"{parsed['en']['title']} {parsed['en']['artist']} official"
            hi_search = f"{parsed['hi']['title']} {parsed['hi']['artist']} original song"
            
            # Get direct YouTube URLs with duration filtering
            en_url = await get_youtube_video_url(en_search, is_hindi=False)
            hi_url = await get_youtube_video_url(hi_search, is_hindi=True)
            
            return {
                "en": SongPick(
                    title=parsed['en']['title'],
                    artist=parsed['en']['artist'],
                    year=int(parsed['en']['year']),
                    youtube_search=en_search,
                    youtube_url=en_url,
                    source_confidence='high',
                    why=parsed['en']['why']
                ).model_dump(),
                "hi": SongPick(
                    title=parsed['hi']['title'],
                    artist=parsed['hi']['artist'],
                    year=int(parsed['hi']['year']),
                    youtube_search=hi_search,
                    youtube_url=hi_url,
                    source_confidence='high',
                    why=parsed['hi']['why']
                ).model_dump()
            }
    
    except Exception as e:
        print(f"[LLM Error] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        # Fallback songs
        return {
            "en": SongPick(
                title="Here Comes the Sun",
                artist="The Beatles",
                year=1969,
                youtube_search="Here Comes the Sun The Beatles official",
                youtube_url="https://www.youtube.com/watch?v=KQetemT1sWc",
                source_confidence='medium',
                why="Fallback: Gentle, hopeful melody (LLM unavailable)"
            ).model_dump(),
            "hi": SongPick(
                title="Lag Jaa Gale",
                artist="Lata Mangeshkar",
                year=1964,
                youtube_search="Lag Jaa Gale Lata Mangeshkar original",
                youtube_url="https://www.youtube.com/watch?v=Q8Pk5Bq1IVo",
                source_confidence='medium',
                why="Fallback: Tender ghazal (LLM unavailable)"
            ).model_dump()
        }

async def generate_films_with_llm(
    valence: float,
    arousal: float,
    invoked: str,
    expressed: str
) -> dict:
    """Use Ollama phi3 to generate contextual short film recommendations"""
    
    prompt = f"""You are a film curator specializing in award-winning short films from 2020-2025 international film festivals. Suggest TWO real short films that match this emotion:

EMOTION DATA:
- Valence: {valence:.2f} (-1=very negative, 0=neutral, +1=very positive)
- Arousal: {arousal:.2f} (0=calm/low-energy, 1=excited/high-energy)
- What they felt: "{invoked}"
- How they described it: "{expressed}"

STRICT REQUIREMENTS:
1. ONE English short film - from Sundance, Cannes, Berlin, SXSW, Tribeca, or popular on YouTube (2020-2025)
2. ONE Hindi/Indian short film - from Mumbai Film Festival, MAMI, IFFK, or popular on YouTube (2020-2025)
3. Films must be 4-5 minutes duration (narrative short films, NOT documentaries or music videos)
4. Films should be well-known with high engagement (popular festival films or viral shorts)
5. Films should match the emotion (sad films for negative valence, uplifting for positive)
6. Only suggest films you are CERTAIN exist and are available on YouTube
7. For Hindi films: Write title in ENGLISH LETTERS (transliteration)

OUTPUT (JSON only):
{{
  "en": {{
    "title": "Exact Film Title",
    "director": "Director Name",
    "year": 2023,
    "festival": "Sundance 2023",
    "duration_minutes": 5,
    "why": "How this matches the emotion (2 sentences max)"
  }},
  "hi": {{
    "title": "Film Title in English script",
    "director": "Director Name", 
    "year": 2023,
    "festival": "Mumbai Film Festival 2023",
    "duration_minutes": 4,
    "why": "How this matches the emotion (2 sentences max)"
  }}
}}"""

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "phi3:latest",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.8,
                        "top_p": 0.9,
                        "num_predict": 500,
                    }
                }
            )
            
            if response.status_code != 200:
                raise Exception(f"Ollama API error: {response.status_code}")
            
            data = response.json()
            raw_response = data.get('response', '')
            
            # Parse JSON from LLM response
            json_text = raw_response.strip()
            json_match = re.search(r'```json\s*(\{[\s\S]*?\})\s*```', raw_response) or \
                        re.search(r'(\{[\s\S]*\})', raw_response)
            
            if json_match:
                json_text = json_match.group(1)
            
            parsed = json.loads(json_text)
            
            # Build response with direct YouTube URLs
            en_search = f"{parsed['en']['title']} {parsed['en']['director']} short film"
            hi_search = f"{parsed['hi']['title']} {parsed['hi']['director']} short film"
            
            # Get direct YouTube URLs
            en_url = await get_youtube_video_url(en_search, is_short_film=True)
            hi_url = await get_youtube_video_url(hi_search, is_short_film=True)
            
            return {
                "en": FilmPick(
                    title=parsed['en']['title'],
                    director=parsed['en']['director'],
                    year=int(parsed['en']['year']),
                    festival=parsed['en']['festival'],
                    duration_minutes=int(parsed['en']['duration_minutes']),
                    youtube_search=en_search,
                    youtube_url=en_url,
                    source_confidence='high',
                    why=parsed['en']['why']
                ).model_dump(),
                "hi": FilmPick(
                    title=parsed['hi']['title'],
                    director=parsed['hi']['director'],
                    year=int(parsed['hi']['year']),
                    festival=parsed['hi']['festival'],
                    duration_minutes=int(parsed['hi']['duration_minutes']),
                    youtube_search=hi_search,
                    youtube_url=hi_url,
                    source_confidence='high',
                    why=parsed['hi']['why']
                ).model_dump()
            }
    
    except Exception as e:
        print(f"[Film LLM Error] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        # Fallback films (well-known festival shorts)
        return {
            "en": FilmPick(
                title="The Neighbors' Window",
                director="Marshall Curry",
                year=2020,
                festival="Sundance 2020",
                duration_minutes=20,
                youtube_search="The Neighbors Window Marshall Curry short film",
                youtube_url="https://www.youtube.com/results?search_query=The+Neighbors+Window+Marshall+Curry",
                source_confidence='medium',
                why="Fallback: Award-winning emotional short (LLM unavailable)"
            ).model_dump(),
            "hi": FilmPick(
                title="Ghar Ki Murgi",
                director="Arjun Kamath",
                year=2020,
                festival="MAMI 2020",
                duration_minutes=15,
                youtube_search="Ghar Ki Murgi short film",
                youtube_url="https://www.youtube.com/results?search_query=Ghar+Ki+Murgi+short+film",
                source_confidence='medium',
                why="Fallback: Festival short (LLM unavailable)"
            ).model_dump()
        }

@app.post("/recommend", response_model=SongRecommendation)
async def recommend_songs(request: SongRequest):
    """
    Generate song recommendations for a reflection
    
    Analyzes emotion data (valence, arousal, invoked, expressed) and returns
    two era-specific songs (1 Hindi, 1 English from 1960-1975)
    """
    try:
        # Fetch reflection from Upstash
        reflection = await get_from_upstash(f"reflection:{request.rid}")
        if not reflection:
            raise HTTPException(404, f"Reflection not found: {request.rid}")
        
        print(f"DEBUG: Reflection type: {type(reflection)}")
        print(f"DEBUG: Reflection keys: {list(reflection.keys())[:10] if isinstance(reflection, dict) else 'NOT A DICT'}")
        
        # Extract emotion data (nested under 'final')
        final = reflection.get('final', {})
        if not final:
            print("WARNING: 'final' key is empty or missing")
            print(f"DEBUG: Available top-level keys: {list(reflection.keys())}")
        
        valence = final.get('valence', 0.0)
        arousal = final.get('arousal', 0.5)
        invoked = final.get('invoked', '')
        expressed = final.get('expressed', '')
        
        print(f"DEBUG: Extracted - valence={valence}, arousal={arousal}, invoked='{invoked}', expressed='{expressed}'")
    except Exception as e:
        print(f"ERROR in recommend_songs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Internal error: {str(e)}")
    
    # Calculate mood buckets
    valence_bucket, arousal_bucket = get_emotion_buckets(valence, arousal)
    mood_cell = f"{valence_bucket}-{arousal_bucket}"
    
    # Generate songs using LLM
    print(f"[*] Generating songs with YouTube API filtering...")
    songs = await generate_songs_with_llm(valence, arousal, invoked, expressed)
    
    # Determine default language
    locale = reflection.get('client_context', {}).get('locale', 'en-US')
    lang_default = 'hi' if locale.startswith('hi') else 'en'
    
    # Build response
    recommendation = {
        "rid": request.rid,
        "moment_id": request.rid,
        "lang_default": lang_default,
        "tracks": songs,
        "embed": {
            "mode": "youtube_iframe",
            "embed_when_lang_is": {
                "en": songs['en']['youtube_url'],
                "hi": songs['hi']['youtube_url']
            }
        },
        "meta": {
            "valence_bucket": valence_bucket,
            "arousal_bucket": arousal_bucket,
            "mood_cell": mood_cell,
            "picked_at": datetime.now(timezone.utc).isoformat(),
            "version": "song-worker-v2-llm"
        }
    }
    
    # NOTE: Not caching here - enrichment worker saves songs to reflection:{rid}
    # This avoids duplicate keys like songs:{rid}
    
    return recommendation

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    
    # Check Ollama availability
    ollama_status = "unknown"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{OLLAMA_URL}/api/tags")
            ollama_status = "ok" if response.status_code == 200 else "error"
    except:
        ollama_status = "unavailable"
    
    return {
        "status": "healthy",
        "service": "song-worker",
        "version": "2.0-llm",
        "ollama": ollama_status,
        "upstash": "configured" if UPSTASH_REDIS_REST_URL else "missing"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5051))
    uvicorn.run(app, host="0.0.0.0", port=port)
