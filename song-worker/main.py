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


async def generate_songs_with_llm(
    valence: float,
    arousal: float,
    invoked: str,
    expressed: str
) -> dict:
    """Use Ollama phi3 to generate contextual song recommendations"""
    
    prompt = f"""Pick TWO songs (one English, one Hindi) from the lists below that match this emotion. 

⚠️ CRITICAL: You MUST pick songs from these exact lists. Do NOT suggest other songs even if they match better.
⚠️ If you suggest a song NOT on these lists, it will be REJECTED and replaced with a generic fallback.

EMOTION:
- Valence: {valence:.2f} (-1=very negative, 0=neutral, +1=very positive)
- Arousal: {arousal:.2f} (0=calm, 1=excited)
- Feeling: "{invoked}" / "{expressed}"

ENGLISH SONGS (pick ONE from this list ONLY):
- "Yesterday" by The Beatles (sad, melancholic)
- "The Sound of Silence" by Simon & Garfunkel (sad, withdrawn, introspective)
- "Both Sides Now" by Joni Mitchell (sad, reflective, bittersweet)
- "Bridge Over Troubled Water" by Simon & Garfunkel (sad but hopeful, comforting)
- "Here Comes The Sun" by The Beatles (happy, optimistic, uplifting)
- "Good Vibrations" by The Beach Boys (happy, excited, joyful)
- "Dancing in the Street" by Martha and the Vandellas (happy, energetic, celebratory)
- "I Can See Clearly Now" by Johnny Nash (happy, relieved, positive)
- "What a Wonderful World" by Louis Armstrong (calm, peaceful, grateful)
- "Fire and Rain" by James Taylor (calm, sad, reflective)
- "Sympathy for the Devil" by The Rolling Stones (angry, powerful, intense)
- "Born to Be Wild" by Steppenwolf (angry, rebellious, free)
- "Fortunate Son" by Creedence Clearwater Revival (angry, frustrated, protest)
- "A Change Is Gonna Come" by Sam Cooke (sad, hopeful, determined)
- "Imagine" by John Lennon (calm, peaceful, hopeful)

HINDI SONGS (pick ONE from this list ONLY):
- "Lag Jaa Gale" by Lata Mangeshkar (sad, longing, romantic)
- "Tere Bina Zindagi Se" by Lata Mangeshkar & Kishore Kumar (sad, longing)
- "Pyar Hua Ikrar Hua" by Lata Mangeshkar & Manna Dey (happy, romantic, sweet)
- "Chalte Chalte" by Kishore Kumar (happy, carefree, optimistic)
- "Yeh Dosti" by Kishore Kumar & Manna Dey (happy, friendship, energetic)
- "Mere Sapno Ki Rani" by Kishore Kumar (happy, romantic, playful)
- "Chura Liya Hai Tumne" by Asha Bhosle & Mohammed Rafi (happy, romantic)
- "Kabhi Kabhi Mere Dil Mein" by Mukesh (calm, reflective, romantic)
- "Dum Maro Dum" by Asha Bhosle (energetic, rebellious, intense)
- "Aye Mere Watan Ke Logo" by Lata Mangeshkar (emotional, patriotic, sad)

RULES:
1. Output ONLY valid JSON - no extra text, no comments, no explanations in JSON fields
2. "title" field = song title ONLY (do NOT add artist names)
3. "artist" field = artist name ONLY (short form)
4. Pick songs that match the emotion (sad→sad songs, happy→happy songs, angry→intense songs)
5. Use EXACT titles and artists from lists above

OUTPUT FORMAT (keep it short):
{{"en": {{"title": "Song", "artist": "Artist", "year": 1970, "why": "Short reason"}}, "hi": {{"title": "Song", "artist": "Artist", "year": 1970, "why": "Short reason"}}}}"""

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:  # Increased to 120s for Ollama
            response = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "phi3:latest",
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.7,  # Lower temperature for more structured output
                        "top_p": 0.9,
                        "num_predict": 300  # Shorter limit to force concise responses
                    }
                }
            )
            
            if response.status_code != 200:
                print(f"[Ollama API Error] Status: {response.status_code}, Body: {response.text}")
                raise Exception(f"Ollama API error: {response.status_code}")
            
            data = response.json()
            print(f"[Ollama] Keys: {list(data.keys())}")
            raw_response = data.get('response', '')
            if not raw_response:
                print(f"[Ollama] EMPTY - Full data: {data}")
                raise Exception("Ollama returned empty response")
            
            # Parse JSON from LLM response
            json_text = raw_response.strip()
            json_match = re.search(r'```json\s*(\{[\s\S]*?\})\s*```', raw_response) or \
                        re.search(r'(\{[\s\S]*\})', raw_response)
            
            if json_match:
                json_text = json_match.group(1)
            
            # Clean common JSON formatting issues
            # FIRST remove // comments before flattening (they can span to end of line and break JSON)
            json_text = re.sub(r'//[^\n]*', '', json_text)  # Remove // comments
            json_text = json_text.replace('\n', ' ')  # Then remove newlines
            json_text = re.sub(r',\s*}', '}', json_text)  # Remove trailing commas
            json_text = re.sub(r',\s*]', ']', json_text)  # Remove trailing commas in arrays
            
            # Fix malformed title fields where LLM adds artist (e.g., "title": "Song" by Artist feat...)
            # This breaks JSON structure - extract just the song title before " by "
            json_text = re.sub(r'"title":\s*"([^"]+?)\s+by\s+[^"]*"', r'"title": "\1"', json_text)
            
            try:
                parsed = json.loads(json_text)
                print(f"[LLM Success] Parsed songs: EN={parsed.get('en', {}).get('title')}, HI={parsed.get('hi', {}).get('title')}")
                
                # Validate BOTH English and Hindi songs are from allowed lists
                allowed_english_songs = [
                    "Yesterday", "The Sound of Silence", "Both Sides Now", "Bridge Over Troubled Water",
                    "Here Comes The Sun", "Good Vibrations", "Dancing in the Street", "I Can See Clearly Now",
                    "What a Wonderful World", "Fire and Rain", "Sympathy for the Devil", "Born to Be Wild",
                    "Fortunate Son", "A Change Is Gonna Come", "Imagine"
                ]
                allowed_hindi_songs = [
                    "Lag Jaa Gale", "Pyar Hua Ikrar Hua", "Aye Mere Watan Ke Logo",
                    "Kabhi Kabhi Mere Dil Mein", "Tere Bina Zindagi Se", "Dum Maro Dum",
                    "Chalte Chalte", "Yeh Dosti", "Mere Sapno Ki Rani", "Chura Liya Hai Tumne"
                ]
                
                # Check English song
                en_title = parsed.get('en', {}).get('title', '')
                if en_title not in allowed_english_songs:
                    print(f"[LLM REJECTED] English song '{en_title}' not in allowed list. Using emotion-based fallback.")
                    # Use emotion-based fallback with variety based on valence + arousal
                    if valence < -0.2:  # Sad
                        if arousal > 0.5:
                            parsed['en'] = {"title": "A Change Is Gonna Come", "artist": "Sam Cooke", "year": 1965, "why": "Hopeful yet sad"}
                        else:
                            parsed['en'] = {"title": "The Sound of Silence", "artist": "Simon & Garfunkel", "year": 1964, "why": "Introspective melancholic"}
                    elif valence > 0.3:  # Happy
                        if arousal > 0.6:
                            parsed['en'] = {"title": "Good Vibrations", "artist": "The Beach Boys", "year": 1966, "why": "Energetic joyful"}
                        else:
                            parsed['en'] = {"title": "Here Comes The Sun", "artist": "The Beatles", "year": 1969, "why": "Uplifting optimistic"}
                    else:  # Neutral
                        if arousal > 0.6:
                            parsed['en'] = {"title": "Born to Be Wild", "artist": "Steppenwolf", "year": 1968, "why": "Powerful energetic"}
                        else:
                            parsed['en'] = {"title": "Bridge Over Troubled Water", "artist": "Simon & Garfunkel", "year": 1970, "why": "Comforting reflective"}
                
                # Check Hindi song
                hindi_title = parsed.get('hi', {}).get('title', '')
                if hindi_title not in allowed_hindi_songs:
                    print(f"[LLM REJECTED] Hindi song '{hindi_title}' not in allowed list. Using emotion-based fallback.")
                    # Use emotion-based fallback with variety based on valence + arousal
                    if valence < -0.2:  # Sad
                        if arousal > 0.5:
                            parsed['hi'] = {"title": "Tere Bina Zindagi Se", "artist": "Lata Mangeshkar & Kishore Kumar", "year": 1975, "why": "Longing sadness"}
                        else:
                            parsed['hi'] = {"title": "Lag Jaa Gale", "artist": "Lata Mangeshkar", "year": 1964, "why": "Classic melancholic"}
                    elif valence > 0.3:  # Happy
                        if arousal > 0.6:
                            parsed['hi'] = {"title": "Yeh Dosti", "artist": "Kishore Kumar & Manna Dey", "year": 1975, "why": "Energetic friendship"}
                        else:
                            parsed['hi'] = {"title": "Pyar Hua Ikrar Hua", "artist": "Lata Mangeshkar & Manna Dey", "year": 1960, "why": "Joyful romantic"}
                    else:  # Neutral
                        if arousal > 0.6:
                            parsed['hi'] = {"title": "Dum Maro Dum", "artist": "Asha Bhosle", "year": 1971, "why": "Rebellious intense"}
                        else:
                            parsed['hi'] = {"title": "Kabhi Kabhi Mere Dil Mein", "artist": "Mukesh", "year": 1976, "why": "Reflective calm"}
                    
            except json.JSONDecodeError as e:
                print(f"[LLM Error] JSONDecodeError: {e}")
                print(f"[LLM Raw Response] {raw_response}")
                print(f"[LLM Cleaned JSON] {json_text}")
                raise Exception(f"Failed to parse LLM response - using fallback would give wrong songs")
            
            # Build response with direct YouTube URLs (search and extract first video)
            en_search = f"{parsed['en']['title']} {parsed['en']['artist']} official music video"
            hi_search = f"{parsed['hi']['title']} {parsed['hi']['artist']} official video"
            
            # Get direct YouTube URLs with duration filtering - pass song title for accurate matching
            en_url = await get_youtube_video_url(en_search, song_title=parsed['en']['title'], is_hindi=False)
            hi_url = await get_youtube_video_url(hi_search, song_title=parsed['hi']['title'], is_hindi=True)
            
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
        print(f"[CRITICAL LLM Error] {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        # Re-raise the error instead of using fallback - we want to see what's breaking
        raise HTTPException(500, f"Song generation failed: {str(e)}")

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
