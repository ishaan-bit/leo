"""
YouTube Music Selector - Emotion-Driven API v3 Search

Replaces Ollama-based selection with:
1. Willcox emotion → Genre mapping
2. YouTube Data API v3 search with filters
3. Duration/embeddable/view threshold validation
4. 24h no-repeat per-user caching (E1: persisted to Upstash Redis)
5. Progressive fallback logic
"""

import httpx
import re
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import os

# Genre mapping: Willcox → YouTube search keywords
# English (EN) cluster
GENRE_MAP_EN = {
    # Sad primaries
    ("Sad", "lonely"): {"genre": "jazz blues", "keywords": ["lonely", "isolation", "blues"], "era": "1960s|1970s|1980s"},
    ("Sad", "vulnerable"): {"genre": "singer-songwriter ballad", "keywords": ["vulnerable", "fragile", "soft"], "era": "1970s"},
    ("Sad", "despair"): {"genre": "blues", "keywords": ["despair", "sorrow", "blues"], "era": "1960s|1970s"},
    ("Sad", "guilty"): {"genre": "folk", "keywords": ["regret", "guilt", "confessional"], "era": "1970s"},
    ("Sad", "abandoned"): {"genre": "soul ballad", "keywords": ["abandoned", "left alone", "soul"], "era": "1960s|1970s"},
    ("Sad", "bored"): {"genre": "soft rock", "keywords": ["numb", "detached", "melancholy"], "era": "1970s"},
    
    # Angry primaries
    ("Angry", "let down"): {"genre": "rock", "keywords": ["betrayal", "resentment", "rock"], "era": "1970s|1980s"},
    ("Angry", "humiliated"): {"genre": "punk", "keywords": ["anger", "defiance", "punk"], "era": "1970s"},
    ("Angry", "bitter"): {"genre": "blues rock", "keywords": ["bitter", "wronged", "blues"], "era": "1970s"},
    ("Angry", "mad"): {"genre": "rock", "keywords": ["furious", "rage", "rock"], "era": "1970s|1980s"},
    ("Angry", "aggressive"): {"genre": "hard rock", "keywords": ["aggressive", "hostile", "hard rock"], "era": "1970s"},
    ("Angry", "frustrated"): {"genre": "rock", "keywords": ["frustrated", "annoyed", "rock"], "era": "1970s"},
    
    # Fearful primaries
    ("Fearful", "scared"): {"genre": "ambient", "keywords": ["fear", "anxiety", "atmospheric"], "era": "1970s|1980s"},
    ("Fearful", "anxious"): {"genre": "chamber pop", "keywords": ["anxious", "worried", "introspective"], "era": "1970s"},
    ("Fearful", "insecure"): {"genre": "folk", "keywords": ["insecure", "uncertain", "folk"], "era": "1970s"},
    ("Fearful", "weak"): {"genre": "ballad", "keywords": ["powerless", "weak", "ballad"], "era": "1970s"},
    ("Fearful", "rejected"): {"genre": "soul", "keywords": ["rejected", "excluded", "soul"], "era": "1960s|1970s"},
    ("Fearful", "threatened"): {"genre": "dark ambient", "keywords": ["threat", "danger", "dark"], "era": "1970s|1980s"},
    
    # Happy primaries
    ("Happy", "optimistic"): {"genre": "soul motown", "keywords": ["hopeful", "optimistic", "uplifting"], "era": "1960s|1970s"},
    ("Happy", "trusting"): {"genre": "folk", "keywords": ["trust", "warmth", "folk"], "era": "1970s"},
    ("Happy", "peaceful"): {"genre": "jazz ballad", "keywords": ["peaceful", "calm", "serene"], "era": "1960s|1970s"},
    ("Happy", "powerful"): {"genre": "funk", "keywords": ["powerful", "confident", "funk"], "era": "1970s"},
    ("Happy", "accepted"): {"genre": "soul", "keywords": ["loved", "accepted", "soul"], "era": "1960s|1970s"},
    ("Happy", "proud"): {"genre": "funk soul", "keywords": ["proud", "accomplished", "triumph"], "era": "1970s"},
    
    # Peaceful primaries
    ("Peaceful", "loving"): {"genre": "jazz ballad", "keywords": ["loving", "tender", "romantic"], "era": "1950s|1960s"},
    ("Peaceful", "optimistic"): {"genre": "folk", "keywords": ["hope", "renewal", "folk"], "era": "1970s"},
    ("Peaceful", "intimate"): {"genre": "chamber jazz", "keywords": ["intimate", "close", "soft jazz"], "era": "1960s"},
    ("Peaceful", "thankful"): {"genre": "gospel soul", "keywords": ["grateful", "thankful", "soul"], "era": "1960s|1970s"},
    ("Peaceful", "content"): {"genre": "soft rock", "keywords": ["content", "satisfied", "mellow"], "era": "1970s"},
    ("Peaceful", "pensive"): {"genre": "folk", "keywords": ["reflective", "thoughtful", "folk"], "era": "1970s"},
    
    # Strong primaries
    ("Strong", "confident"): {"genre": "funk", "keywords": ["confident", "powerful", "funk"], "era": "1970s"},
    ("Strong", "proud"): {"genre": "soul", "keywords": ["pride", "strong", "soul"], "era": "1970s"},
    ("Strong", "important"): {"genre": "disco", "keywords": ["important", "valued", "disco"], "era": "1970s"},
    ("Strong", "hopeful"): {"genre": "rock", "keywords": ["hopeful", "determined", "rock"], "era": "1970s"},
    ("Strong", "creative"): {"genre": "psychedelic", "keywords": ["creative", "free", "psychedelic"], "era": "1960s|1970s"},
    ("Strong", "successful"): {"genre": "funk", "keywords": ["success", "achievement", "funk"], "era": "1970s"},
}

