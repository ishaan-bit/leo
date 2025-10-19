#!/usr/bin/env python3
"""
Helper script to check if Upstash credentials are set
Supports both Vercel naming (KV_REST_API_*) and standard naming
"""
import os

def main():
    print("🔍 Checking Upstash credentials...\n")
    
    # Check Vercel naming
    kv_url = os.getenv("KV_REST_API_URL")
    kv_token = os.getenv("KV_REST_API_TOKEN")
    
    # Check standard naming
    upstash_url = os.getenv("UPSTASH_REDIS_REST_URL")
    upstash_token = os.getenv("UPSTASH_REDIS_REST_TOKEN")
    
    url = kv_url or upstash_url
    token = kv_token or upstash_token
    
    if url and token:
        print("✅ Credentials found!")
        if kv_url:
            print("   Using Vercel naming: KV_REST_API_URL, KV_REST_API_TOKEN")
        else:
            print("   Using standard naming: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN")
        print(f"   URL: {url[:30]}...")
        print(f"   Token: {token[:20]}...")
        print("\n✅ Ready to use behavioral backend!")
        return 0
    
    print("❌ Credentials not found\n")
    print("Please set one of:")
    print("\n  Option 1 (Vercel naming - recommended):")
    print("    $env:KV_REST_API_URL=\"your_url\"")
    print("    $env:KV_REST_API_TOKEN=\"your_token\"")
    print("\n  Option 2 (Standard naming):")
    print("    $env:UPSTASH_REDIS_REST_URL=\"your_url\"")
    print("    $env:UPSTASH_REDIS_REST_TOKEN=\"your_token\"")
    print("\n💡 Find these values in:")
    print("   - Vercel Dashboard > Your Project > Settings > Environment Variables")
    print("   - Upstash Console > Your Database > REST API")
    print("   - Or run: cd apps/web && vercel env pull")
    
    return 1

if __name__ == "__main__":
    exit(main())
