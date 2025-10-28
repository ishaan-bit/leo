"""
Song Recommendation Worker - YouTube Data API v3

Uses emotion-driven genre mapping + YouTube Data API for contextual song suggestions
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
from typing import Optional, Literal, List
import os
from datetime import datetime, timezone
from dotenv import load_dotenv
import urllib.parse

# Import YouTube music selector
from youtube_music_selector import YouTubeMusicSelector

# Load environment variables
load_dotenv()

app = FastAPI(title="Song Recommendation Worker", version="3.0-youtube-api")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY") or os.getenv("GOOGLE_TRANSLATE_API_KEY", "")

# Initialize YouTube selector
youtube_selector = YouTubeMusicSelector(api_key=YOUTUBE_API_KEY) if YOUTUBE_API_KEY else None

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

async def get_youtube_video_url(search_query: str, song_title: str = "", is_hindi: bool = False, is_short_film: bool = False) -> str:
    """
    Search YouTube and return direct video URL with proper filtering:
    - Music videos: 4-5 minutes, engagement-based
    - Short films: 3-7 minutes, festival quality
    
    Args:
        search_query: Full search string including artist (e.g., "Yesterday The Beatles official music video")
        song_title: Just the song title for matching (e.g., "Yesterday")
        is_hindi: Whether this is a Hindi song
        is_short_film: Whether this is a short film
    """
    try:
        print(f"[YT Search] Query: {search_query}, Hindi: {is_hindi}")
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
            suffix = " short film" if is_short_film else ""
            # For songs, be very specific with artist name to avoid covers
            search_params = {
                "part": "id,snippet",
                "q": search_query + suffix,
                "type": "video",
                "videoDefinition": "high",  # HD videos only
                "videoDuration": "medium",  # 4-20 minutes
                "maxResults": 20,  # Increased to get more candidates
                "key": YOUTUBE_API_KEY,
                "relevanceLanguage": "en",  # Prefer English results for better matching
                "safeSearch": "none",
                "order": "relevance"  # Most relevant first
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
            
            # Step 2: Get video details for filtering + Build title map from search results
            video_ids = [item['id']['videoId'] for item in search_data['items']]
            # Create map of videoId -> snippet title for title verification
            video_titles = {item['id']['videoId']: item['snippet']['title'] for item in search_data['items']}
            
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
            
            # Step 3: Filter videos by criteria and collect candidates
            candidates = []  # Store (video_id, total_seconds, like_count, view_count, privacy_status, title)
            
            for video in videos_data.get('items', []):
                try:
                    video_id = video['id']
                    duration = video['contentDetails']['duration']  # Format: PT4M32S
                    stats = video['statistics']
                    video_status = video.get('status', {})
                    
                    # Get video title from earlier search results
                    video_title = video_titles.get(video_id, '').lower()
                    
                    # Check if video is actually playable
                    upload_status = video_status.get('uploadStatus', '')
                    privacy_status = video_status.get('privacyStatus', '')
                    
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
                    
                    like_count = int(stats.get('likeCount', 0))
                    view_count = int(stats.get('viewCount', 0))
                    
                    # Add to candidates list with title
                    candidates.append((video_id, total_seconds, like_count, view_count, privacy_status, video_title))
                    
                except (KeyError, ValueError) as e:
                    print(f"[SKIP] Error parsing video: {e}")
                    continue
            
            # Step 4: Find best match from candidates with TITLE VERIFICATION
            # Use the actual song title (passed as parameter) for matching, NOT the full search query
            # This prevents "Come Together" matching when searching for "Here Comes The Sun" (both by Beatles)
            if song_title:
                song_title_lower = song_title.lower()
            else:
                # Fallback: extract from search query (less accurate)
                song_title_lower = search_query.split(' official')[0].split(' by ')[0].lower()
            
            song_keywords = set(song_title_lower.split())
            print(f"[Title Match] Looking for keywords: {song_keywords}")
            
            # Priority 1: Perfect match (4-5 min, meets engagement criteria, title matches)
            for video_id, total_seconds, like_count, view_count, privacy_status, video_title in candidates:
                # Duration: 4-5 minutes (240-300 seconds)
                if total_seconds < 240 or total_seconds > 300:
                    continue
                
                # Title verification: at least 2 keywords from song title must appear in video title
                video_keywords = set(video_title.split())
                matching_keywords = song_keywords & video_keywords
                if len(matching_keywords) < 2:
                    print(f"[SKIP] Title mismatch: '{video_title}' doesn't match '{song_title_lower}'")
                    continue
                
                # Engagement criteria
                if is_hindi:
                    if like_count >= 50000 and view_count >= 500000:
                        lang_label = "HI"
                        print(f"[PERFECT] Found {lang_label} video {video_id}: '{video_title}' - {total_seconds}s, {like_count} likes, {view_count} views")
                        return f"https://www.youtube.com/watch?v={video_id}"
                else:
                    if like_count >= 500000 and view_count >= 1000000:
                        lang_label = "EN"
                        print(f"[PERFECT] Found {lang_label} video {video_id}: '{video_title}' - {total_seconds}s, {like_count} likes, {view_count} views")
                        return f"https://www.youtube.com/watch?v={video_id}"
            
            # Priority 2: Relaxed duration (3-7 min) but meets engagement and title matches
            for video_id, total_seconds, like_count, view_count, privacy_status, video_title in candidates:
                if total_seconds < 180 or total_seconds > 420:
                    continue
                
                # Title verification
                video_keywords = set(video_title.split())
                matching_keywords = song_keywords & video_keywords
                if len(matching_keywords) < 2:
                    print(f"[SKIP] Title mismatch: '{video_title}' doesn't match '{song_title_lower}'")
                    continue
                
                if is_hindi:
                    if like_count >= 50000 and view_count >= 500000:
                        lang_label = "HI"
                        print(f"[GOOD] Found {lang_label} video {video_id}: '{video_title}' - {total_seconds}s, {like_count} likes, {view_count} views")
                        return f"https://www.youtube.com/watch?v={video_id}"
                else:
                    if like_count >= 500000 and view_count >= 1000000:
                        lang_label = "EN"
                        print(f"[GOOD] Found {lang_label} video {video_id}: '{video_title}' - {total_seconds}s, {like_count} likes, {view_count} views")
                        return f"https://www.youtube.com/watch?v={video_id}"
            
            # Priority 3: Best available with title match - sort by engagement and pick highest
            # Filter to only candidates with matching titles first
            title_matched_candidates = []
            for video_id, total_seconds, like_count, view_count, privacy_status, video_title in candidates:
                video_keywords = set(video_title.split())
                matching_keywords = song_keywords & video_keywords
                if len(matching_keywords) >= 2:
                    title_matched_candidates.append((video_id, total_seconds, like_count, view_count, privacy_status, video_title))
            
            if title_matched_candidates:
                # Sort by (view_count * like_count) to get most popular
                candidates_sorted = sorted(title_matched_candidates, key=lambda x: x[2] * x[3], reverse=True)
                video_id, total_seconds, like_count, view_count, privacy_status, video_title = candidates_sorted[0]
                lang_label = "HI" if is_hindi else "EN"
                print(f"[FALLBACK] Using best available {lang_label} video {video_id}: '{video_title}' - {total_seconds}s, {like_count} likes, {view_count} views")
                return f"https://www.youtube.com/watch?v={video_id}"
            
            # If no title matches, just use best engagement (last resort)
            if candidates:
                candidates_sorted = sorted(candidates, key=lambda x: x[2] * x[3], reverse=True)
                video_id, total_seconds, like_count, view_count, privacy_status, video_title = candidates_sorted[0]
                lang_label = "HI" if is_hindi else "EN"
                print(f"[LAST RESORT] No title match found, using highest engagement {lang_label} video {video_id}: '{video_title}' - {total_seconds}s, {like_count} likes, {view_count} views")
                return f"https://www.youtube.com/watch?v={video_id}"
            
            # If no candidates at all, return first result
            print("[!] No valid candidates, using first search result")
            first_video_id = video_ids[0]
            return f"https://www.youtube.com/watch?v={first_video_id}"
    
    except Exception as e:
        print(f"[YouTube API Error] {e}")
        import traceback
        traceback.print_exc()
        encoded_query = urllib.parse.quote_plus(search_query)
        return f"https://www.youtube.com/results?search_query={encoded_query}"


async def generate_songs_with_youtube(
    reflection: dict,
    valence: float,
    arousal: float,
    invoked: str,
    expressed: str
) -> dict:
    """Use YouTube Data API to generate contextual song recommendations"""
    
    # Extract wheel data (primary, secondary, tertiary) from reflection
    final = reflection.get('final', {})
    wheel = final.get('wheel', {})
    primary = wheel.get('primary', '')
    secondary = wheel.get('secondary', '')
    tertiary = wheel.get('tertiary', '')
    
    # Extract tags from reflection metadata
    tags = reflection.get('tags', [])
    
    print(f"[YouTube Selector] Wheel: {primary} → {secondary} → {tertiary}")
    print(f"[YouTube Selector] Tags: {tags}")
    print(f"[YouTube Selector] Valence: {valence:.2f}, Arousal: {arousal:.2f}")
    
    # Generate songs using YouTube API selector
    try:
        # English track
        en_result = await youtube_selector.select_track(
            primary=primary,
            secondary=secondary,
            tertiary=tertiary,
            valence=valence,
            arousal=arousal,
            tags=tags,
            lang='en',
            user_id=reflection.get('uid', 'anonymous')
        )
        
        # Hindi track
        hi_result = await youtube_selector.select_track(
            primary=primary,
            secondary=secondary,
            tertiary=tertiary,
            valence=valence,
            arousal=arousal,
            tags=tags,
            lang='hi',
            user_id=reflection.get('uid', 'anonymous')
        )
        
        print(f"[YouTube Selector] EN: {en_result.get('title')} by {en_result.get('channel')} (fallback: {en_result.get('fallback_level')})")
        print(f"[YouTube Selector] HI: {hi_result.get('title')} by {hi_result.get('channel')} (fallback: {hi_result.get('fallback_level')})")
        
        # Map YouTube results to SongPick format
        en_song = {
            "title": en_result['title'],
            "artist": en_result['channel'],
            "year": 1970,  # Default era, could parse from video metadata if available
            "youtube_search": f"{en_result['title']} {en_result['channel']}",
            "youtube_url": en_result['watch_url'],
            "source_confidence": "high" if en_result['fallback_level'] == 0 else "medium" if en_result['fallback_level'] <= 2 else "low",
            "why": en_result['reason']
        }
        
        hi_song = {
            "title": hi_result['title'],
            "artist": hi_result['channel'],
            "year": 1970,
            "youtube_search": f"{hi_result['title']} {hi_result['channel']}",
            "youtube_url": hi_result['watch_url'],
            "source_confidence": "high" if hi_result['fallback_level'] == 0 else "medium" if hi_result['fallback_level'] <= 2 else "low",
            "why": hi_result['reason']
        }
        
        return {"en": en_song, "hi": hi_song}
        
    except Exception as e:
        print(f"[YouTube Selector ERROR] {e}")
        import traceback
        traceback.print_exc()
        
        # Fallback to generic songs if YouTube API fails
        return {
            "en": {
                "title": "What a Wonderful World",
                "artist": "Louis Armstrong",
                "year": 1967,
                "youtube_search": "What a Wonderful World Louis Armstrong",
                "youtube_url": "https://www.youtube.com/watch?v=VqhCQZaH4Vs",
                "source_confidence": "low",
                "why": "Fallback due to API error"
            },
            "hi": {
                "title": "Kabhi Kabhi Mere Dil Mein",
                "artist": "Mukesh",
                "year": 1976,
                "youtube_search": "Kabhi Kabhi Mere Dil Mein Mukesh",
                "source_confidence": "low",
                "why": "Fallback due to API error"
            }
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
    
    # Generate songs using YouTube API
    print(f"[*] Generating songs with YouTube API selector...")
    songs = await generate_songs_with_youtube(reflection, valence, arousal, invoked, expressed)
    
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
    
    # Check YouTube API availability
    youtube_status = "configured" if YOUTUBE_API_KEY else "missing"
    
    return {
        "status": "healthy",
        "service": "song-worker",
        "version": "3.0-youtube-api",
        "youtube_api": youtube_status,
        "upstash": "configured" if UPSTASH_REDIS_REST_URL else "missing"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5051))
    uvicorn.run(app, host="0.0.0.0", port=port)
