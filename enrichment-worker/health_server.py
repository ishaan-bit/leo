"""
Health Check HTTP Server
Provides /healthz endpoint for monitoring
"""

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import os
from src.modules.redis_client import get_redis
from src.modules.ollama_client import OllamaClient

app = FastAPI(title="Leo Enrichment Worker Health")

# Initialize clients
redis_client = get_redis()
ollama_client = OllamaClient(
    base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
    model=os.getenv('OLLAMA_MODEL', 'phi3:latest')
)


@app.get("/healthz")
def healthz():
    """Health check endpoint"""
    ollama_ok = ollama_client.is_available()
    redis_ok = redis_client.ping()
    
    status = "healthy" if (ollama_ok and redis_ok) else "degraded"
    
    return JSONResponse({
        'ollama': 'ok' if ollama_ok else 'down',
        'redis': 'ok' if redis_ok else 'down',
        'status': status,
        'model': ollama_client.model,
        'timezone': os.getenv('TIMEZONE', 'Asia/Kolkata'),
    })


@app.get("/version")
def version():
    """Version info"""
    return JSONResponse({
        'worker': 'enrichment-worker',
        'version': '1.0.0',
        'model': ollama_client.model,
    })


@app.get("/")
def root():
    """Root endpoint"""
    return JSONResponse({
        'service': 'Leo Enrichment Worker',
        'status': 'running',
        'endpoints': ['/healthz', '/version'],
    })


if __name__ == '__main__':
    import uvicorn
    
    port = int(os.getenv('HEALTH_PORT', '8001'))
    host = os.getenv('HEALTH_HOST', '0.0.0.0')
    
    print(f"🏥 Starting health server on {host}:{port}")
    
    uvicorn.run(app, host=host, port=port, log_level="info")
