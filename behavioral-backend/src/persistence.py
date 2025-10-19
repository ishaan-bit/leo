"""
Persistence layer for Upstash (Vercel KV).
Handles reflection storage, state snapshots, and risk event logging.
"""

import os
import json
import hashlib
from typing import Dict, List, Optional, Any
from datetime import datetime
from upstash_redis import Redis


class UpstashStore:
    """
    Persistence interface for behavioral backend.
    Uses Upstash Redis (compatible with Vercel KV).
    """
    
    def __init__(self):
        # Support both Vercel naming (KV_REST_API_*) and standard Upstash naming
        url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
        token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
        
        if not url or not token:
            raise ValueError(
                "Upstash Redis credentials required. Set either:\n"
                "  KV_REST_API_URL + KV_REST_API_TOKEN (Vercel naming), or\n"
                "  UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN"
            )
        
        self.redis = Redis(url=url, token=token)
    
    def _reflection_key(self, user_id: str, ts: str) -> str:
        """Generate key for reflection record."""
        return f"reflection:{user_id}:{ts}"
    
    def _state_key(self, user_id: str) -> str:
        """Generate key for state snapshot."""
        return f"state:{user_id}"
    
    def _index_key(self, user_id: str) -> str:
        """Generate key for chronological index."""
        return f"index:{user_id}"
    
    def _risk_key(self, user_id: str, ts: str) -> str:
        """Generate key for risk event."""
        return f"risk:{user_id}:{ts}"
    
    def _text_hash(self, text: str) -> str:
        """Generate hash of text for idempotency checks."""
        return hashlib.sha256(text.encode()).hexdigest()[:16]
    
    def get_state(self, user_id: str) -> Dict:
        """
        Retrieve current state snapshot for user.
        Returns default state if not found.
        """
        key = self._state_key(user_id)
        data = self.redis.get(key)
        
        if data:
            return json.loads(data)
        else:
            # Default initial state
            return {"v": 0.0, "a": 0.3, "updated_at": None}
    
    def save_state(self, user_id: str, state: Dict, ts: str):
        """Save updated state snapshot."""
        key = self._state_key(user_id)
        state_with_ts = {**state, "updated_at": ts}
        self.redis.set(key, json.dumps(state_with_ts))
    
    def get_recent_reflections(self, user_id: str, window: int = 10) -> List[Dict]:
        """
        Retrieve last N reflections for baseline computation.
        Returns list of reflection records in chronological order.
        """
        index_key = self._index_key(user_id)
        
        # Get last N timestamps from sorted set
        timestamps = self.redis.zrevrange(index_key, 0, window - 1)
        
        if not timestamps:
            return []
        
        # Fetch reflection records
        reflections = []
        for ts in timestamps:
            ts_str = ts.decode() if isinstance(ts, bytes) else str(ts)
            refl_key = self._reflection_key(user_id, ts_str)
            data = self.redis.get(refl_key)
            if data:
                reflections.append(json.loads(data))
        
        return reflections[::-1]  # Return in chronological order
    
    def get_reflections_by_owner_in_days(self, user_id: str, days: int = 180, limit: int = 500) -> List[Dict]:
        """
        Retrieve reflections for user in the last N days, limited to M items.
        Returns list in chronological order (oldest first).
        """
        import time
        now_ts = time.time()
        start_ts = now_ts - (days * 24 * 3600)
        
        index_key = self._index_key(user_id)
        
        # Get timestamps in range using zrangebyscore
        timestamps = self.redis.zrangebyscore(index_key, start_ts, now_ts, withscores=False)
        
        if not timestamps:
            return []
        
        # Limit to M items, take the most recent
        timestamps = timestamps[-limit:] if len(timestamps) > limit else timestamps
        
        # Fetch reflection records
        reflections = []
        for ts in timestamps:
            ts_str = ts.decode() if isinstance(ts, bytes) else str(ts)
            refl_key = self._reflection_key(user_id, ts_str)
            data = self.redis.get(refl_key)
            if data:
                reflections.append(json.loads(data))
        
        return reflections  # Already in chronological order
    
    def save_reflection(self, user_id: str, ts: str, reflection: Dict) -> bool:
        """
        Save reflection record.
        Returns False if duplicate detected (idempotency).
        """
        # Check for duplicate via text hash
        text_hash = self._text_hash(reflection["text"])
        dup_key = f"hash:{user_id}:{text_hash}"
        
        if self.redis.exists(dup_key):
            return False  # Duplicate detected
        
        # Save reflection
        refl_key = self._reflection_key(user_id, ts)
        self.redis.set(refl_key, json.dumps(reflection))
        
        # Add to chronological index (sorted set by timestamp)
        index_key = self._index_key(user_id)
        score = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
        self.redis.zadd(index_key, {ts: score})
        
        # Mark hash as seen (with 7-day expiry to prevent infinite growth)
        self.redis.setex(dup_key, 604800, "1")
        
        return True
    
    def save_risk_event(self, user_id: str, ts: str, text_hash: str, risk_flags: List[str]):
        """Save risk event to risk stream/log."""
        risk_key = self._risk_key(user_id, ts)
        event = {
            "user_id": user_id,
            "ts": ts,
            "text_hash": text_hash,
            "risk_flags": risk_flags,
        }
        self.redis.set(risk_key, json.dumps(event))
        
        # Also add to risk index for monitoring
        risk_index = f"risk_index:{user_id}"
        score = datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp()
        self.redis.zadd(risk_index, {ts: score})
    
    def get_last_reflections(self, user_id: str, n: int = 5) -> List[Dict]:
        """
        Helper: retrieve last N reflections for inspection.
        Used by 'tail' command.
        """
        return self.get_recent_reflections(user_id, window=n)
    
    def save_reflection_by_rid(self, rid: str, reflection: Dict) -> None:
        """
        Save reflection by rid (key is reflection:rid).

        Args:
            rid: Reflection ID (key)
            reflection: Full reflection data
        """
        key = f"reflection:{rid}"
        self.redis.set(key, json.dumps(reflection))
    
    def get_reflection_by_rid(self, rid: str) -> Optional[Dict]:
        """
        Get reflection by rid.

        Args:
            rid: Reflection ID

        Returns:
            Reflection data or None if not found
        """
        key = f"reflection:{rid}"
        data = self.redis.get(key)
        if data:
            return json.loads(data)
        return None
    
    def update_indices(self, owner_id: str, pig_id: str, rid: str, timestamp: datetime) -> None:
        """
        Update secondary indices for owner and pig, sorted by timestamp.

        Args:
            owner_id: Owner identifier
            pig_id: Pig identifier
            rid: Reflection ID
            timestamp: Timestamp for sorting
        """
        ts_score = timestamp.timestamp()
        # owner:{owner_id}:refs
        owner_key = f"owner:{owner_id}:refs"
        self.redis.zadd(owner_key, {rid: ts_score})
        # pig:{pig_id}:refs
        pig_key = f"pig:{pig_id}:refs"
        self.redis.zadd(pig_key, {rid: ts_score})