# Hindi (HI) cluster
GENRE_MAP_HI = {
    # Sad primaries
    ("Sad", "lonely"): {"genre": "ghazal", "keywords": ["tanhai", "lonely", "ghazal"], "era": "1970s|1980s"},
    ("Sad", "vulnerable"): {"genre": "filmi ballad", "keywords": ["nazuk", "vulnerable", "ballad"], "era": "1970s"},
    ("Sad", "despair"): {"genre": "ghazal", "keywords": ["udaas", "despair", "ghazal"], "era": "1970s|1980s"},
    ("Sad", "guilty"): {"genre": "filmi sad", "keywords": ["guilt", "regret", "bollywood"], "era": "1970s"},
    ("Sad", "abandoned"): {"genre": "ghazal", "keywords": ["bewafa", "betrayal", "ghazal"], "era": "1970s|1980s"},
    ("Sad", "bored"): {"genre": "filmi mellow", "keywords": ["bore", "monotone", "bollywood"], "era": "1970s"},
    
    # Angry primaries
    ("Angry", "let down"): {"genre": "qawwali", "keywords": ["betrayal", "anger", "qawwali"], "era": "1970s|1980s"},
    ("Angry", "humiliated"): {"genre": "filmi dramatic", "keywords": ["insult", "anger", "bollywood"], "era": "1970s"},
    ("Angry", "bitter"): {"genre": "ghazal", "keywords": ["bitter", "resentment", "ghazal"], "era": "1970s|1980s"},
    ("Angry", "mad"): {"genre": "filmi intense", "keywords": ["gussa", "mad", "bollywood"], "era": "1970s"},
    ("Angry", "aggressive"): {"genre": "qawwali", "keywords": ["intense", "power", "qawwali"], "era": "1970s"},
    ("Angry", "frustrated"): {"genre": "filmi", "keywords": ["frustration", "anger", "bollywood"], "era": "1970s"},
    
    # Fearful primaries
    ("Fearful", "scared"): {"genre": "filmi suspense", "keywords": ["fear", "scared", "bollywood"], "era": "1970s"},
    ("Fearful", "anxious"): {"genre": "light classical", "keywords": ["anxiety", "worry", "classical"], "era": "1970s"},
    ("Fearful", "insecure"): {"genre": "ghazal", "keywords": ["insecurity", "doubt", "ghazal"], "era": "1970s|1980s"},
    ("Fearful", "weak"): {"genre": "filmi sad", "keywords": ["weak", "powerless", "bollywood"], "era": "1970s"},
    ("Fearful", "rejected"): {"genre": "ghazal", "keywords": ["rejection", "dard", "ghazal"], "era": "1970s|1980s"},
    ("Fearful", "threatened"): {"genre": "filmi dramatic", "keywords": ["threat", "danger", "bollywood"], "era": "1970s"},
    
    # Happy primaries
    ("Happy", "optimistic"): {"genre": "filmi upbeat", "keywords": ["khushi", "happy", "bollywood"], "era": "1970s"},
    ("Happy", "trusting"): {"genre": "filmi romantic", "keywords": ["trust", "love", "bollywood"], "era": "1970s"},
    ("Happy", "peaceful"): {"genre": "bhajan", "keywords": ["peace", "calm", "devotional"], "era": "1970s"},
    ("Happy", "powerful"): {"genre": "filmi energetic", "keywords": ["power", "energy", "bollywood"], "era": "1970s"},
    ("Happy", "accepted"): {"genre": "filmi celebration", "keywords": ["acceptance", "joy", "bollywood"], "era": "1970s"},
    ("Happy", "proud"): {"genre": "filmi patriotic", "keywords": ["pride", "achievement", "bollywood"], "era": "1970s"},
    
    # Peaceful primaries
    ("Peaceful", "loving"): {"genre": "ghazal romantic", "keywords": ["mohabbat", "love", "ghazal"], "era": "1970s|1980s"},
    ("Peaceful", "optimistic"): {"genre": "filmi hopeful", "keywords": ["hope", "positive", "bollywood"], "era": "1970s"},
    ("Peaceful", "intimate"): {"genre": "ghazal soft", "keywords": ["intimate", "close", "ghazal"], "era": "1970s|1980s"},
    ("Peaceful", "thankful"): {"genre": "bhajan", "keywords": ["gratitude", "thanks", "devotional"], "era": "1970s"},
    ("Peaceful", "content"): {"genre": "filmi mellow", "keywords": ["content", "peaceful", "bollywood"], "era": "1970s"},
    ("Peaceful", "pensive"): {"genre": "light classical", "keywords": ["reflective", "thoughtful", "classical"], "era": "1970s"},
    
    # Strong primaries
    ("Strong", "confident"): {"genre": "filmi energetic", "keywords": ["confidence", "power", "bollywood"], "era": "1970s"},
    ("Strong", "proud"): {"genre": "filmi patriotic", "keywords": ["pride", "strength", "bollywood"], "era": "1970s"},
    ("Strong", "important"): {"genre": "filmi dramatic", "keywords": ["importance", "value", "bollywood"], "era": "1970s"},
    ("Strong", "hopeful"): {"genre": "filmi uplifting", "keywords": ["hope", "strength", "bollywood"], "era": "1970s"},
    ("Strong", "creative"): {"genre": "fusion", "keywords": ["creative", "unique", "fusion"], "era": "1970s|1980s"},
    ("Strong", "successful"): {"genre": "filmi celebration", "keywords": ["success", "victory", "bollywood"], "era": "1970s"},
}

