#!/usr/bin/env python3
"""
Quick setup script for behavioral backend.
Installs dependencies and downloads required corpora.
"""

import subprocess
import sys
import os


def run_command(cmd, description):
    """Run a command and print status."""
    print(f"\n{'='*60}")
    print(f"{description}")
    print(f"{'='*60}")
    print(f"Running: {' '.join(cmd)}\n")
    
    result = subprocess.run(cmd)
    
    if result.returncode != 0:
        print(f"\n❌ Failed: {description}")
        sys.exit(1)
    else:
        print(f"\n✓ Success: {description}")


def main():
    print("\n" + "="*60)
    print("BEHAVIORAL BACKEND - SETUP")
    print("="*60)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required")
        sys.exit(1)
    
    print(f"✓ Python {sys.version_info.major}.{sys.version_info.minor}")
    
    # Install dependencies
    run_command(
        [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
        "Installing Python dependencies"
    )
    
    # Download TextBlob corpora
    run_command(
        [sys.executable, "-m", "textblob.download_corpora"],
        "Downloading TextBlob corpora"
    )
    
    # Check for .env file
    print(f"\n{'='*60}")
    print("Environment Configuration")
    print(f"{'='*60}")
    
    if not os.path.exists(".env"):
        print("\n⚠️  .env file not found")
        print("Please copy .env.example to .env and fill in your credentials:")
        print("\n  cp .env.example .env")
        print("\nThen edit .env with your Upstash URL and token.")
    else:
        print("\n✓ .env file exists")
    
    # Final instructions
    print(f"\n{'='*60}")
    print("SETUP COMPLETE")
    print(f"{'='*60}")
    print("\nNext steps:")
    print("  1. Configure .env with your Upstash credentials (if not done)")
    print("  2. Run a test: python cli.py analyze --user test1 --text \"I feel great today!\"")
    print("  3. Run test suite: python test.py")
    print("\nSee README.md for full documentation.")
    print()


if __name__ == "__main__":
    main()
