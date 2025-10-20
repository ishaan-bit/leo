# Leo Enrichment Worker - Setup Script
# Run this to configure the worker for the first time

Write-Host "🚀 Leo Enrichment Worker Setup" -ForegroundColor Cyan
Write-Host ""

# Check Python
Write-Host "1️⃣  Checking Python..." -ForegroundColor Yellow
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) {
    Write-Host "❌ Python not found! Install Python 3.9+ first." -ForegroundColor Red
    exit 1
}

$pythonVersion = & python --version
Write-Host "   ✅ $pythonVersion" -ForegroundColor Green

# Check Ollama
Write-Host ""
Write-Host "2️⃣  Checking Ollama..." -ForegroundColor Yellow
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
if (-not $ollamaCmd) {
    Write-Host "   ⚠️  Ollama not found!" -ForegroundColor Yellow
    Write-Host "   Download from: https://ollama.ai" -ForegroundColor Cyan
    Write-Host ""
    $installOllama = Read-Host "   Do you want to download Ollama now? (y/n)"
    if ($installOllama -eq 'y') {
        Start-Process "https://ollama.ai/download"
    }
} else {
    Write-Host "   ✅ Ollama installed" -ForegroundColor Green
    
    # Check if phi3 is pulled
    $models = & ollama list 2>&1
    if ($models -match "phi3") {
        Write-Host "   ✅ phi3 model ready" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  phi3 model not found" -ForegroundColor Yellow
        Write-Host "   Pulling phi3 model..." -ForegroundColor Cyan
        & ollama pull phi3
        Write-Host "   ✅ phi3 pulled successfully" -ForegroundColor Green
    }
}

# Install Python dependencies
Write-Host ""
Write-Host "3️⃣  Installing Python dependencies..." -ForegroundColor Yellow
cd enrichment-worker
pip install -r requirements.txt --quiet
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✅ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "   ❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Setup .env
Write-Host ""
Write-Host "4️⃣  Setting up environment..." -ForegroundColor Yellow

if (Test-Path .env) {
    Write-Host "   ⚠️  .env already exists" -ForegroundColor Yellow
    $overwrite = Read-Host "   Overwrite? (y/n)"
    if ($overwrite -ne 'y') {
        Write-Host "   Skipping .env setup" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "✅ Setup complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📝 Next steps:" -ForegroundColor Cyan
        Write-Host "   1. Edit .env with your Upstash credentials"
        Write-Host "   2. Run: python worker.py"
        Write-Host "   3. (Optional) Run health server: python health_server.py"
        Write-Host ""
        exit 0
    }
}

# Copy .env.example
Copy-Item .env.example .env
Write-Host "   ✅ Created .env from template" -ForegroundColor Green

# Prompt for Upstash credentials
Write-Host ""
Write-Host "   Please enter your Upstash Redis credentials:" -ForegroundColor Cyan
Write-Host "   (Find them at: https://console.upstash.com)" -ForegroundColor DarkGray
Write-Host ""

$upstashUrl = Read-Host "   Upstash Redis REST URL"
$upstashToken = Read-Host "   Upstash Redis REST Token"

if ($upstashUrl -and $upstashToken) {
    # Update .env file
    $envContent = Get-Content .env
    $envContent = $envContent -replace 'UPSTASH_REDIS_REST_URL=.*', "UPSTASH_REDIS_REST_URL=$upstashUrl"
    $envContent = $envContent -replace 'UPSTASH_REDIS_REST_TOKEN=.*', "UPSTASH_REDIS_REST_TOKEN=$upstashToken"
    $envContent | Set-Content .env
    
    Write-Host ""
    Write-Host "   ✅ Credentials saved to .env" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "   ⚠️  Skipped credentials - edit .env manually" -ForegroundColor Yellow
}

# Test connections
Write-Host ""
Write-Host "5️⃣  Testing connections..." -ForegroundColor Yellow

# Test Redis
Write-Host "   Testing Redis..." -ForegroundColor Cyan
$redisTest = & python -c "from src.modules.redis_client import get_redis; r = get_redis(); print('ok' if r.ping() else 'fail')" 2>&1
if ($redisTest -match "ok") {
    Write-Host "   ✅ Redis connection OK" -ForegroundColor Green
} else {
    Write-Host "   ❌ Redis connection failed" -ForegroundColor Red
    Write-Host "   Check your credentials in .env" -ForegroundColor Yellow
}

# Test Ollama
Write-Host "   Testing Ollama..." -ForegroundColor Cyan
$ollamaTest = & python -c "from src.modules.ollama_client import OllamaClient; c = OllamaClient(); print('ok' if c.is_available() else 'fail')" 2>&1
if ($ollamaTest -match "ok") {
    Write-Host "   ✅ Ollama connection OK" -ForegroundColor Green
} else {
    Write-Host "   ❌ Ollama not reachable" -ForegroundColor Red
    Write-Host "   Make sure Ollama is running: ollama serve" -ForegroundColor Yellow
}

# Done
Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "   1. Make sure Ollama is running: ollama serve"
Write-Host "   2. Start worker: python worker.py"
Write-Host "   3. (Optional) Run health server: python health_server.py"
Write-Host "   4. Submit a reflection from frontend to test"
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   - Worker README: enrichment-worker/README.md"
Write-Host "   - Health check: http://localhost:8001/healthz"
Write-Host ""
