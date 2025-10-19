#!/usr/bin/env python3
"""
Simple viewer for reflection analysis (Windows-compatible)
"""
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from persistence import UpstashStore

def main():
    if len(sys.argv) < 2:
        print("Usage: python view_analysis.py <reflection_id>")
        sys.exit(1)
    
    rid = sys.argv[1]
    
    try:
        store = UpstashStore()
        reflection = store.get_reflection_by_rid(rid)
        
        if not reflection:
            print(f"Reflection {rid} not found")
            sys.exit(1)
        
        print(f"\n=== Reflection {rid} ===")
        print(f"Owner: {reflection.get('owner_id')}")
        print(f"Text: {reflection.get('normalized_text')}")
        
        if 'analysis' in reflection:
            analysis = reflection['analysis']
            print(f"\n=== ANALYSIS v{analysis.get('version')} ===")
            
            # Event
            event = analysis.get('event', {})
            print(f"\nEvent: {event.get('summary')}")
            print(f"  Keywords: {', '.join(event.get('keywords', []))}")
            
            # Feelings
            feelings = analysis.get('feelings', {})
            expressed = feelings.get('expressed', {})
            print(f"\nFeelings:")
            print(f"  Valence: {expressed.get('valence')}")
            print(f"  Arousal: {expressed.get('arousal')}")
            print(f"  Families: {', '.join(expressed.get('families', []))}")
            
            # Self-awareness
            awareness = analysis.get('self_awareness', {})
            print(f"\nSelf-Awareness:")
            print(f"  Composite: {awareness.get('composite')}")
            print(f"  Depth: {awareness.get('depth')}")
            
            # Risk
            risk = analysis.get('risk', {})
            print(f"\nRisk:")
            print(f"  Level: {risk.get('level')}")
            print(f"  Flags: {', '.join(risk.get('flags', []))}")
            
            # Temporal
            temporal = analysis.get('temporal', {})
            print(f"\nTemporal:")
            print(f"  Momentum: {temporal.get('short_term_momentum')}")
            print(f"  Seasonality: {temporal.get('seasonality')}")
            
            # Insights
            insights = analysis.get('insights', [])
            print(f"\nInsights: {len(insights)}")
            for i, insight in enumerate(insights, 1):
                print(f"  {i}. {insight.get('text')}")
            
            # Provenance
            prov = analysis.get('provenance', {})
            print(f"\nLatency: {prov.get('latency_ms')}ms")
        else:
            print("\nNO ANALYSIS - Not yet enriched")
            
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
