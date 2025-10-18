#!/bin/bash
# Development environment health check

echo "🔍 Checking development environment..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check TypeScript
if ! command -v tsc &> /dev/null; then
    echo "⚠️  TypeScript not installed globally (not required)"
else
    echo "✅ TypeScript $(tsc --version)"
fi

# Check environment variables
if [ ! -f .env ]; then
    echo "⚠️  .env file not found (copy from .env.example)"
else
    echo "✅ .env file exists"
fi

echo "✨ Development environment ready!"
