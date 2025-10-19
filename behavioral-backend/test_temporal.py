#!/usr/bin/env python3
"""
Test script for temporal state manager logic.
Tests EMA calculations, regime classification, and state evolution without Redis.
"""

import sys
import os
import time
import json
from typing import Dict, Any

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Mock persistence layer for testing
class MockTemporalPersistence:
    def __init__(self):
        self.data = {}

    def save_temporal_state(self, user_id: str, state: Dict[str, Any]):
        self.data[f"user:{user_id}:t:state"] = state

    def get_temporal_state(self, user_id: str) -> Dict[str, Any]:
        return self.data.get(f"user:{user_id}:t:state", {})

    def save_seasonality(self, user_id: str, season_type: str, period: str, value: float):
        key = f"user:{user_id}:t:season:{season_type}:{period}"
        self.data[key] = value

    def get_seasonality(self, user_id: str, season_type: str, period: str) -> float:
        key = f"user:{user_id}:t:season:{season_type}:{period}"
        return self.data.get(key, 0.0)

    def update_keyword_frequency(self, user_id: str, keyword: str, frequency: float):
        key = f"user:{user_id}:t:keywords"
        if key not in self.data:
            self.data[key] = {}
        self.data[key][keyword] = frequency

    def increment_keyword(self, user_id: str, keyword: str):
        """Increment keyword frequency."""
        key = f"user:{user_id}:t:keywords"
        if key not in self.data:
            self.data[key] = {}
        current = self.data[key].get(keyword, 0.0)
        self.data[key][keyword] = current + 1.0

    def get_keyword_frequencies(self, user_id: str) -> Dict[str, float]:
        key = f"user:{user_id}:t:keywords"
        return self.data.get(key, {})

    def log_spike_event(self, user_id: str, spike_type: str, value: float, timestamp: float):
        key = f"user:{user_id}:t:spikes"
        if key not in self.data:
            self.data[key] = []
        self.data[key].append({
            'type': spike_type,
            'value': value,
            'timestamp': timestamp
        })

    def log_spike(self, user_id: str, timestamp: float, spike_data: Dict[str, Any]):
        """Log spike event with data."""
        key = f"user:{user_id}:t:spikes"
        if key not in self.data:
            self.data[key] = []
        self.data[key].append({
            'timestamp': timestamp,
            **spike_data
        })

    def get_recent_spikes(self, user_id: str, hours: int = 24) -> list:
        key = f"user:{user_id}:t:spikes"
        spikes = self.data.get(key, [])
        cutoff = time.time() - (hours * 3600)
        return [s for s in spikes if s['timestamp'] > cutoff]

# Import temporal state manager
from temporal_state import TemporalStateManager

def test_temporal_state_evolution():
    """Test temporal state evolution with sample observations."""
    print("Testing Temporal State Manager...")

    # Initialize with mock persistence
    persistence = MockTemporalPersistence()
    manager = TemporalStateManager(persistence)

    user_id = "test_user"
    base_ts = time.time()

    # Sample observations simulating different emotional states
    observations = [
        # Normal state
        {"invoked": {"valence": 0.6, "arousal": 0.4, "dominance": 0.5}, "risk_flags": []},
        # Elevated anxiety
        {"invoked": {"valence": 0.2, "arousal": 0.8, "dominance": 0.3}, "risk_flags": ["anxiety"]},
        # Recovery
        {"invoked": {"valence": 0.7, "arousal": 0.3, "dominance": 0.6}, "risk_flags": []},
        # Alert state
        {"invoked": {"valence": 0.1, "arousal": 0.9, "dominance": 0.2}, "risk_flags": ["depression", "anxiety"]},
    ]

    # Process observations with time gaps
    time_gaps = [6, 12, 18]  # hours between observations

    current_ts = base_ts
    for i, obs in enumerate(observations):
        print(f"\n--- Processing observation {i+1} at t={current_ts:.0f} ---")
        print(f"Input: valence={obs['invoked']['valence']:.2f}, arousal={obs['invoked']['arousal']:.2f}, risk_flags={obs['risk_flags']}")

        result = manager.process_observation(user_id, obs, current_ts)

        if 'temporal_after' in result:
            temporal = result['temporal_after']
            print(f"Regime: {temporal.get('regime', 'unknown')}")
            print(f"Short-term EMA: valence={temporal.get('S', {}).get('v', 0):.3f}")
            print(f"Long-term baseline: valence={temporal.get('B', {}).get('v', 0):.3f}")
            print(f"Volatility: {temporal.get('sigma', {}).get('v', 0):.3f}")
            print(f"Risk momentum: {temporal.get('R', 0):.3f}")

        # Advance time
        if i < len(time_gaps):
            current_ts += time_gaps[i] * 3600

    # Check final state
    final_state = persistence.get_temporal_state(user_id)
    print("\n--- Final Temporal State ---")
    print(json.dumps(final_state, indent=2, default=str))

    print("\n✅ Temporal state evolution test completed successfully!")

if __name__ == "__main__":
    test_temporal_state_evolution()