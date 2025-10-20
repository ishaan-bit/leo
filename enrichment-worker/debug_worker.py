"""Quick debug script to find the worker error"""
import sys
print("1. Loading dotenv...")
from dotenv import load_dotenv
load_dotenv()

print("2. Importing redis_client...")
try:
    from src.modules.redis_client import get_redis
    print("   ✅ redis_client imported")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("3. Importing ollama_client...")
try:
    from src.modules.ollama_client import OllamaClient
    print("   ✅ ollama_client imported")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("4. Importing analytics...")
try:
    from src.modules.analytics import (
        TemporalAnalyzer, 
        CircadianAnalyzer, 
        WillingnessAnalyzer,
        LatentStateTracker,
        QualityAnalyzer,
        RiskSignalDetector
    )
    print("   ✅ analytics imported")
except Exception as e:
    print(f"   ❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("5. Importing comparator...")
try:
    from src.modules.comparator import EventComparator
    print("   ✅ comparator imported")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("6. Importing recursion...")
try:
    from src.modules.recursion import RecursionDetector
    print("   ✅ recursion imported")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("7. Creating Redis client...")
try:
    redis_client = get_redis()
    print("   ✅ Redis client created")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("8. Testing Redis ping...")
try:
    result = redis_client.ping()
    print(f"   ✅ Redis ping: {result}")
except Exception as e:
    print(f"   ❌ Error: {e}")
    sys.exit(1)

print("\n✅ All imports successful! Worker should work.")
