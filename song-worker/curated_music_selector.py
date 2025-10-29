"""
Curated Music Selector - Uses pre-selected artist/track combinations with YouTube validation
Replaces complex search logic with curated JSONs + API validation
"""

import os
import json
import logging
from typing import Dict, Optional, Tuple
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from dotenv import load_dotenv
import redis
import time

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CuratedMusicSelector:
    def __init__(self):
        self.api_key = os.getenv('YOUTUBE_API_KEY')
        if not self.api_key:
            raise ValueError("YOUTUBE_API_KEY not found in environment")
        
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        
        # Load curated song libraries
        self.english_songs = self._load_json('../apps/web/public/audio/english songs.json')
        self.hindi_songs = self._load_json('../apps/web/public/audio/hindi songs.json')
        
        # Redis for rotation tracking
        redis_url = os.getenv('UPSTASH_REDIS_REST_URL', '')
        redis_token = os.getenv('UPSTASH_REDIS_REST_TOKEN', '')
        
        if redis_url and redis_token:
            # For Upstash REST API, we don't need Redis client
            # Just store credentials for HTTP requests
            self.upstash_url = redis_url
            self.upstash_token = redis_token
            self.redis_client = None  # Use HTTP REST API instead
            logger.info("✅ Upstash REST API configured for song rotation tracking")
        else:
            self.upstash_url = None
            self.upstash_token = None
            self.redis_client = None
            logger.warning("⚠️ Redis not configured, rotation tracking disabled")
        
        logger.info(f"✅ Loaded {len(self.english_songs)} English emotion combos")
        logger.info(f"✅ Loaded {len(self.hindi_songs)} Hindi emotion combos")
    
    def _load_json(self, path: str) -> list:
        """Load JSON file relative to this script"""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(script_dir, path)
        
        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.info(f"✅ Loaded {full_path}")
                return data
        except Exception as e:
            logger.error(f"❌ Failed to load {full_path}: {e}")
            return []
    
    def _get_rotation_index(self, user_id: str, primary: str, secondary: str, tertiary: str, lang: str) -> int:
        """
        Get next rotation index (0-3) for this user + emotion combo
        Rotates through 4 song choices, cycles back to 0 after 3
        """
        if not self.upstash_url or not self.upstash_token:
            return 0  # No rotation without Redis
        
        key = f"song_rotation:{user_id}:{lang}:{primary}:{secondary}:{tertiary}"
        
        try:
            import httpx
            
            # GET current value
            response = httpx.get(
                f"{self.upstash_url}/get/{key}",
                headers={"Authorization": f"Bearer {self.upstash_token}"},
                timeout=2.0
            )
            
            if response.status_code == 200:
                data = response.json()
                current = data.get('result')
                if current is None:
                    index = 0
                else:
                    index = (int(current) + 1) % 4  # Rotate 0→1→2→3→0
            else:
                index = 0
            
            # SET new index with 90-day expiry
            httpx.post(
                f"{self.upstash_url}/set/{key}",
                headers={"Authorization": f"Bearer {self.upstash_token}"},
                json={"value": str(index), "ex": 90 * 24 * 60 * 60},
                timeout=2.0
            )
            
            logger.info(f"🔄 Rotation for {user_id} [{lang}] {primary}/{secondary}/{tertiary}: choice #{index + 1}")
            return index
            
        except Exception as e:
            logger.warning(f"⚠️ Redis rotation failed: {e}, using index 0")
            return 0
    
    def _find_emotion_combo(self, library: list, primary: str, secondary: str, tertiary: str) -> Optional[Dict]:
        """Find exact match for primary/secondary/tertiary in library"""
        for entry in library:
            if (entry.get('primary') == primary and 
                entry.get('secondary') == secondary and 
                entry.get('tertiary') == tertiary):
                return entry
        return None
    
    def _validate_youtube_url(self, artist: str, track: str) -> Optional[str]:
        """
        Search YouTube for artist + track, validate result
        Returns: YouTube URL if valid video found, None otherwise
        
        Filters:
        - Duration < 10 minutes
        - Decent view count (>1000)
        - Prefer music videos
        """
        try:
            search_query = f"{artist} {track}"
            logger.info(f"🔍 Searching YouTube: '{search_query}'")
            
            request = self.youtube.search().list(
                part='snippet',
                q=search_query,
                type='video',
                maxResults=5,  # Get top 5 to filter
                videoCategoryId='10',  # Music category
                order='relevance'
            )
            
            response = request.execute()
            
            if not response.get('items'):
                logger.warning(f"⚠️ No results for: {search_query}")
                return None
            
            # Get video IDs to fetch details
            video_ids = [item['id']['videoId'] for item in response['items']]
            
            # Get video details (duration, view count)
            details_request = self.youtube.videos().list(
                part='contentDetails,statistics,snippet',
                id=','.join(video_ids)
            )
            
            details_response = details_request.execute()
            
            for video in details_response.get('items', []):
                video_id = video['id']
                duration_iso = video['contentDetails']['duration']
                view_count = int(video['statistics'].get('viewCount', 0))
                title = video['snippet']['title'].lower()
                
                # Parse ISO 8601 duration (PT4M33S → 273 seconds)
                duration_seconds = self._parse_iso_duration(duration_iso)
                
                # Filters
                if duration_seconds > 600:  # > 10 minutes
                    logger.info(f"⏭️ Skipping (too long): {duration_seconds}s")
                    continue
                
                if view_count < 1000:  # Low view count
                    logger.info(f"⏭️ Skipping (low views): {view_count}")
                    continue
                
                # Prefer music videos (check title)
                is_music_video = any(kw in title for kw in ['official', 'music video', 'audio', 'lyric'])
                
                youtube_url = f"https://www.youtube.com/watch?v={video_id}"
                logger.info(f"✅ Found valid video: {youtube_url} ({duration_seconds}s, {view_count:,} views, music_video={is_music_video})")
                
                return youtube_url
            
            logger.warning(f"⚠️ No valid videos found for: {search_query} (all filtered out)")
            return None
            
        except HttpError as e:
            logger.error(f"❌ YouTube API error: {e}")
            return None
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            return None
    
    def _parse_iso_duration(self, duration: str) -> int:
        """
        Parse ISO 8601 duration to seconds
        PT4M33S → 273 seconds
        PT1H2M30S → 3750 seconds
        """
        import re
        
        hours = 0
        minutes = 0
        seconds = 0
        
        # Match patterns
        h_match = re.search(r'(\d+)H', duration)
        m_match = re.search(r'(\d+)M', duration)
        s_match = re.search(r'(\d+)S', duration)
        
        if h_match:
            hours = int(h_match.group(1))
        if m_match:
            minutes = int(m_match.group(1))
        if s_match:
            seconds = int(s_match.group(1))
        
        return hours * 3600 + minutes * 60 + seconds
    
    def select_track(
        self, 
        primary: str, 
        secondary: str, 
        tertiary: str,
        language: str = 'en',
        user_id: str = 'default'
    ) -> Tuple[str, str, str]:
        """
        Select YouTube URL for emotion combination
        
        Args:
            primary: Primary emotion (sad, mad, scared, joyful, peaceful, powerful)
            secondary: Secondary emotion (lonely, hurt, etc.)
            tertiary: Tertiary emotion (isolated, abandoned, etc.)
            language: 'en' for English, 'hi' for Hindi
            user_id: User ID for rotation tracking
        
        Returns:
            Tuple of (youtube_url, artist, track_name)
        """
        logger.info(f"🎵 Selecting track: {primary}/{secondary}/{tertiary} [{language}] for user {user_id}")
        
        # Choose library
        library = self.english_songs if language == 'en' else self.hindi_songs
        
        # Find emotion combo
        combo = self._find_emotion_combo(library, primary, secondary, tertiary)
        
        if not combo:
            logger.error(f"❌ Emotion combo not found: {primary}/{secondary}/{tertiary}")
            return self._get_fallback()
        
        # Get rotation index
        rotation_index = self._get_rotation_index(user_id, primary, secondary, tertiary, language)
        
        # Get song choices (4 artists)
        songs = combo.get('songs', {})
        song_keys = list(songs.keys())
        
        if not song_keys:
            logger.error(f"❌ No songs for combo: {primary}/{secondary}/{tertiary}")
            return self._get_fallback()
        
        # Pick song based on rotation (cycles through 4 choices)
        song_key = song_keys[rotation_index % len(song_keys)]
        selected_song = songs[song_key]
        
        artist = selected_song['artist']
        track = selected_song['track']
        
        logger.info(f"🎸 Selected (choice #{rotation_index + 1}): {artist} - {track}")
        
        # Validate on YouTube
        youtube_url = self._validate_youtube_url(artist, track)
        
        if youtube_url:
            return (youtube_url, artist, track)
        else:
            # Validation failed, try next rotation choice
            logger.warning(f"⚠️ YouTube validation failed for {artist} - {track}, trying next choice...")
            
            # Try other choices in rotation
            for i in range(1, len(song_keys)):
                next_index = (rotation_index + i) % len(song_keys)
                next_key = song_keys[next_index]
                next_song = songs[next_key]
                
                next_artist = next_song['artist']
                next_track = next_song['track']
                
                logger.info(f"🔄 Trying choice #{next_index + 1}: {next_artist} - {next_track}")
                
                next_url = self._validate_youtube_url(next_artist, next_track)
                
                if next_url:
                    return (next_url, next_artist, next_track)
            
            # All choices failed, use fallback
            logger.error(f"❌ All choices failed for {primary}/{secondary}/{tertiary}, using fallback")
            return self._get_fallback()
    
    def _get_fallback(self) -> Tuple[str, str, str]:
        """Fallback song if all else fails"""
        return (
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "Rick Astley",
            "Never Gonna Give You Up"
        )


# Test function
if __name__ == "__main__":
    selector = CuratedMusicSelector()
    
    # Test cases
    test_cases = [
        # English
        ("sad", "lonely", "isolated", "en", "user123"),
        ("mad", "frustrated", "annoyed", "en", "user123"),
        ("joyful", "excited", "energetic", "en", "user456"),
        
        # Hindi
        ("sad", "lonely", "isolated", "hi", "user789"),
        ("peaceful", "content", "satisfied", "hi", "user789"),
    ]
    
    for primary, secondary, tertiary, lang, user in test_cases:
        print(f"\n{'='*60}")
        url, artist, track = selector.select_track(primary, secondary, tertiary, lang, user)
        print(f"[OK] Result: {artist} - {track}")
        print(f"[URL] {url}")
        time.sleep(1)  # Rate limit
