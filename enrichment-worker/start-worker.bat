@echo off
echo Starting Leo Enrichment Worker...
echo.

REM Add Ollama to PATH
set PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama

REM Change to worker directory
cd /d "%~dp0"

REM Run worker
python worker.py

pause
