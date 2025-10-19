# Behavioral Backend - Quick Commands
# Source this file in PowerShell: . .\aliases.ps1

# Set Python path
$env:PYTHON_PATH = "C:\Users\Kafka\AppData\Local\Programs\Python\Python314\python.exe"

# Create function aliases
function Analyze-Reflection {
    param(
        [string]$user,
        [string]$text,
        [string]$ts
    )
    
    if ($ts) {
        & $env:PYTHON_PATH cli.py analyze --user $user --text $text --ts $ts
    } else {
        & $env:PYTHON_PATH cli.py analyze --user $user --text $text
    }
}

function Show-Reflections {
    param(
        [string]$user,
        [int]$n = 5
    )
    
    & $env:PYTHON_PATH cli.py tail --user $user -n $n
}

function Run-Tests {
    & $env:PYTHON_PATH test.py
}

# Set short aliases
Set-Alias -Name analyze -Value Analyze-Reflection
Set-Alias -Name tail -Value Show-Reflections
Set-Alias -Name test-behavioral -Value Run-Tests

Write-Host "✅ Behavioral Backend aliases loaded!" -ForegroundColor Green
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host '  analyze -user "user123" -text "I feel great today!"'
Write-Host '  tail -user "user123" -n 5'
Write-Host "  test-behavioral"
Write-Host ""
