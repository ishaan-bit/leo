#!/usr/bin/env python3
"""
Test script for ReflectionAnalysisAgent
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from reflection_agent import ReflectionAnalysisAgent
import json

# Mock Upstash for testing
class MockUpstash:
    def __init__(self):
        self.data = {}
        self.indices = {}
    def get_reflections_by_owner_in_days(self, owner_id, days=180, limit=500):
        return []  # no history
    def save_reflection_by_rid(self, rid, data):
        self.data[rid] = data
        print(f"Saved reflection {rid}")
    def update_indices(self, owner_id, pig_id, rid, ts):
        print(f"Updated indices for {owner_id}, {pig_id}")

def test_agent():
    mock_upstash = MockUpstash()
    agent = ReflectionAnalysisAgent(mock_upstash)

    # Test with the example JSON
    reflection_json = {
        "rid": "refl_1760853676002_pxv98fkpp",
        "sid": "sess_1760847437034_y2zlmiso5",
        "timestamp": "2025-10-19T06:01:11.379Z",
        "pig_id": "testpig",
        "pig_name_snapshot": "Fury",
        "raw_text": "Kafi Dinon bad Doston Se Milkar bahut Achcha Laga",
        "normalized_text": "It felt great to meet friends after many days.",
        "lang_detected": "mixed",
        "input_mode": "voice",
        "typing_summary": None,
        "voice_summary": {
            "duration_ms": 0,
            "confidence_avg": 0,
            "confidence_min": 0,
            "silence_gaps_ms": [],
            "word_count": 9,
            "lang_detected": "mixed"
        },
        "valence": 0.27878740372671595,
        "arousal": 0.0031215648844579317,
        "confidence": 0.5654972642420342,
        "tags_auto": [],
        "tags_user": [],
        "signals": {},
        "consent_flags": {
            "research": True,
            "audio_retention": False
        },
        "client_context": {
            "device": "desktop",
            "locale": "en-US",
            "timezone": "Asia/Calcutta"
        },
        "user_id": None,
        "owner_id": "guest:sess_1760847437034_y2zlmiso5",
        "version": {
            "nlp": "1.0.0",
            "valence": "1.0.0",
            "ui": "1.0.0"
        }
    }

    result = agent.process_reflection(reflection_json)
    print("Analysis generated successfully!")
    print("Event:", json.dumps(result['analysis']['event'], indent=2))
    print("Feelings:", json.dumps(result['analysis']['feelings'], indent=2))
    print("Risk:", json.dumps(result['analysis']['risk'], indent=2))
    print("Insights:", result['analysis']['insights'])
    print("Provenance latency:", result['analysis']['provenance']['latency_ms'], "ms")

if __name__ == "__main__":
    test_agent()