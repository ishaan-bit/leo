#!/usr/bin/env python3
"""
View a reflection's analysis from Upstash
Usage: python view_reflection.py <reflection_id>
"""
import sys
import os
import json

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from persistence import UpstashStore

def main():
    if len(sys.argv) < 2:
        print("Usage: python view_reflection.py <reflection_id>")
        print("Example: python view_reflection.py refl_1760854132268_rbrpm3qz4")
        sys.exit(1)
    
    rid = sys.argv[1]
    
    print(f"🔍 Fetching reflection {rid} from Upstash...\n")
    
    try:
        store = UpstashStore()
        reflection_json = store.get_reflection_by_rid(rid)
        
        if not reflection_json:
            print(f"❌ Reflection {rid} not found in Upstash")
            sys.exit(1)
        
        # Display reflection details
        print("📝 Reflection Details:")
        print(f"  RID: {reflection_json.get('rid')}")
        print(f"  Owner: {reflection_json.get('owner_id')}")
        print(f"  Pig: {reflection_json.get('pig_id')}")
        print(f"  Timestamp: {reflection_json.get('timestamp')}")
        print(f"  Text: {reflection_json.get('normalized_text')}")
        
        # Display analysis if present
        if 'analysis' in reflection_json:
            analysis = reflection_json['analysis']
            print(f"\n🧠 Analysis (v{analysis.get('version')}):")
            print(f"\n  Event:")
            event = analysis.get('event', {})
            print(f"    Category: {event.get('category')}")
            print(f"    Summary: {event.get('summary')}")
            print(f"    Keywords: {', '.join(event.get('keywords', []))}")
            
            print(f"\n  Feelings:")
            feelings = analysis.get('feelings', {})
            expressed = feelings.get('expressed', {})
            print(f"    Expressed valence: {expressed.get('valence')}")
            print(f"    Expressed arousal: {expressed.get('arousal')}")
            print(f"    Families: {', '.join(expressed.get('families', []))}")
            
            print(f"\n  Self-Awareness:")
            awareness = analysis.get('self_awareness', {})
            print(f"    Score: {awareness.get('score')}/10")
            print(f"    Depth: {awareness.get('depth')}")
            print(f"    Indicators: {', '.join(awareness.get('indicators', []))}")
            
            print(f"\n  Risk Assessment:")
            risk = analysis.get('risk', {})
            print(f"    Level: {risk.get('level')}")
            print(f"    Flags: {', '.join(risk.get('flags', []))}")
            
            print(f"\n  Temporal Features:")
            temporal = analysis.get('temporal', {})
            print(f"    Momentum: {temporal.get('momentum')}")
            print(f"    Valence Z-score: {temporal.get('valence_z')}")
            print(f"    Streak days: {temporal.get('streak_days')}")
            
            print(f"\n  Insights:")
            insights = analysis.get('insights', [])
            if insights:
                for i, insight in enumerate(insights, 1):
                    print(f"    {i}. {insight.get('text')} (confidence: {insight.get('confidence')})")
            else:
                print(f"    No insights generated")
            
            print(f"\n  Metadata:")
            provenance = analysis.get('provenance', {})
            print(f"    Processed at: {provenance.get('timestamp')}")
            print(f"    Latency: {provenance.get('latency_ms')}ms")
            print(f"    History size: {provenance.get('history_size')} reflections")
            
        else:
            print(f"\n⚠️  No analysis found for this reflection")
        
        # Pretty print full JSON
        print(f"\n\n📄 Full JSON:")
        print(json.dumps(reflection_json, indent=2))
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
