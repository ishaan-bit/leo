"""
Performance Cache Layer - Content-addressable caching for all inference operations
Uses SHA-256 hashing to cache identical inputs, dramatically reducing redundant compute.
"""

import hashlib
import json
import os
import sqlite3
import time
from pathlib import Path
from typing import Optional, Any, Dict
from contextlib import contextmanager


class PerformanceCache:
    """SQLite-backed cache with content-addressable keys"""
    
    def __init__(self, cache_dir: str = "./cache", enabled: bool = True):
        self.enabled = enabled
        if not enabled:
            return
            
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.cache_dir / "perf_cache.db"
        self._init_db()
        
    def _init_db(self):
        """Initialize SQLite database"""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    ttl INTEGER,
                    cache_type TEXT NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_created_at ON cache(created_at)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_cache_type ON cache(cache_type)")
            conn.commit()
    
    @contextmanager
    def _get_connection(self):
        """Context manager for database connections"""
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        try:
            yield conn
        finally:
            conn.close()
    
    def _make_key(self, content: Any, params: Dict = None) -> str:
        """Generate cache key from content + params"""
        hasher = hashlib.sha256()
        hasher.update(json.dumps(content, sort_keys=True).encode())
        if params:
            hasher.update(json.dumps(params, sort_keys=True).encode())
        return hasher.hexdigest()
    
    def get(self, content: Any, params: Dict = None, cache_type: str = "default") -> Optional[Any]:
        """Get cached value if exists and not expired"""
        if not self.enabled:
            return None
            
        key = self._make_key(content, params)
        
        with self._get_connection() as conn:
            cursor = conn.execute(
                "SELECT value, created_at, ttl FROM cache WHERE key = ?",
                (key,)
            )
            row = cursor.fetchone()
            
            if row:
                value_json, created_at, ttl = row
                
                # Check expiration
                if ttl and (time.time() - created_at > ttl):
                    # Expired, delete it
                    conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                    conn.commit()
                    return None
                
                # Cache hit
                try:
                    return json.loads(value_json)
                except json.JSONDecodeError:
                    return value_json
        
        return None
    
    def set(self, content: Any, value: Any, params: Dict = None, 
            ttl: Optional[int] = None, cache_type: str = "default"):
        """Store value in cache"""
        if not self.enabled:
            return
            
        key = self._make_key(content, params)
        value_json = json.dumps(value) if not isinstance(value, str) else value
        
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT OR REPLACE INTO cache (key, value, created_at, ttl, cache_type)
                VALUES (?, ?, ?, ?, ?)
                """,
                (key, value_json, int(time.time()), ttl, cache_type)
            )
            conn.commit()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.enabled:
            return {"enabled": False}
            
        with self._get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*), cache_type FROM cache GROUP BY cache_type")
            stats_by_type = {row[1]: row[0] for row in cursor.fetchall()}
            
            cursor = conn.execute("SELECT COUNT(*) FROM cache")
            total = cursor.fetchone()[0]
            
            # Calculate cache size
            cursor = conn.execute("SELECT SUM(LENGTH(value)) FROM cache")
            total_bytes = cursor.fetchone()[0] or 0
        
        return {
            "enabled": True,
            "total_entries": total,
            "total_bytes": total_bytes,
            "by_type": stats_by_type
        }
    
    def clear_expired(self):
        """Remove all expired entries"""
        if not self.enabled:
            return
            
        now = int(time.time())
        with self._get_connection() as conn:
            cursor = conn.execute(
                "DELETE FROM cache WHERE ttl IS NOT NULL AND created_at + ttl < ?",
                (now,)
            )
            deleted = cursor.rowcount
            conn.commit()
        
        return deleted
    
    def clear_all(self):
        """Clear entire cache"""
        if not self.enabled:
            return
            
        with self._get_connection() as conn:
            conn.execute("DELETE FROM cache")
            conn.commit()


# Global cache instance
_cache = None

def get_cache() -> PerformanceCache:
    """Get or create global cache instance"""
    global _cache
    if _cache is None:
        # Load config
        config_path = Path(__file__).parent.parent / "config" / "perf_config.json"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
                cache_config = config.get("caching", {})
        else:
            cache_config = {"enabled": True, "cache_dir": "./cache"}
        
        _cache = PerformanceCache(
            cache_dir=cache_config.get("cache_dir", "./cache"),
            enabled=cache_config.get("enabled", True)
        )
    
    return _cache