class TemporalPersistence:
    """
    Temporal state persistence interface for Upstash Redis.
    Extends UpstashStore with temporal state operations.
    """

    def __init__(self, upstash_store: Optional[UpstashStore] = None):
        """
        Initialize temporal persistence.

        Args:
            upstash_store: Existing UpstashStore instance (optional)
        """
        if upstash_store:
            self.redis = upstash_store.redis
        else:
            # Create new instance if not provided
            self.redis = UpstashStore().redis

    def get_temporal_state(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve user's temporal state.

        Args:
            user_id: User identifier

        Returns:
            Temporal state dictionary or None if not found
        """
        key = f"user:{user_id}:t:state"
        data = self.redis.get(key)

        if data:
            return json.loads(data)
        return None

    def save_temporal_state(self, user_id: str, state: Dict[str, Any]) -> None:
        """
        Save user's temporal state.

        Args:
            user_id: User identifier
            state: Temporal state to save
        """
        key = f"user:{user_id}:t:state"
        self.redis.set(key, json.dumps(state))

    def get_seasonality(self, user_id: str, season_type: str, period: int) -> Optional[Dict[str, float]]:
        """
        Retrieve seasonality data for user.

        Args:
            user_id: User identifier
            season_type: "dow" (day of week) or "hour" (hour of day)
            period: Period identifier (0-6 for dow, 0-23 for hour)

        Returns:
            Seasonality data or None if not found
        """
        key = f"user:{user_id}:t:season:{season_type}"
        data = self.redis.hget(key, str(period))

        if data:
            return json.loads(data)
        return None

    def save_seasonality(self, user_id: str, season_type: str, period: int, data: Dict[str, float]) -> None:
        """
        Save seasonality data for user.

        Args:
            user_id: User identifier
            season_type: "dow" or "hour"
            period: Period identifier
            data: Seasonality data to save
        """
        key = f"user:{user_id}:t:season:{season_type}"
        self.redis.hset(key, str(period), json.dumps(data))

    def increment_keyword(self, user_id: str, keyword: str, increment: float = 1.0) -> None:
        """
        Increment keyword frequency counter.

        Args:
            user_id: User identifier
            keyword: Keyword to increment
            increment: Amount to increment (default 1.0)
        """
        key = f"user:{user_id}:kw"
        self.redis.zincrby(key, increment, keyword)

    def get_keyword_frequencies(self, user_id: str, limit: int = 50) -> List[tuple]:
        """
        Get top keyword frequencies for user.

        Args:
            user_id: User identifier
            limit: Maximum number of keywords to return

        Returns:
            List of (keyword, frequency) tuples
        """
        key = f"user:{user_id}:kw"
        results = self.redis.zrevrange(key, 0, limit - 1, withscores=True)

        return [(k.decode() if isinstance(k, bytes) else k,
                float(s)) for k, s in results]

    def log_spike(self, user_id: str, timestamp: float, spike_data: Dict[str, float]) -> None:
        """
        Log significant spike event.

        Args:
            user_id: User identifier
            timestamp: Event timestamp
            spike_data: Spike data (zv, za, R values)
        """
        key = f"user:{user_id}:spikes"
        member = json.dumps(spike_data)
        self.redis.zadd(key, {member: timestamp})

    def get_recent_spikes(self, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent spike events for user.

        Args:
            user_id: User identifier
            limit: Maximum number of spikes to return

        Returns:
            List of spike events with timestamps
        """
        key = f"user:{user_id}:spikes"
        results = self.redis.zrevrange(key, 0, limit - 1, withscores=True)

        spikes = []
        for member, score in results:
            data = json.loads(member.decode() if isinstance(member, bytes) else member)
            data["timestamp"] = score
            spikes.append(data)

        return spikes

    def save_reflection_timeline(self, user_id: str, reflection_id: str) -> None:
        """
        Add reflection to user's timeline.

        Args:
            user_id: User identifier
            reflection_id: Reflection identifier
        """
        key = f"user:{user_id}:timeline"
        self.redis.lpush(key, reflection_id)

        # Keep only last 1000 entries to prevent unbounded growth
        self.redis.ltrim(key, 0, 999)

    def save_reflection_data(self, user_id: str, reflection_id: str, data: Dict[str, Any]) -> None:
        """
        Save full reflection data.

        Args:
            user_id: User identifier
            reflection_id: Reflection identifier
            data: Full reflection data
        """
        key = f"user:{user_id}:ref:{reflection_id}"
        self.redis.set(key, json.dumps(data))

    def get_reflection_data(self, user_id: str, reflection_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve full reflection data.

        Args:
            user_id: User identifier
            reflection_id: Reflection identifier

        Returns:
            Reflection data or None if not found
        """
        key = f"user:{user_id}:ref:{reflection_id}"
        data = self.redis.get(key)

        if data:
            return json.loads(data)
        return None

    def get_timeline(self, user_id: str, limit: int = 50) -> List[str]:
        """
        Get user's reflection timeline.

        Args:
            user_id: User identifier
            limit: Maximum number of entries to return

        Returns:
            List of reflection IDs in chronological order (newest first)
        """
        key = f"user:{user_id}:timeline"
        results = self.redis.lrange(key, 0, limit - 1)

        return [r.decode() if isinstance(r, bytes) else r for r in results]
