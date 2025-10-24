#!/usr/bin/env python3
"""Test sign-in gating pattern across multiple sign-ins."""

import subprocess
import os

print("\nSign-In Gating Pattern Test")
print("=" * 60)
print("Pattern: skip 1, skip 2 → play on #3, 5, 8, 10, 13, 15...")
print("=" * 60 + "\n")

venv_python = r"c:/Users/Kafka/Documents/Leo/.venv/Scripts/python.exe"
script = r"c:\Users\Kafka\Documents\Leo\micro_dream_agent_mock_fixed.py"

for signin in range(1, 16):
    env = os.environ.copy()
    env['SKIP_OLLAMA'] = '1'
    env['SIGNIN_COUNT'] = str(signin)
    
    result = subprocess.run(
        [venv_python, script],
        env=env,
        capture_output=True,
        text=True
    )
    
    # Check output for display status
    output = result.stdout
    stderr = result.stderr
    
    if stderr:
        print(f"Signin #{signin:2d}: ERROR - {stderr[:50]}")
        continue
    
    if "[OK] DISPLAY ON THIS SIGN-IN" in output:
        print(f"Signin #{signin:2d}: OK DISPLAY")
    elif "Next display eligible" in output:
        # Extract next eligible number
        for line in output.split('\n'):
            if "Next display eligible" in line:
                print(f"Signin #{signin:2d}: ○ skip (next: {line.split('#')[1].split()[0]})")
                break
    else:
        print(f"Signin #{signin:2d}: ? (output error)")

print("\n" + "=" * 60)
print("Expected: OK on #3, 5, 8, 10, 13, 15")
print("=" * 60 + "\n")
