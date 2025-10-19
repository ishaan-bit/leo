#!/bin/sh
# Entrypoint script for Railway deployment
# Properly handles PORT environment variable

PORT=${PORT:-8000}
exec uvicorn app:app --host 0.0.0.0 --port "$PORT"
