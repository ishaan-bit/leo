"""
Simple Performance Metrics - Track latency and throughput
"""

import time
from collections import defaultdict
from typing import Dict, Any
import threading


class Metrics:
    """Thread-safe metrics collector"""
    
    def __init__(self):
        self._lock = threading.Lock()
        self._latencies = defaultdict(list)
        self._counts = defaultdict(int)
        self._errors = defaultdict(int)
        self._cache_hits = defaultdict(int)
        self._cache_misses = defaultdict(int)
    
    def record_latency(self, operation: str, latency_ms: float):
        """Record operation latency in milliseconds"""
        with self._lock:
            self._latencies[operation].append(latency_ms)
            self._counts[operation] += 1
    
    def record_error(self, operation: str):
        """Record error"""
        with self._lock:
            self._errors[operation] += 1
    
    def record_cache_hit(self, cache_type: str):
        """Record cache hit"""
        with self._lock:
            self._cache_hits[cache_type] += 1
    
    def record_cache_miss(self, cache_type: str):
        """Record cache miss"""
        with self._lock:
            self._cache_misses[cache_type] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get current stats"""
        with self._lock:
            stats = {}
            
            for op, latencies in self._latencies.items():
                if latencies:
                    sorted_lat = sorted(latencies)
                    stats[op] = {
                        "count": self._counts[op],
                        "errors": self._errors.get(op, 0),
                        "p50_ms": sorted_lat[len(sorted_lat) // 2],
                        "p95_ms": sorted_lat[int(len(sorted_lat) * 0.95)],
                        "p99_ms": sorted_lat[int(len(sorted_lat) * 0.99)] if len(sorted_lat) > 100 else sorted_lat[-1],
                        "avg_ms": sum(sorted_lat) / len(sorted_lat)
                    }
            
            # Cache stats
            cache_stats = {}
            for cache_type in set(list(self._cache_hits.keys()) + list(self._cache_misses.keys())):
                hits = self._cache_hits.get(cache_type, 0)
                misses = self._cache_misses.get(cache_type, 0)
                total = hits + misses
                cache_stats[cache_type] = {
                    "hits": hits,
                    "misses": misses,
                    "hit_rate": (hits / total * 100) if total > 0 else 0
                }
            
            stats["cache"] = cache_stats
            
            return stats
    
    def reset(self):
        """Reset all metrics"""
        with self._lock:
            self._latencies.clear()
            self._counts.clear()
            self._errors.clear()
            self._cache_hits.clear()
            self._cache_misses.clear()


# Global metrics instance
_metrics = Metrics()

def get_metrics() -> Metrics:
    """Get global metrics instance"""
    return _metrics


class timer:
    """Context manager for timing operations"""
    
    def __init__(self, operation: str, metrics: Metrics = None):
        self.operation = operation
        self.metrics = metrics or get_metrics()
        self.start = None
    
    def __enter__(self):
        self.start = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        latency_ms = (time.time() - self.start) * 1000
        if exc_type is None:
            self.metrics.record_latency(self.operation, latency_ms)
        else:
            self.metrics.record_error(self.operation)
        return False
