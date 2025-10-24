#!/usr/bin/env python3
"""
Run Micro-Dream Agent with .env.local configuration.
Loads Upstash credentials and executes micro_dream_agent.py.
"""

import os
import sys
import subprocess
from pathlib import Path


def load_env_file(env_path: Path) -> dict:
    """Parse .env.local file and return key-value pairs."""
    env_vars = {}
    
    if not env_path.exists():
        print(f"[⚠] {env_path} not found, using system environment only")
        return env_vars
    
    print(f"[•] Loading environment from {env_path}...")
    
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            
            # Parse KEY=VALUE
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                
                env_vars[key] = value
                
                # Mask sensitive values in output
                if 'TOKEN' in key or 'SECRET' in key or 'KEY' in key:
                    masked = value[:8] + '...' if len(value) > 8 else '***'
                    print(f"  {key}={masked}")
                else:
                    print(f"  {key}={value[:40]}..." if len(value) > 40 else f"  {key}={value}")
    
    print(f"[✓] Loaded {len(env_vars)} environment variables\n")
    return env_vars


def main():
    """Load .env.local and run micro_dream_agent.py."""
    # Find .env.local in current directory or apps/web
    workspace = Path(__file__).parent
    env_paths = [
        workspace / '.env.local',
        workspace / 'apps' / 'web' / '.env.local'
    ]
    
    env_vars = {}
    for path in env_paths:
        if path.exists():
            env_vars = load_env_file(path)
            break
    
    # Merge with system environment
    merged_env = os.environ.copy()
    merged_env.update(env_vars)
    
    # Check required vars
    required = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']
    missing = [var for var in required if var not in merged_env]
    
    if missing:
        print(f"[✗] Missing required environment variables: {', '.join(missing)}")
        print("\nRequired in .env.local or environment:")
        print("  UPSTASH_REDIS_REST_URL")
        print("  UPSTASH_REDIS_REST_TOKEN")
        print("\nOptional:")
        print("  SID=sess_xxx           (default: sess_default)")
        print("  FORCE_DREAM=1          (bypass sign-in gating)")
        print("  SKIP_OLLAMA=1          (use raw lines, skip refinement)")
        sys.exit(1)
    
    # Prompt for SID if not set
    if 'SID' not in merged_env:
        sid = input("\nEnter session ID (SID) or press Enter for 'sess_default': ").strip()
        merged_env['SID'] = sid if sid else 'sess_default'
    
    # Find Python executable
    venv_python = workspace / '.venv' / 'Scripts' / 'python.exe'
    python_cmd = str(venv_python) if venv_python.exists() else 'python'
    
    # Execute micro_dream_agent.py
    agent_script = workspace / 'micro_dream_agent.py'
    
    if not agent_script.exists():
        print(f"[✗] {agent_script} not found")
        sys.exit(1)
    
    print(f"[•] Executing micro_dream_agent.py with Python: {python_cmd}\n")
    print(f"{'='*60}\n")
    
    try:
        result = subprocess.run(
            [python_cmd, str(agent_script)],
            env=merged_env,
            cwd=workspace,
            check=False
        )
        
        sys.exit(result.returncode)
    
    except KeyboardInterrupt:
        print("\n\n[•] Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n[✗] Execution failed: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
