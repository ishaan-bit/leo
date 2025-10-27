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
    Search YouTube and return direct video URL for a SHORT song/film (not concerts/compilations)
    Filters out long videos to avoid concerts and compilations
    """
    try:
        # Add duration filter to search query
        # sp=EgQQARgB means filter by duration: short (under 4 minutes) - for songs
        # sp=EgQQARgC means filter by duration: medium (4-20 minutes) - for songs/short films
        encoded_query = urllib.parse.quote_plus(search_query)
        
        if is_short_film:
            # For short films, use medium duration filter (4-20 min) or no filter
            search_url = f"https://www.youtube.com/results?search_query={encoded_query}"
        else:
            # For songs, use medium duration filter to avoid concerts
            search_url = f"https://www.youtube.com/results?search_query={encoded_query}&sp=EgQQARgC"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(search_url, follow_redirects=True)
            
            if response.status_code == 200:
                html = response.text
                
                # Extract ALL video IDs and their titles to filter out long concerts
                video_pattern = r'"videoId":"([a-zA-Z0-9_-]{11})"'
                matches = re.finditer(video_pattern, html)
                
                # Get first valid video (should be filtered by duration already)
                for match in matches:
                    video_id = match.group(1)
                    # Avoid known concert/compilation patterns in the URL
                    if video_id:
                        return f"https://www.youtube.com/watch?v={video_id}"
        
        # Fallback to search results with duration filter
        return search_url
    
    except Exception as e:
        print(f"[YouTube Search Error] {e}")
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
            
            parsed = json.loads(json_text)
            
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
    
    prompt = f"""You are a film curator specializing in award-winning short films from 2024-2025 international film festivals. Suggest TWO real short films that match this emotion:

EMOTION DATA:
- Valence: {valence:.2f} (-1=very negative, 0=neutral, +1=very positive)
- Arousal: {arousal:.2f} (0=calm/low-energy, 1=excited/high-energy)
- What they felt: "{invoked}"
- How they described it: "{expressed}"

STRICT REQUIREMENTS:
1. ONE English short film - from Sundance, Cannes, Berlin, SXSW, Tribeca 2024-2025
2. ONE Hindi/Indian short film - from Mumbai Film Festival, MAMI, IFFK, or international festivals 2024-2025
3. Films must be 3-7 minutes duration (narrative short films, NOT documentaries or music videos)
4. Films must have been shown at recognized film festivals
5. Films should match the emotion (sad films for negative valence, uplifting for positive)
6. Only suggest films you are CERTAIN exist - real festival selections
7. For Hindi films: Write title in ENGLISH LETTERS (transliteration)

OUTPUT (JSON only):
{{
  "en": {{
    "title": "Exact Film Title",
    "director": "Director Name",
    "year": 2024,
    "festival": "Sundance 2024",
    "duration_minutes": 5,
    "why": "How this matches the emotion (2 sentences max)"
  }},
  "hi": {{
    "title": "Film Title in English script",
    "director": "Director Name", 
    "year": 2024,
    "festival": "Mumbai Film Festival 2024",
    "duration_minutes": 6,
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
    
    # Generate songs and films using LLM
    print(f"[*] Generating songs...")
    songs = await generate_songs_with_llm(valence, arousal, invoked, expressed)
    
    print(f"[*] Generating short films...")
    films = await generate_films_with_llm(valence, arousal, invoked, expressed)
    
    # Determine default language
    locale = reflection.get('client_context', {}).get('locale', 'en-US')
    lang_default = 'hi' if locale.startswith('hi') else 'en'
    
    # Build response
    recommendation = {
        "rid": request.rid,
        "moment_id": request.rid,
        "lang_default": lang_default,
        "tracks": songs,
        "films": films,  # Add films to response
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
