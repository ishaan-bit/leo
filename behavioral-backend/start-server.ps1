# Startup script for Windows
# Ensures Ollama and server are running

Write-Host "🚀 Starting Hybrid Behavioral Analysis Server" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Check if Ollama is running
Write-Host ""
Write-Host "1. Checking Ollama..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop
    $ollamaRunning = $true
    Write-Host "✓ Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama not running" -ForegroundColor Red
    Write-Host "   Start Ollama manually with: ollama serve" -ForegroundColor Yellow
    Write-Host "   Or run in new terminal: Start-Process ollama -ArgumentList 'serve'" -ForegroundColor Yellow
}

# Check if phi-3 is installed
if ($ollamaRunning) {
    Write-Host ""
    Write-Host "2. Checking phi-3 model..." -ForegroundColor Yellow
    $models = ollama list
    if ($models -match "phi3") {
        Write-Host "✓ phi-3 model found" -ForegroundColor Green
    } else {
        Write-Host "⚠️  phi-3 model not found. Pulling phi-3..." -ForegroundColor Yellow
        ollama pull phi3
        Write-Host "✓ phi-3 installed" -ForegroundColor Green
    }
}

# Check environment variables
Write-Host ""
Write-Host "3. Checking environment..." -ForegroundColor Yellow
if (-not $env:UPSTASH_REDIS_REST_URL -and -not $env:KV_REST_API_URL) {
    Write-Host "⚠️  Warning: Upstash credentials not set" -ForegroundColor Yellow
    Write-Host "   Enrichment endpoint will be disabled" -ForegroundColor Yellow
    Write-Host "   Set environment variables or create .env file" -ForegroundColor Yellow
} else {
    Write-Host "✓ Upstash credentials found" -ForegroundColor Green
}

# Check Python dependencies
Write-Host ""
Write-Host "4. Checking dependencies..." -ForegroundColor Yellow
try {
    python -c "import fastapi" 2>$null
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r requirements-server.txt
    python -m textblob.download_corpora
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
}

# Start server
Write-Host ""
Write-Host "5. Starting FastAPI server..." -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor Cyan
Write-Host "  http://localhost:8000/         - Server info" -ForegroundColor White
Write-Host "  http://localhost:8000/health   - Health check" -ForegroundColor White
Write-Host "  http://localhost:8000/analyze  - Analyze text" -ForegroundColor White
Write-Host "  http://localhost:8000/enrich/{rid} - Enrich reflection" -ForegroundColor White
Write-Host ""
Write-Host "Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

python server.py
