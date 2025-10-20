# Leo Enrichment Backend Startup Script
# Run this every time you want to use the app with local enrichment

Write-Host "🚀 Starting Leo Enrichment Backend..." -ForegroundColor Cyan
Write-Host ""

# Add Ollama to PATH
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"

# Check Ollama is running
Write-Host "🔍 Checking Ollama..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -UseBasicParsing
    Write-Host "✅ Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama is not running! Start Ollama Desktop first." -ForegroundColor Red
    Write-Host "   Download from: https://ollama.com/download" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "📊 System Info:" -ForegroundColor Cyan
Write-Host "   Hardware: Intel Core Ultra 7 256V (CPU mode)" -ForegroundColor Gray
Write-Host "   Performance: ~12 tokens/sec" -ForegroundColor Gray
Write-Host "   Model: phi3:latest" -ForegroundColor Gray
Write-Host "   Baseline: 66% pass rate (tuned)" -ForegroundColor Gray
Write-Host "   Hybrid: 35% baseline + 65% Ollama" -ForegroundColor Gray
Write-Host ""

# Navigate to worker directory
Set-Location "c:\Users\Kafka\Documents\Leo\enrichment-worker"

Write-Host "🎯 Starting worker..." -ForegroundColor Yellow
Write-Host "   Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

# Start the worker
& "C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe" worker.py
