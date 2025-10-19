"""
FastAPI server for Hybrid Behavioral Analysis with phi-3
Standalone microservice for Vercel frontend to call

Endpoints:
- POST /analyze - Analyze reflection text
- POST /enrich/{rid} - Enrich existing reflection by RID
- GET /health - Health check
"""

import os
import sys
import time
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from hybrid_analyzer import HybridAnalyzer
from persistence import UpstashStore
from agent_service import ReflectionAnalysisAgent

# Initialize FastAPI
app = FastAPI(
    title="Hybrid Behavioral Analysis API",
    description="phi-3 powered emotion analysis with temporal tracking",
    version="1.0.0"
)

# CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize analyzer (global instance)
analyzer: Optional[HybridAnalyzer] = None
upstash_store: Optional[UpstashStore] = None


@app.on_event("startup")
async def startup_event():
    """Initialize analyzer on startup."""
    global analyzer, upstash_store
    
    print("🚀 Initializing Hybrid Behavioral Analysis Server...", flush=True)
    print(f"📍 Python version: {sys.version}", flush=True)
    print(f"📍 Working directory: {os.getcwd()}", flush=True)
    
    # Check for Upstash credentials
    upstash_url = os.getenv("UPSTASH_REDIS_REST_URL") or os.getenv("KV_REST_API_URL")
    upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN") or os.getenv("KV_REST_API_TOKEN")
    
    print(f"📍 Upstash URL present: {bool(upstash_url)}", flush=True)
    print(f"📍 Upstash token present: {bool(upstash_token)}", flush=True)
    sys.stdout.flush()
    
    if upstash_url and upstash_token:
        try:
            print("🔗 Connecting to Upstash...", flush=True)
            upstash_store = UpstashStore()  # No parameters needed
            print("✓ Upstash connection established", flush=True)
        except Exception as e:
            print(f"⚠️  Upstash connection failed: {e}", flush=True)
            import traceback
            traceback.print_exc()
            sys.stdout.flush()
    else:
        print("⚠️  Upstash credentials not found - enrichment endpoint disabled", flush=True)
    
    # Initialize hybrid analyzer
    print("🤖 Initializing HybridAnalyzer...", flush=True)
    sys.stdout.flush()
    try:
        analyzer = HybridAnalyzer(
            use_llm=True,  # Enable phi-3
            enable_temporal=True,  # Enable temporal tracking
            ollama_url=os.getenv("OLLAMA_URL", "http://localhost:11434")
        )
        print("✓ HybridAnalyzer initialized", flush=True)
    except Exception as e:
        print(f"❌ HybridAnalyzer initialization failed: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        raise
    
    print("✅ Server ready! All systems operational.", flush=True)
    sys.stdout.flush()


# Request/Response models
class AnalyzeRequest(BaseModel):
    """Request body for /analyze endpoint."""
    text: str
    user_id: str


class AnalyzeResponse(BaseModel):
    """Response from /analyze endpoint."""
    ok: bool
    baseline: Dict[str, Any]
    hybrid: Dict[str, Any]
    llm_used: bool
    latency_ms: int


class EnrichResponse(BaseModel):
    """Response from /enrich endpoint."""
    ok: bool
    rid: str
    analysis_version: str
    latency_ms: int


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Hybrid Behavioral Analysis API",
        "version": "1.0.0",
        "status": "running",
        "llm_enabled": analyzer.use_llm if analyzer else False,
        "temporal_enabled": analyzer.enable_temporal if analyzer else False,
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    if not analyzer:
        raise HTTPException(status_code=503, detail="Analyzer not initialized")
    
    return {
        "status": "healthy",
        "llm_available": analyzer.use_llm,
        "temporal_available": analyzer.enable_temporal,
        "upstash_available": upstash_store is not None,
    }


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    """
    Analyze reflection text.
    
    Returns baseline + hybrid analysis with optional LLM enhancement and temporal state.
    """
    if not analyzer:
        raise HTTPException(status_code=503, detail="Analyzer not initialized")
    
    start_time = time.time()
    
    try:
        result = analyzer.analyze_reflection(request.text, request.user_id)
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return AnalyzeResponse(
            ok=True,
            baseline=result["baseline"],
            hybrid=result["hybrid"],
            llm_used=result["llm_used"],
            latency_ms=latency_ms
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/enrich/{rid}", response_model=EnrichResponse)
async def enrich_reflection(rid: str):
    """
    Enrich existing reflection by RID using hybrid analyzer + full agent pipeline.
    
    This endpoint:
    1. Fetches reflection from Upstash
    2. Runs full ReflectionAnalysisAgent (baseline, history, temporal, insights)
    3. Saves enriched reflection back to Upstash
    
    Note: This uses the simpler agent_service.py (rule-based) not hybrid_analyzer
    to maintain consistency with existing enrichment tools.
    """
    if not upstash_store:
        raise HTTPException(
            status_code=503,
            detail="Upstash not configured - cannot enrich reflections"
        )
    
    start_time = time.time()
    
    try:
        # Initialize agent
        agent = ReflectionAnalysisAgent(upstash_store)
        
        # Fetch reflection
        reflection = upstash_store.get_reflection_by_rid(rid)
        if not reflection:
            raise HTTPException(status_code=404, detail=f"Reflection {rid} not found")
        
        # Process reflection
        result = agent.process_reflection(reflection)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        latency_ms = int((time.time() - start_time) * 1000)
        
        return EnrichResponse(
            ok=True,
            rid=rid,
            analysis_version=result.get("analysis", {}).get("version", "unknown"),
            latency_ms=latency_ms
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Enrichment failed: {str(e)}")


# Run with: python app.py (Railway will set PORT env var)
if __name__ == "__main__":
    import uvicorn
    import sys
    
    port = int(os.environ.get("PORT", 8000))
    
    print("=" * 60, flush=True)
    print("Starting Hybrid Behavioral Analysis Server...", flush=True)
    print(f"Port: {port}", flush=True)
    print(f"Host: 0.0.0.0", flush=True)
    print("Endpoints:", flush=True)
    print("  POST /analyze - Analyze text with hybrid phi-3", flush=True)
    print("  POST /enrich/{rid} - Enrich reflection by RID", flush=True)
    print("  GET /health - Health check", flush=True)
    print("=" * 60, flush=True)
    sys.stdout.flush()
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Disable reload in production
        log_level="info"
    )
