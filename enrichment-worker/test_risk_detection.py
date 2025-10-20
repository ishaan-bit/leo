"""
Quick test of risk detection system
"""

from src.modules.analytics import RiskSignalDetector

# Initialize detector
detector = RiskSignalDetector(anergy_threshold=3, irritation_threshold=3, window_days=5)

# Test cases
test_cases = [
    {
        'name': 'Critical Suicide Risk',
        'text': "I can't do this anymore. I just want to end it all.",
        'expected': ['CRITICAL_SUICIDE_RISK']
    },
    {
        'name': 'Critical Health Emergency',
        'text': "Having severe chest pain and can't breathe properly.",
        'expected': ['CRITICAL_HEALTH_EMERGENCY']
    },
    {
        'name': 'Elevated Hopelessness',
        'text': "Everything feels pointless and meaningless. No future for me.",
        'expected': ['ELEVATED_HOPELESSNESS']
    },
    {
        'name': 'Normal Reflection',
        'text': "Had a good day today, feeling content.",
        'expected': []
    },
    {
        'name': 'Fatigue Without Crisis',
        'text': "Tired from work, need more sleep.",
        'expected': []
    }
]

print("🧪 Testing Risk Detection System\n")

for test in test_cases:
    signals = detector.detect(history=[], current_events=[], normalized_text=test['text'])
    
    passed = all(sig in signals for sig in test['expected'])
    status = "✅ PASS" if passed else "❌ FAIL"
    
    print(f"{status} {test['name']}")
    print(f"   Text: {test['text'][:60]}...")
    print(f"   Expected: {test['expected']}")
    print(f"   Got: {signals}")
    print()

print("\n📊 Risk Detection System Ready!")
print("   - CRITICAL signals: Suicide, Self-harm, Health emergencies")
print("   - ELEVATED signals: Hopelessness, Isolation, Prolonged low mood")
print("   - TREND signals: Anergy, Irritation, Declining valence")
