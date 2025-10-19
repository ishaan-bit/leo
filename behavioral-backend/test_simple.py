from hybrid_analyzer import HybridAnalyzer
from temporal_state import TemporalStateManager

class MockPersistence:
    def __init__(self):
        self.data = {}
    def save_temporal_state(self, uid, state):
        self.data[f"{uid}:state"] = state
    def get_temporal_state(self, uid):
        return self.data.get(f"{uid}:state", {})
    def save_seasonality(self, *args): pass
    def get_seasonality(self, *args): return {}
    def increment_keyword(self, *args): pass
    def log_spike(self, *args): pass

# Create hybrid analyzer with temporal DISABLED initially
h = HybridAnalyzer(use_llm=False, enable_temporal=False)

# Inject temporal manager AFTER init to bypass credential check
h.temporal_manager = TemporalStateManager(MockPersistence())
h.enable_temporal = True  # Re-enable after injection

print(f"enable_temporal: {h.enable_temporal}")
print(f"temporal_manager: {h.temporal_manager}")

# Force flush to ensure messages appear
import sys
sys.stderr.flush()
sys.stdout.flush()

# Test analysis
print("\nCalling analyze_reflection...")
print(f"Method: {h.analyze_reflection}")
print(f"Class: {h.__class__.__name__}")
result = h.analyze_reflection("I feel anxious", "user1")

sys.stderr.flush()
sys.stdout.flush()

print(f"\nResult keys: {list(result.keys())}")
print(f"Hybrid keys: {list(result['hybrid'].keys())}")
print(f"Has temporal_after: {'temporal_after' in result['hybrid']}")
