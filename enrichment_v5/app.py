"""
HuggingFace Spaces API for enrichment_v5.
FastAPI endpoint to process reflections and return enrichment JSON.
"""

import os
import sys
import logging
import requests
from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from enrich.full_pipeline import enrich

# Import dialogue fetchers
sys.path.insert(0, str(Path(__file__).parent / 'dialogue'))
from excel_dialogue_fetcher import fetch_dialogue_tuples

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Feature Flags
# None Classification Gate: When False, disables None emotion returns
# Set via LEO_USE_NONE_GATE env var (defaults to True for backward compatibility)
USE_NONE_GATE = os.getenv('LEO_USE_NONE_GATE', 'true').lower() in ('true', '1', 'yes')
logger.info(f"🚦 None Classification Gate: {'ENABLED' if USE_NONE_GATE else 'DISABLED'}")

# Initialize FastAPI
app = FastAPI(
    title="Enrichment API v5",
    description="Emotion enrichment pipeline for reflections",
    version="5.0.0"
)

# Configure CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://localhost:5173",  # Vite dev
        "https://*.vercel.app",   # Vercel deployments
        "https://your-domain.com" # Your production domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class EnrichmentRequest(BaseModel):
    """Request body for enrichment endpoint - accepts full reflection or just text."""
    # Option 1: Just text (simple mode)
    text: Optional[str] = Field(None, description="Normalized reflection text", min_length=1, max_length=5000)
    user_id: Optional[str] = Field(default="anonymous", description="User identifier for daily dialogue seeding")
    
    # Option 2: Full reflection object (worker mode)
    rid: Optional[str] = Field(None, description="Reflection ID")
    sid: Optional[str] = Field(None, description="Session ID")
    timestamp: Optional[str] = Field(None, description="ISO timestamp")
    normalized_text: Optional[str] = Field(None, description="Normalized text from reflection")
    
    def get_text(self) -> str:
        """Extract text from either field."""
        return self.normalized_text or self.text or ""
    
    def get_user_id(self) -> str:
        """Extract user ID from sid or user_id."""
        return self.sid or self.user_id or "anonymous"
    
    class Config:
        json_schema_extra = {
            "example": {
                "text": "i am so angry, all the work gone to waste in an hour",
                "user_id": "user_123"
            }
        }


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    hf_token_configured: bool


