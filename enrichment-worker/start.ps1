# Leo Enrichment Worker - Quick Start Script

Write-Host "🚀 Starting Leo Enrichment Worker" -ForegroundColor Cyan
Write-Host ""

# Add Ollama to PATH
$env:Path += ";$env:LOCALAPPDATA\Programs\Ollama"

# Check dependencies
Write-Host "✓ Checking dependencies..." -ForegroundColor Green
$pythonCmd = "C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe"

# Check Ollama
$ollamaCheck = ollama list 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ Ollama ready" -ForegroundColor Green
} else {
    Write-Host "  ❌ Ollama not found" -ForegroundColor Red
    exit 1
}

# Check phi3 model
if ($ollamaCheck -match "phi3") {
    Write-Host "  ✅ phi3 model ready" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  phi3 model not found, pulling..." -ForegroundColor Yellow
    ollama pull phi3
}

Write-Host ""
Write-Host "🔧 Environment:" -ForegroundColor Cyan
Write-Host "   Python: $pythonCmd" -ForegroundColor Gray
Write-Host "   Ollama: localhost:11434" -ForegroundColor Gray
Write-Host "   Model: phi3:latest" -ForegroundColor Gray
Write-Host "   Redis: Upstash" -ForegroundColor Gray
Write-Host ""

# Start worker
Write-Host "🏃 Starting worker..." -ForegroundColor Green
Write-Host ""
& $pythonCmd worker.py
