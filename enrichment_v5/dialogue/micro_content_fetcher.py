"""
Fetch dialogue content from micro-content-api HF Space.
Replaces local generation with remote JSON lookup based on domain_primary + wheel_secondary.
"""

import json
import logging
from typing import Dict, List, Tuple, Optional
import requests
from functools import lru_cache

logger = logging.getLogger(__name__)

# HF Space URL for micro-content-api (raw URL to get JSON directly)
MICRO_CONTENT_API_URL = "https://huggingface.co/spaces/purist-vagabond/micro-content-api/raw/main/data/micro_today.json"

# Cache the JSON file for 5 minutes to avoid repeated downloads
_CACHE: Optional[Dict] = None
_CACHE_TIMESTAMP: float = 0
CACHE_TTL = 300  # 5 minutes


def fetch_micro_content() -> Dict:
    """
    Fetch micro_today.json from HF Space with caching.
    
    Returns:
        Dict with structure: {
            "work": {
                "Frustrated": {
                    "parsed": {
                        "pig1": "...",
                        "window1": "...",
                        "pig2": "...",
                        "window2": "...",
                        "pig3": "...",
                        "window3": "..."
                    },
                    "energy": "fleabag",
                    "timestamp": "..."
                }
            }
        }
    """
    global _CACHE, _CACHE_TIMESTAMP
    
    import time
    current_time = time.time()
    
    # Return cached data if still valid
    if _CACHE is not None and (current_time - _CACHE_TIMESTAMP) < CACHE_TTL:
        logger.debug("Using cached micro_today.json")
        return _CACHE
    
    try:
        logger.info(f"Fetching micro_today.json from {MICRO_CONTENT_API_URL}")
        response = requests.get(MICRO_CONTENT_API_URL, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        # Update cache
        _CACHE = data
        _CACHE_TIMESTAMP = current_time
        
        logger.info(f"Successfully loaded micro_today.json with {len(data)} domain primaries")
        return data
    
    except Exception as e:
        logger.error(f"Failed to fetch micro_today.json: {e}")
        
        # If cache exists, return stale cache as fallback
        if _CACHE is not None:
            logger.warning("Using stale cache as fallback")
            return _CACHE
        
        # No cache available - return empty dict
        return {}


def normalize_secondary(secondary: Optional[str]) -> str:
    """
    Normalize wheel secondary to match JSON keys.
    
    Args:
        secondary: Wheel secondary emotion (e.g., "Optimistic", None)
        
    Returns:
        Normalized secondary or "None" for null values
    """
    if secondary is None or secondary == "null" or secondary == "":
        return "None"
    
    # Capitalize first letter, lowercase rest (e.g., "optimistic" -> "Optimistic")
    return secondary.strip().capitalize()


def normalize_domain_primary(domain_primary: Optional[str]) -> str:
    """
    Normalize domain primary to match JSON keys.
    
    Args:
        domain_primary: Domain primary (e.g., "work", "self")
        
    Returns:
        Normalized domain primary or "self" as default
    """
    if domain_primary is None or domain_primary == "null" or domain_primary == "":
        return "self"
    
    # Lowercase
    return domain_primary.strip().lower()


def build_dialogue_from_micro_content(
    data: Dict,
    user_id: str = "default_user"
) -> Tuple[List[str], List[str], Dict]:
    """
    Build dialogue (poems + tips) by fetching from micro-content-api.
    
    Args:
        data: Enrichment result dict with domain.primary, secondary, etc.
        user_id: User identifier (currently unused, kept for API compatibility)
        
    Returns:
        Tuple of (poems, tips, meta)
        - poems: List of 3 Pig lines
        - tips: List of 3 Window rituals
        - meta: Dict with source info
    """
    try:
        # Fetch micro content JSON
        micro_content = fetch_micro_content()
        
        if not micro_content:
            raise ValueError("Micro content JSON is empty or unavailable")
        
        # Extract domain primary and wheel secondary from enrichment data
        domain = data.get('domain', {})
        domain_primary = normalize_domain_primary(domain.get('primary', 'self'))
        
        # Note: wheel.secondary is the Willcox Feelings Wheel secondary emotion
        # This is different from data.get('secondary') which is also wheel secondary
        wheel_secondary = normalize_secondary(data.get('secondary'))
        
        logger.info(f"Looking up dialogue for domain={domain_primary}, secondary={wheel_secondary}")
        
        # Navigate nested structure: micro_content[domain][secondary]["parsed"]
        if domain_primary not in micro_content:
            logger.warning(f"Domain {domain_primary} not found, trying fallback: self")
            domain_primary = "self"
        
        domain_data = micro_content.get(domain_primary)
        if not domain_data:
            raise ValueError(f"Domain {domain_primary} not found in micro content")
        
        if wheel_secondary not in domain_data:
            logger.warning(f"Secondary {wheel_secondary} not found in {domain_primary}, trying None")
            wheel_secondary = "None"
        
        dialogue_entry = domain_data.get(wheel_secondary)
        if not dialogue_entry:
            raise ValueError(f"No dialogue found for {domain_primary}/{wheel_secondary}")
        
        # Extract parsed dialogue
        parsed = dialogue_entry.get('parsed', {})
        
        # Build poems from pig1, pig2, pig3
        poems = [
            parsed.get('pig1', 'noted.'),
            parsed.get('pig2', 'here.'),
            parsed.get('pig3', 'okay.')
        ]
        
        # Build tips from window1, window2, window3
        tips = [
            parsed.get('window1', 'pause.'),
            parsed.get('window2', 'breathe.'),
            parsed.get('window3', 'notice.')
        ]
        
        # Meta information
        meta = {
            'source': 'micro-content-api',
            'domain_primary': domain_primary,
            'wheel_secondary': wheel_secondary,
            'energy': dialogue_entry.get('energy', 'unknown'),
            'timestamp': dialogue_entry.get('timestamp', ''),
            'found': True
        }
        
        logger.info(f"Successfully fetched dialogue for {domain_primary}/{wheel_secondary}")
        return poems, tips, meta
    
    except Exception as e:
        logger.error(f"Micro content dialogue fetch failed: {e}")
        
        # Safe fallback
        return (
            ['noted.', 'here.', 'okay.'],
            ['pause.', 'breathe.', 'notice.'],
            {
                'source': 'fallback',
                'error': str(e)
            }
        )
