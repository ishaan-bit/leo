#!/bin/bash

# Startup script for Hybrid Behavioral Analysis Server
# Ensures Ollama and server are running

set -e

echo "🚀 Starting Hybrid Behavioral Analysis Server"
echo "=============================================="

# Check if Ollama is running
echo ""
echo "1. Checking Ollama..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama not running. Starting Ollama..."
    echo "   If this fails, manually run: ollama serve"
    ollama serve > /dev/null 2>&1 &
    sleep 2
fi

# Check if phi-3 is installed
echo ""
echo "2. Checking phi-3 model..."
if ! ollama list | grep -q "phi3"; then
    echo "⚠️  phi-3 model not found. Pulling phi-3..."
    ollama pull phi3
fi

echo "✓ Ollama ready with phi-3"

# Check environment variables
echo ""
echo "3. Checking environment..."
if [ -z "$UPSTASH_REDIS_REST_URL" ] && [ -z "$KV_REST_API_URL" ]; then
    echo "⚠️  Warning: Upstash credentials not set"
    echo "   Enrichment endpoint will be disabled"
    echo "   Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN"
fi

# Install dependencies if needed
echo ""
echo "4. Checking dependencies..."
if ! python -c "import fastapi" 2>/dev/null; then
    echo "Installing Python dependencies..."
    pip install -r requirements-server.txt
    python -m textblob.download_corpora
fi

echo "✓ Dependencies ready"

# Start server
echo ""
echo "5. Starting FastAPI server..."
echo "=============================================="
echo ""
echo "Endpoints:"
echo "  http://localhost:8000/         - Server info"
echo "  http://localhost:8000/health   - Health check"
echo "  http://localhost:8000/analyze  - Analyze text"
echo "  http://localhost:8000/enrich/{rid} - Enrich reflection"
echo ""
echo "Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo "=============================================="
echo ""

python server.py
