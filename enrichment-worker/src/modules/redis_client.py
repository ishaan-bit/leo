"""
Redis Client for Upstash
Handles reading/writing reflections from/to Redis using REST API
"""

import requests
import json
from typing import Optional, List, Dict
import os


class RedisClient:
    """Redis client for Upstash REST API"""
    
    def __init__(
        self, 
        url: str,
        token: str
    ):
        """
        Initialize Redis REST client
        
        Args:
            url: Upstash REST API URL (https://...)
            token: Upstash REST API token
        """
        self.url = url.rstrip('/')
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def _execute(self, command: List) -> Optional[any]:
        """Execute Redis command via REST API"""
        try:
            response = requests.post(
                self.url,
                json=command,
                headers=self.headers,
                timeout=60  # Increased from 10s - large payloads (images) need more time
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get('result')
            else:
                print(f"[X] Redis command failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"[X] Redis REST error: {e}")
            return None
    
    def ping(self) -> bool:
        """Check if Redis is reachable"""
        result = self._execute(['PING'])
        return result == 'PONG'
    
    def get(self, key: str) -> Optional[str]:
        """Get value by key"""
        return self._execute(['GET', key])
    
    def set(self, key: str, value: str, ex: int = None) -> bool:
        """Set key-value with optional expiry"""
        if ex:
            result = self._execute(['SET', key, value, 'EX', ex])
        else:
            result = self._execute(['SET', key, value])
        return result == 'OK'
    
    def get_reflection(self, rid: str) -> Optional[Dict]:
        """
        Get reflection by ID
        
        Args:
            rid: Reflection ID
        
        Returns:
            Reflection dict or None
        """
        key = f"reflection:{rid}"
        data = self.get(key)
        if data:
            try:
                return json.loads(data)
            except:
                return None
        return None
    
    def set_enriched(self, rid: str, enriched_data: Dict, ttl: int = 2592000) -> bool:
        """
        Merge enriched data into existing reflection
        Supports both authenticated (global) and guest (namespaced) reflections
        
        Args:
            rid: Reflection ID
            enriched_data: Enriched reflection dict with analytics
            ttl: Time-to-live in seconds (default 30 days)
        
        Returns:
            Success boolean
        """
        # Try to find reflection in guest namespace first, then global
        key = None
        existing = None
        
        # First, try global namespace (most common case for authenticated users)
        global_key = f"reflection:{rid}"
        existing = self.get(global_key)
        
        if existing:
            try:
                parsed = json.loads(existing)
                # Check if this is actually a guest reflection
                sid = parsed.get('sid') or parsed.get('session_id')
                user_id = parsed.get('user_id') or parsed.get('userId')
                
                # If no userId but has session_id starting with sid_, it's a guest
                if not user_id and sid and sid.startswith('sid_'):
                    print(f"[!] Found guest reflection in global namespace: {global_key}")
                    print(f"    Session: {sid}, No user_id")
                    print(f"    Checking guest namespace...")
                    
                    # Extract guest UID and check guest namespace
                    guest_uid = sid[4:] if sid.startswith('sid_') else sid  # Strip 'sid_' prefix
                    guest_key = f"guest:{guest_uid}:reflection:{rid}"
                    guest_data = self.get(guest_key)
                    
                    if guest_data:
                        print(f"    Found in guest namespace: {guest_key}")
                        key = guest_key
                        existing = guest_data
                        ttl = 300  # 5 minutes for guests
                    else:
                        print(f"    Not in guest namespace, using global key")
                        key = global_key
                else:
                    # Authenticated user
                    key = global_key
            except json.JSONDecodeError:
                print(f"[!] Failed to parse reflection {global_key}, using as-is")
                key = global_key
        else:
            # Not in global namespace - might be a pure guest reflection
            # We can't determine the guest UID without the existing reflection
            # This shouldn't happen in normal flow (reflection should exist before enrichment)
            print(f"[!] Reflection {rid} not found in global namespace")
            print(f"    Cannot determine guest namespace without existing reflection")
            print(f"    This may be a race condition - reflection not yet written")
            return False
        
        if not existing:
            print(f"[!] Reflection {rid} not found in any namespace")
            return False
        
        # Parse existing reflection
        try:
            reflection = json.loads(existing)
        except json.JSONDecodeError:
            print(f"[!] Failed to parse existing reflection")
            return False
        
        # Merge enriched data into existing reflection
        merged = {**reflection, **enriched_data}
        
        # Write back to same key with appropriate TTL
        success = self.set(key, json.dumps(merged), ex=ttl)
        if success:
            print(f"[OK] Merged enriched data into {key}")
            print(f"    TTL: {ttl}s ({'guest' if ttl == 300 else 'authenticated'})")
        else:
            print(f"[X] Failed to write enriched data to {key}")
        
        return success
    
    def get_enriched(self, rid: str) -> Optional[Dict]:
        """
        Get reflection with enrichment (same as get_reflection now)
        
        Args:
            rid: Reflection ID
        
        Returns:
            Reflection dict with enriched fields or None
        """
        return self.get_reflection(rid)
    
    def zrevrange(self, key: str, start: int, stop: int) -> List[str]:
        """Get sorted set members in reverse order"""
        result = self._execute(['ZREVRANGE', key, start, stop])
        return result if result else []
    
    def get_user_history(self, sid: str, limit: int = 90) -> List[Dict]:
        """
        Get user's reflection history (for temporal analytics)
        
        Args:
            sid: Session ID
            limit: Max number of reflections to fetch
        
        Returns:
            List of reflections (newest first)
        """
        # Get sorted set of reflection IDs for this session
        owner_key = f"reflections:sess_{sid}"
        
        # Get RIDs from sorted set (newest first)
        rids = self.zrevrange(owner_key, 0, limit - 1)
        
        if not rids:
            return []
        
        # Fetch each reflection
        reflections = []
        for rid in rids:
            refl = self.get_reflection(rid)
            if refl:
                reflections.append(refl)
        
        return reflections
    
    def set_worker_status(self, status: str, details: Dict = None) -> bool:
        """
        Update worker status in Redis
        
        Args:
            status: Status string (e.g., "healthy", "degraded", "down")
            details: Optional details dict
        
        Returns:
            Success boolean
        """
        key = "worker:status"
        data = {
            'status': status,
            'timestamp': datetime.now().isoformat(),
            'details': details or {}
        }
        
        return self.set(key, json.dumps(data), ex=300)  # 5 min TTL
    
    def lpop(self, key: str) -> Optional[str]:
        """Pop element from list"""
        return self._execute(['LPOP', key])
    
    def lpop_normalized(self, key: str) -> Optional[Dict]:
        """
        Pop oldest normalized reflection from list
        
        Args:
            key: List key (e.g., "reflections:normalized")
        
        Returns:
            Reflection dict or None
        """
        data = self.lpop(key)
        if data:
            try:
                parsed = json.loads(data)
                # Handle double-encoded or array-wrapped data
                if isinstance(parsed, list):
                    # If it's a list, take the first item
                    return parsed[0] if len(parsed) > 0 else None
                elif isinstance(parsed, str):
                    # Double-encoded JSON string
                    return json.loads(parsed)
                return parsed
            except Exception as e:
                print(f"[!] Failed to parse reflection from queue: {e}")
                print(f"[!] Raw data: {data[:200]}...")
                return None
        return None
    
    def llen(self, key: str) -> int:
        """Get list length"""
        result = self._execute(['LLEN', key])
        return result if result is not None else 0


# Singleton for convenience
_redis_client: Optional[RedisClient] = None

def get_redis() -> RedisClient:
    """Get or create Redis client singleton"""
    global _redis_client
    
    if _redis_client is None:
        url = os.getenv('UPSTASH_REDIS_REST_URL')
        token = os.getenv('UPSTASH_REDIS_REST_TOKEN')
        
        if not url:
            raise ValueError("UPSTASH_REDIS_REST_URL not set")
        
        _redis_client = RedisClient(url, token)
    
    return _redis_client


# For datetime import
from datetime import datetime