# Note: recent_plays_cache is now persisted to Upstash Redis (E1)
# Key format: "song_history:{user_id}"
# Value format: JSON array of {"video_id": str, "ts": ISO timestamp}


class YouTubeMusicSelector:
    """
    YouTube Data API v3 music selector with emotion-driven search
    E1: Now persists 24h no-repeat cache to Upstash Redis
    """
    
    def __init__(self, api_key: str, upstash_url: Optional[str] = None, upstash_token: Optional[str] = None):
        self.api_key = api_key
        self.base_url = "https://www.googleapis.com/youtube/v3"
        self.upstash_url = upstash_url
        self.upstash_token = upstash_token
    
    async def select_track(
        self,
        primary: str,
        secondary: Optional[str],
        tertiary: Optional[str],
        invoked: List[str],
        expressed: List[str],
        tags: List[str],
        lang: str,  # 'en' or 'hi'
        user_id: str,
        valence: float = 0.5,
        arousal: float = 0.5
    ) -> Dict:
        """
        Select a YouTube video track based on emotion mapping
        
        Returns:
            {
                "video_id": str,
                "title": str,
                "channel": str,
                "duration_seconds": int,
                "view_count": int,
                "watch_url": str,
                "embed_url": str,
                "reason": str,
                "fallback_level": int  # 0=perfect, 1=relaxed, 2=broadened, 3=curated
            }
        """
        # Step 1: Map emotion to genre + keywords
        genre_map = GENRE_MAP_EN if lang == 'en' else GENRE_MAP_HI
        emotion_key = (primary, secondary) if secondary else (primary, primary)
        
        # Fallback to primary-only if no exact match
        if emotion_key not in genre_map:
            # Try just primary
            for key in genre_map.keys():
                if key[0] == primary:
                    emotion_key = key
                    break
        
        if emotion_key not in genre_map:
            # Last resort: use generic mapping
            if lang == 'en':
                genre_config = {"genre": "jazz blues", "keywords": ["emotional", "introspective"], "era": "1970s"}
            else:
                genre_config = {"genre": "ghazal", "keywords": ["dard", "感情"], "era": "1970s|1980s"}
        else:
            genre_config = genre_map[emotion_key]
        
        # Step 2: Build search query
        seed_keywords = tags[:2] if tags else genre_config["keywords"][:2]
        query = f"{' '.join(seed_keywords)} {genre_config['genre']} {genre_config['era']} official"
        
        print(f"[YouTube Search] Query: {query} (lang={lang})")
        
        # Step 3: Try progressive fallback thresholds
        fallback_attempts = [
            {"min_views": 50000 if lang == 'en' else 10000, "max_duration": 360, "level": 0, "desc": "strict"},
            {"min_views": 25000 if lang == 'en' else 5000, "max_duration": 420, "level": 1, "desc": "relaxed"},
            {"min_views": 10000 if lang == 'en' else 2000, "max_duration": 480, "level": 2, "desc": "broadened"},
        ]
        
        for attempt in fallback_attempts:
            try:
                result = await self._search_with_filters(
                    query=query,
                    user_id=user_id,
                    min_views=attempt["min_views"],
                    max_duration_sec=attempt["max_duration"],
                    lang=lang
                )
                
                if result:
                    result["fallback_level"] = attempt["level"]
                    result["reason"] = f"{genre_config['genre']} match ({attempt['desc']} criteria)"
                    print(f"[YouTube Success] {attempt['desc']} match: {result['title']}")
                    return result
            except Exception as e:
                print(f"[YouTube Fallback {attempt['level']}] Failed: {e}")
                continue
        
        # Step 4: Last resort - curated library
        print(f"[YouTube] All API attempts failed, using curated fallback")
        return self._get_curated_fallback(primary, secondary, lang, valence, arousal)
    
    async def _search_with_filters(
        self,
        query: str,
        user_id: str,
        min_views: int,
        max_duration_sec: int,
        lang: str
    ) -> Optional[Dict]:
        """
        Search YouTube API and filter by criteria
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Search for video IDs
            search_response = await client.get(
                f"{self.base_url}/search",
                params={
                    "part": "id,snippet",
                    "q": query,
                    "type": "video",
                    "videoEmbeddable": "true",
                    "maxResults": 20,
                    "key": self.api_key,
                    "relevanceLanguage": "hi" if lang == 'hi' else "en",
                }
            )
            
            if search_response.status_code != 200:
                raise Exception(f"YouTube API error: {search_response.status_code} - {search_response.text}")
            
            search_data = search_response.json()
            video_ids = [item["id"]["videoId"] for item in search_data.get("items", [])]
            
            if not video_ids:
                return None
            
            # Step 2: Get video details (duration, stats, embeddable status)
            videos_response = await client.get(
                f"{self.base_url}/videos",
                params={
                    "part": "contentDetails,statistics,status,snippet",
                    "id": ",".join(video_ids[:50]),  # Batch up to 50
                    "key": self.api_key
                }
            )
            
            if videos_response.status_code != 200:
                raise Exception(f"YouTube videos API error: {videos_response.status_code}")
            
            videos_data = videos_response.json()
            
            # Step 3: Filter candidates
            candidates = []
            for video in videos_data.get("items", []):
                video_id = video["id"]
                
                # E1: Check if recently played by this user (Redis-backed)
                if await self._was_recently_played(user_id, video_id):
                    print(f"[Skip] {video_id} - played in last 24h")
                    continue
                
                # Parse duration (ISO 8601: PT3M22S)
                duration_iso = video["contentDetails"]["duration"]
                duration_sec = self._parse_iso_duration(duration_iso)
                
                if duration_sec > max_duration_sec or duration_sec < 120:  # Min 2 min, max configurable
                    continue
                
                # Check embeddable
                if not video["status"].get("embeddable", False):
                    continue
                
                # Check view count
                view_count = int(video["statistics"].get("viewCount", 0))
                if view_count < min_views:
                    continue
                
                # Valid candidate
                candidates.append({
                    "video_id": video_id,
                    "title": video["snippet"]["title"],
                    "channel": video["snippet"]["channelTitle"],
                    "duration_seconds": duration_sec,
                    "view_count": view_count,
                })
            
            if not candidates:
                return None
            
            # Step 4: Pick best candidate (highest view count)
            best = max(candidates, key=lambda x: x["view_count"])
            
            # E1: Record in cache (Redis-backed, 24h TTL)
            await self._record_play(user_id, best["video_id"])
            
            # Return with URLs
            return {
                **best,
                "watch_url": f"https://www.youtube.com/watch?v={best['video_id']}",
                "embed_url": f"https://www.youtube-nocookie.com/embed/{best['video_id']}?rel=0&modestbranding=1",
            }
    
    def _parse_iso_duration(self, iso: str) -> int:
        """Parse ISO 8601 duration (PT3M22S) to seconds"""
        match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso)
        if not match:
            return 0
        
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        return hours * 3600 + minutes * 60 + seconds
    
    async def _was_recently_played(self, user_id: str, video_id: str) -> bool:
        """
        E1: Check if video was played by user in last 24h (Upstash Redis)
        """
        if not self.upstash_url or not self.upstash_token:
            # Fallback: no caching if Upstash not configured
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.upstash_url}/get/song_history:{user_id}",
                    headers={"Authorization": f"Bearer {self.upstash_token}"}
                )
                
                if response.status_code != 200:
                    return False
                
                data = response.json()
                if not data.get('result'):
                    return False
                
                # Parse stored history
                history = json.loads(data['result'])
                if not isinstance(history, list):
                    return False
                
                # Check if video was played in last 24h
                cutoff = datetime.now() - timedelta(hours=24)
                for entry in history:
                    if entry.get('video_id') == video_id:
                        ts = datetime.fromisoformat(entry['ts'])
                        if ts > cutoff:
                            return True
                
                return False
        except Exception as e:
            print(f"[E1 Cache Check Error] {e}")
            return False  # Fail open (allow selection)
    
    async def _record_play(self, user_id: str, video_id: str):
        """
        E1: Record that user played this video (Upstash Redis with 24h auto-expire)
        """
        if not self.upstash_url or not self.upstash_token:
            return
        
        try:
            # Fetch current history
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.upstash_url}/get/song_history:{user_id}",
                    headers={"Authorization": f"Bearer {self.upstash_token}"}
                )
                
                history = []
                if response.status_code == 200:
                    data = response.json()
                    if data.get('result'):
                        history = json.loads(data['result'])
                        if not isinstance(history, list):
                            history = []
                
                # Remove entries older than 24h
                cutoff = datetime.now() - timedelta(hours=24)
                history = [
                    entry for entry in history
                    if datetime.fromisoformat(entry['ts']) > cutoff
                ]
                
                # Add new entry
                history.append({
                    'video_id': video_id,
                    'ts': datetime.now().isoformat()
                })
                
                # Store back (24h TTL)
                await client.post(
                    f"{self.upstash_url}/set/song_history:{user_id}",
                    headers={"Authorization": f"Bearer {self.upstash_token}"},
                    json=json.dumps(history),
                    params={"EX": 86400}  # 24 hours
                )
        except Exception as e:
            print(f"[E1 Record Play Error] {e}")
    
    def _get_curated_fallback(
        self,
        primary: str,
        secondary: Optional[str],
        lang: str,
        valence: float,
        arousal: float
    ) -> Dict:
        """
        Curated library fallback for when API fails
        """
        # Small hand-picked library per mood (replace with your actual curated tracks)
        curated_en = {
            "sad_low": {"video_id": "dQw4w9WgXcQ", "title": "The Thrill Is Gone", "channel": "BB King"},  # Placeholder
            "sad_high": {"video_id": "dQw4w9WgXcQ", "title": "Comfortably Numb", "channel": "Pink Floyd"},
            "happy_low": {"video_id": "dQw4w9WgXcQ", "title": "What a Wonderful World", "channel": "Louis Armstrong"},
            "happy_high": {"video_id": "dQw4w9WgXcQ", "title": "Good Vibrations", "channel": "The Beach Boys"},
        }
        
        curated_hi = {
            "sad_low": {"video_id": "dQw4w9WgXcQ", "title": "Lag Jaa Gale", "channel": "Lata Mangeshkar"},
            "sad_high": {"video_id": "dQw4w9WgXcQ", "title": "Ranjish Hi Sahi", "channel": "Mehdi Hassan"},
            "happy_low": {"video_id": "dQw4w9WgXcQ", "title": "Pyar Hua Ikrar Hua", "channel": "Lata & Manna Dey"},
            "happy_high": {"video_id": "dQw4w9WgXcQ", "title": "Aaj Kal Tere Mere", "channel": "Kishore Kumar"},
        }
        
        library = curated_en if lang == 'en' else curated_hi
        
        # Pick based on valence/arousal
        if valence < 0:
            key = "sad_high" if arousal > 0.5 else "sad_low"
        else:
            key = "happy_high" if arousal > 0.5 else "happy_low"
        
        fallback = library[key]
        return {
            **fallback,
            "duration_seconds": 240,
            "view_count": 1000000,
            "watch_url": f"https://www.youtube.com/watch?v={fallback['video_id']}",
            "embed_url": f"https://www.youtube-nocookie.com/embed/{fallback['video_id']}?rel=0&modestbranding=1",
            "reason": "Curated fallback",
            "fallback_level": 3,
        }
