#!/usr/bin/env python3
"""
Load .env.local and run dream_cli.py
Usage: python run_dream_cli.py
"""

import os
import sys
from pathlib import Path

def load_env_file(filepath: Path):
    """Load environment variables from .env file"""
    if not filepath.exists():
        return False
    
    print(f"[Loading env from: {filepath}]", file=sys.stderr)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            # Parse KEY=VALUE
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                # Remove quotes if present
                if value.startswith('"') and value.endswith('"'):
                    value = value[1:-1]
                elif value.startswith("'") and value.endswith("'"):
                    value = value[1:-1]
                
                # Only set if not empty
                if value:
                    os.environ[key] = value
                    
                    # Mask sensitive values
                    if 'SECRET' in key or 'TOKEN' in key or 'KEY' in key:
                        masked = value[:8] + '...' + value[-4:] if len(value) > 12 else '***'
                        print(f"  {key}={masked}", file=sys.stderr)
                    else:
                        print(f"  {key}={value}", file=sys.stderr)
    
    return True

def main():
    # Try to find .env.local in apps/web
    root = Path(__file__).parent
    env_path = root / 'apps' / 'web' / '.env.local'
    
    if not env_path.exists():
        print(f"\n❌ .env.local not found at: {env_path}", file=sys.stderr)
        print("\nCreate it with Upstash credentials:", file=sys.stderr)
        print("  KV_REST_API_URL=https://your-db.upstash.io", file=sys.stderr)
        print("  KV_REST_API_TOKEN=your-token\n", file=sys.stderr)
        print("Get credentials from:", file=sys.stderr)
        print("  Vercel Dashboard → Your Project → Storage → Upstash Redis → .env.local tab\n", file=sys.stderr)
        sys.exit(1)
    
    # Load env vars
    load_env_file(env_path)
    
    # Check if required vars are set
    has_upstash = os.getenv('UPSTASH_REDIS_REST_URL') or os.getenv('KV_REST_API_URL')
    
    if not has_upstash:
        print("\n❌ Missing Upstash credentials in .env.local", file=sys.stderr)
        print("Add these lines:", file=sys.stderr)
        print("  KV_REST_API_URL=https://...", file=sys.stderr)
        print("  KV_REST_API_TOKEN=...\n", file=sys.stderr)
        sys.exit(1)
    
    print("\n[✓] Environment loaded\n", file=sys.stderr)
    
    # Now run dream_cli.py
    import dream_cli
    dream_cli.main()

if __name__ == '__main__':
    main()
