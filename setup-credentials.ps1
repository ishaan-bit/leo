# Helper script to set up Upstash credentials for behavioral backend
# Run this from the Leo root directory

Write-Host "Looking for Upstash credentials in your Vercel project..." -ForegroundColor Cyan

# Check if .env.local exists in apps/web
$envFile = "apps\web\.env.local"

if (Test-Path $envFile) {
    Write-Host "Found .env.local in apps/web" -ForegroundColor Green
    
    # Read the file and extract KV credentials
    $content = Get-Content $envFile -Raw
    
    if ($content -match 'KV_REST_API_URL=(.+)') {
        $url = $matches[1].Trim().Trim('"').Trim("'")
        $env:KV_REST_API_URL = $url
        Write-Host "Set KV_REST_API_URL" -ForegroundColor Green
    }
    
    if ($content -match 'KV_REST_API_TOKEN=(.+)') {
        $token = $matches[1].Trim().Trim('"').Trim("'")
        $env:KV_REST_API_TOKEN = $token
        Write-Host "Set KV_REST_API_TOKEN" -ForegroundColor Green
    }
    
    if ($env:KV_REST_API_URL -and $env:KV_REST_API_TOKEN) {
        Write-Host ""
        Write-Host "Credentials loaded successfully!" -ForegroundColor Green
        Write-Host "URL: $($env:KV_REST_API_URL.Substring(0, [Math]::Min(30, $env:KV_REST_API_URL.Length)))..." -ForegroundColor Gray
        Write-Host ""
        Write-Host "Testing connection..." -ForegroundColor Cyan
        
        # Test the connection
        cd behavioral-backend
        python check_credentials.py
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "Ready to use! Try:" -ForegroundColor Green
            Write-Host "  python test_upstash_connection.py" -ForegroundColor Yellow
        }
    } else {
        Write-Host ""
        Write-Host "Credentials not found in .env.local" -ForegroundColor Yellow
        Write-Host "Make sure KV_REST_API_URL and KV_REST_API_TOKEN are set" -ForegroundColor Yellow
    }
    
} else {
    Write-Host "No .env.local found in apps/web" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To get your credentials:" -ForegroundColor Cyan
    Write-Host "  1. cd apps\web" -ForegroundColor Gray
    Write-Host "  2. vercel env pull" -ForegroundColor Gray
    Write-Host "  3. Come back and run this script again" -ForegroundColor Gray
    Write-Host ""
    Write-Host "OR find them in:" -ForegroundColor Cyan
    Write-Host "  - Vercel Dashboard > Settings > Environment Variables" -ForegroundColor Gray
    Write-Host "  - Upstash Console > Your Database > REST API" -ForegroundColor Gray
}
