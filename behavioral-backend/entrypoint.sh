#!/bin/sh
echo "PORT is: $PORT"
PORT=${PORT:-8000}
exec uvicorn app:app --host 0.0.0.0 --port ${PORT}
