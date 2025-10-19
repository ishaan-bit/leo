#!/usr/bin/env python3
"""
Test script to enrich a reflection from Upstash with analysis
Usage: python enrich_reflection.py <reflection_id>
"""
import sys
import os
import json

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from agent_service import ReflectionAnalysisAgent
from persistence import UpstashStore

def main():
    if len(sys.argv) < 2:
        print("Usage: python enrich_reflection.py <reflection_id>")
        print("Example: python enrich_reflection.py refl_1760853676002_pxv98fkpp")
        sys.exit(1)
    
    rid = sys.argv[1]
    
    print(f"🔍 Fetching reflection {rid} from Upstash...")
    
    try:
        # Initialize store
        store = UpstashStore()
        agent = ReflectionAnalysisAgent(store)
        
        # Fetch reflection
        reflection_json = store.get_reflection_by_rid(rid)
        
        if not reflection_json:
            print(f"❌ Reflection {rid} not found in Upstash")
            print("Tip: Check your UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars")
            sys.exit(1)
        print(f"✓ Found reflection")
        print(f"  Owner: {reflection_json.get('owner_id')}")
        print(f"  Pig: {reflection_json.get('pig_id')}")
        print(f"  Text: {reflection_json.get('normalized_text', '')[:50]}...")
        
        # Check if already analyzed
        if reflection_json.get('analysis'):
            print(f"⚠️  Reflection already has analysis (version {reflection_json['analysis'].get('version')})")
            reprocess = input("Re-process? (y/n): ").lower().startswith('y')
            if not reprocess:
                sys.exit(0)
        
        # Process
        print(f"\n🧠 Processing reflection...")
        result = agent.process_reflection(reflection_json)
        
        if "error" in result:
            print(f"❌ Error: {result['error']}")
            sys.exit(1)
        
        print(f"\n✅ Analysis complete!")
        print(f"\n📊 Analysis Summary:")
        analysis = result.get("analysis", {})
        print(f"  Version: {analysis.get('version')}")
        print(f"  Event: {analysis.get('event', {}).get('summary')}")
        print(f"  Feelings (expressed valence): {analysis.get('feelings', {}).get('expressed', {}).get('valence')}")
        print(f"  Risk level: {analysis.get('risk', {}).get('level')}")
        print(f"  Insights: {len(analysis.get('insights', []))} generated")
        print(f"  Latency: {analysis.get('provenance', {}).get('latency_ms')}ms")
        
        print(f"\n💾 Reflection updated in Upstash")
        print(f"\nTo view in Upstash Console:")
        print(f"  Key: {rid}")
        print(f"  Or check your Vercel KV dashboard")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
