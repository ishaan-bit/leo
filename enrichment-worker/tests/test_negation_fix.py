"""Quick test to verify negation integration"""
from src.enrich.pipeline_v2_2 import enrich_v2_2

# Test 1: Simple negation
print("Test 1: I am not happy")
result = enrich_v2_2("I am not happy")
print(f"  Primary: {result.primary}")
print(f"  Negation flag: {result.flags.get('negation', False)}")
print(f"  Emotion valence: {result.emotion_valence:.3f}")
print()

# Test 2: Litotes
print("Test 2: The presentation wasn't bad at all")
result = enrich_v2_2("The presentation wasn't bad at all")
print(f"  Primary: {result.primary}")
print(f"  Negation flag: {result.flags.get('negation', False)}")
print(f"  Emotion valence: {result.emotion_valence:.3f}")
print()

# Test 3: Zero markers (should be Neutral)
print("Test 3: I don't really know, just a normal day I guess")
result = enrich_v2_2("I don't really know, just a normal day I guess")
print(f"  Primary: {result.primary}")
print(f"  Is emotion neutral: {result.is_emotion_neutral}")
print(f"  Emotion presence: {result.emotion_presence}")
print()

# Test 4: No negation
print("Test 4: I am very happy")
result = enrich_v2_2("I am very happy")
print(f"  Primary: {result.primary}")
print(f"  Negation flag: {result.flags.get('negation', False)}")
print(f"  Emotion valence: {result.emotion_valence:.3f}")
