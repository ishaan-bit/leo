"""
Async Network Client - Replace synchronous requests with async httpx
Provides connection pooling, retry logic, and concurrency limits
"""

import asyncio
import httpx
import json
from typing import Optional, Dict, Any, List
from pathlib import Path


class AsyncNetworkClient:
    """Async HTTP client with retry logic and connection pooling"""
    
    def __init__(self):
        # Load config
        config_path = Path(__file__).parent.parent / "config" / "perf_config.json"
        if config_path.exists():
            with open(config_path) as f:
                config = json.load(f)
                net_config = config.get("networking", {})
        else:
            net_config = {}
        
        self.max_concurrent = net_config.get("max_concurrent_requests", 16)
        self.per_host_limit = net_config.get("per_host_limit", 6)
        self.timeout_connect = net_config.get("timeout_connect", 10)
        self.timeout_read = net_config.get("timeout_read", 180)
        self.retry_attempts = net_config.get("retry_attempts", 3)
        self.retry_backoff_ms = net_config.get("retry_backoff_ms", [100, 300, 900])
        
        # Create limits
        self.limits = httpx.Limits(
            max_keepalive_connections=self.per_host_limit,
            max_connections=self.max_concurrent
        )
        
        # Create timeout
        self.timeout = httpx.Timeout(
            connect=self.timeout_connect,
            read=self.timeout_read,
            write=self.timeout_connect,
            pool=5.0
        )
        
        self._client: Optional[httpx.AsyncClient] = None
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
    
    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create async client"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                limits=self.limits,
                timeout=self.timeout,
                http2=True  # Enable HTTP/2 for multiplexing
            )
        return self._client
    
    async def post(
        self,
        url: str,
        json_data: Optional[Dict] = None,
        data: Optional[Any] = None,
        headers: Optional[Dict] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """POST request with retry logic"""
        async with self._semaphore:  # Limit concurrency
            client = await self._get_client()
            
            last_error = None
            for attempt in range(self.retry_attempts):
                try:
                    response = await client.post(
                        url,
                        json=json_data,
                        data=data,
                        headers=headers,
                        timeout=timeout or self.timeout
                    )
                    response.raise_for_status()
                    return response.json()
                    
                except (httpx.HTTPStatusError, httpx.RequestError) as e:
                    last_error = e
                    
                    # Don't retry on 4xx errors
                    if isinstance(e, httpx.HTTPStatusError) and 400 <= e.response.status_code < 500:
                        raise
                    
                    # Backoff before retry
                    if attempt < self.retry_attempts - 1:
                        backoff = self.retry_backoff_ms[min(attempt, len(self.retry_backoff_ms) - 1)]
                        await asyncio.sleep(backoff / 1000.0)
            
            # All retries failed
            raise last_error
    
    async def get(
        self,
        url: str,
        headers: Optional[Dict] = None,
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """GET request with retry logic"""
        async with self._semaphore:
            client = await self._get_client()
            
            last_error = None
            for attempt in range(self.retry_attempts):
                try:
                    response = await client.get(
                        url,
                        headers=headers,
                        timeout=timeout or self.timeout
                    )
                    response.raise_for_status()
                    return response.json()
                    
                except (httpx.HTTPStatusError, httpx.RequestError) as e:
                    last_error = e
                    
                    if isinstance(e, httpx.HTTPStatusError) and 400 <= e.response.status_code < 500:
                        raise
                    
                    if attempt < self.retry_attempts - 1:
                        backoff = self.retry_backoff_ms[min(attempt, len(self.retry_backoff_ms) - 1)]
                        await asyncio.sleep(backoff / 1000.0)
            
            raise last_error
    
    async def close(self):
        """Close client"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# Global client instance
_client: Optional[AsyncNetworkClient] = None

def get_async_client() -> AsyncNetworkClient:
    """Get or create global async client"""
    global _client
    if _client is None:
        _client = AsyncNetworkClient()
    return _client