@app.get("/", response_model=dict)
async def root():
    """Root endpoint - API info."""
    return {
        "name": "Enrichment API v5",
        "version": "5.0.0",
        "endpoints": {
            "/health": "Health check",
            "/enrich": "POST - Enrich reflection text",
            "/dialogue-tuples": "GET - Fetch 3 random dialogue tuples from Excel (params: domain, secondary)",
            "/docs": "API documentation (Swagger UI)"
        }
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    hf_token = os.getenv('HF_TOKEN')
    
    return {
        "status": "healthy",
        "hf_token_configured": bool(hf_token)
    }


@app.post("/enrich")
async def enrich_reflection(request: EnrichmentRequest):
    """
    Enrich reflection text with emotion analysis.
    
    Accepts either:
    - Simple mode: {"text": "...", "user_id": "..."}
    - Worker mode: {"rid": "...", "sid": "...", "normalized_text": "...", ...}
    
    Returns:
        Complete enrichment JSON with:
        - Emotions (primary, secondary, tertiary)
        - Valence/Arousal/Event Valence
        - Context (domain, control, polarity)
        - Confidence scores
        - Flags (negation, sarcasm, profanity)
        - Dialogue (poems, tips)
    """
    try:
        # Extract text and user ID from request
        text = request.get_text()
        user_id = request.get_user_id()
        
        if not text:
            raise HTTPException(
                status_code=400,
                detail="Missing text field (provide 'text' or 'normalized_text')"
            )
        
        logger.info(f"Processing enrichment for user: {user_id}")
        logger.info(f"Text length: {len(text)} chars")
        
        # Validate HF_TOKEN is configured
        if not os.getenv('HF_TOKEN'):
            logger.warning("HF_TOKEN not configured - using fallback classifier")
        
        # Run enrichment pipeline with feature flags
        result = enrich(text, use_none_gate=USE_NONE_GATE)
        
        # Add user_id to dialogue metadata if present
        if '_dialogue_meta' in result:
            result['_dialogue_meta']['user_id'] = user_id
        
        # Add reflection metadata if provided
        if request.rid:
            result['rid'] = request.rid
        if request.sid:
            result['sid'] = request.sid
        if request.timestamp:
            result['timestamp'] = request.timestamp
        
        logger.info(f"Enrichment complete: {result.get('primary', 'N/A')}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Enrichment failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Enrichment processing failed: {str(e)}"
        )


@app.post("/webhook/enrichment")
async def webhook_enrichment(request: EnrichmentRequest):
    """
    Webhook endpoint for no-polling architecture.
    
    Flow:
    1. Vercel frontend calls this webhook after saving reflection
    2. Process enrichment (with poems/tips)
    3. POST result back to Vercel callback API
    4. Vercel updates reflection:{rid} with final.* data
    
    This eliminates the need for a separate worker polling a queue.
    """
    try:
        # Extract data
        text = request.get_text()
        user_id = request.get_user_id()
        rid = request.rid
        
        if not text:
            raise HTTPException(
                status_code=400,
                detail="Missing text field (provide 'text' or 'normalized_text')"
            )
        
        if not rid:
            raise HTTPException(
                status_code=400,
                detail="Missing reflection ID (rid) for webhook callback"
            )
        
        logger.info(f"[Webhook] Processing enrichment for {rid}")
        logger.info(f"[Webhook] Text length: {len(text)} chars")
        
        # Validate HF_TOKEN is configured
        if not os.getenv('HF_TOKEN'):
            logger.warning("[Webhook] HF_TOKEN not configured - using fallback classifier")
        
        # Run enrichment pipeline with feature flags
        result = enrich(text, use_none_gate=USE_NONE_GATE)
        
        # Add user_id to dialogue metadata
        if '_dialogue_meta' in result:
            result['_dialogue_meta']['user_id'] = user_id
        
        # Add reflection metadata
        result['rid'] = rid
        if request.sid:
            result['sid'] = request.sid
        if request.timestamp:
            result['timestamp'] = request.timestamp
        
        logger.info(f"[Webhook] Enrichment complete for {rid}: {result.get('primary', 'N/A')}")
        
        # POST result back to Vercel callback API
        callback_url = os.getenv('VERCEL_CALLBACK_URL')
        
        if callback_url:
            try:
                logger.info(f"[Webhook] Posting result to {callback_url}")
                
                callback_response = requests.post(
                    callback_url,
                    json=result,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
                
                if callback_response.status_code == 200:
                    logger.info(f"[Webhook] Callback successful for {rid}")
                else:
                    logger.error(f"[Webhook] Callback failed: {callback_response.status_code} - {callback_response.text[:200]}")
                    
            except Exception as callback_error:
                logger.error(f"[Webhook] Callback error: {callback_error}")
                # Don't fail the whole request if callback fails
        else:
            logger.warning("[Webhook] VERCEL_CALLBACK_URL not configured - skipping callback")
        
        # Return enrichment result
        return {
            "success": True,
            "rid": rid,
            "enrichment": result,
            "callback_sent": bool(callback_url)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Webhook] Enrichment failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Enrichment processing failed: {str(e)}"
        )


@app.get("/test")
async def test_endpoint():
    """Test endpoint with sample reflection."""
    sample_text = "i am so angry, all the work gone to waste in an hour"
    
    try:
        result = enrich(sample_text, use_none_gate=USE_NONE_GATE)
        return {
            "test": "success",
            "sample_input": sample_text,
            "result": result
        }
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")
        return {
            "test": "failed",
            "error": str(e)
        }


@app.get("/dialogue-tuples")
async def get_dialogue_tuples(
    domain: str = Query(..., description="Domain primary (work, self, relationship, etc.)"),
    secondary: str = Query(..., description="Wheel secondary emotion (Frustrated, Anxious, etc.)")
):
    """
    Fetch 3 random dialogue tuples from Guide to Urban Loneliness.xlsx.
    
    Each tuple contains: [Inner Voice of Reason, Regulate, Amuse]
    
    Query Parameters:
        - domain: Domain primary (work, self, relationship, health, family, social, creative, financial)
        - secondary: Wheel secondary emotion (Frustrated, Anxious, Jealous, etc.)
    
    Returns:
        {
            "found": true,
            "domain": "Work",
            "secondary": "Frustrated",
            "tuples": [
                ["Inner Voice 1", "Regulate 1", "Amuse 1"],
                ["Inner Voice 2", "Regulate 2", "Amuse 2"],
                ["Inner Voice 3", "Regulate 3", "Amuse 3"]
            ],
            "source": "excel",
            "total_available": 8
        }
    
    If domain/secondary not found:
        {
            "found": false,
            "error": "Description"
        }
    
    Frontend should skip to Living City after first breathing cycle if found=false.
    """
    try:
        logger.info(f"[Dialogue Tuples] Request: domain={domain}, secondary={secondary}")
        
        result = fetch_dialogue_tuples(domain, secondary)
        
        if result.get('found'):
            logger.info(f"[Dialogue Tuples] ✅ Found {len(result.get('tuples', []))} tuples")
        else:
            logger.warning(f"[Dialogue Tuples] ❌ Not found: {result.get('error')}")
        
        return result
        
    except Exception as e:
        logger.error(f"[Dialogue Tuples] Error: {str(e)}", exc_info=True)
        return {
            "found": False,
            "error": f"Server error: {str(e)}"
        }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 7860))  # HF Spaces default port
    
    logger.info("="*60)
    logger.info("Starting Enrichment API v5")
    logger.info(f"Port: {port}")
    logger.info(f"HF_TOKEN configured: {bool(os.getenv('HF_TOKEN'))}")
    logger.info("="*60)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
