# Test script to check if a reflection has been enriched
# Usage: .\test-enrichment.ps1 <reflection-id>

param(
    [Parameter(Mandatory=$true)]
    [string]$rid
)

$uri = "https://ultimate-pika-17842.upstash.io/get/reflection:$rid"
$headers = @{
    "Authorization" = "Bearer AUWyAAIncDI0ZWIwZmY3Nzc4MGI0NmMzYWIxODM4ZTBmMGFjMTM3M3AyMTc4NDI"
}

Write-Host "🔍 Checking reflection: $rid" -ForegroundColor Cyan
Write-Host ""

$response = Invoke-RestMethod -Uri $uri -Headers $headers
$data = $response.result | ConvertFrom-Json

if ($data.analysis) {
    Write-Host "✅ ENRICHED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Analysis Version: $($data.analysis.version)" -ForegroundColor Yellow
    Write-Host "Generated At: $($data.analysis.generated_at)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Primary Emotion: $($data.analysis.feelings.invoked.primary)" -ForegroundColor Magenta
    Write-Host "Secondary Emotion: $($data.analysis.feelings.invoked.secondary)" -ForegroundColor Magenta
    Write-Host "Emotion Score: $($data.analysis.feelings.invoked.score)" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "Summary: $($data.analysis.event.summary)" -ForegroundColor White
} else {
    Write-Host "❌ NOT ENRICHED YET" -ForegroundColor Red
    Write-Host ""
    Write-Host "Raw text: $($data.raw_text)" -ForegroundColor Gray
}
