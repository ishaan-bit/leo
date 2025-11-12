"""Test sarcasm enhancement with lexicons"""
from src.enrich.sarcasm import detect_sarcasm, apply_sarcasm_penalty

# TC1: Meeting lateness with sarcasm
text1 = "Love that the meeting started 45 minutes late — really shows how much they value our time."
is_sarcastic, pattern = detect_sarcasm(text1)
print(f"TC1: '{text1}'")
print(f"  Sarcasm detected: {is_sarcastic}, Pattern: {pattern}")
print()

# Test sarcasm penalty
p_hf = {'Happy': 0.40, 'Strong': 0.25, 'Angry': 0.15, 'Sad': 0.10, 'Fearful': 0.05, 'Peaceful': 0.05}
event_valence = 0.75
modified_probs, modified_ev = apply_sarcasm_penalty(p_hf, event_valence)
print(f"Original HF: {p_hf}")
print(f"After penalty: {modified_probs}")
print(f"Event valence: {event_valence} → {modified_ev}")
print()

# Test other patterns
text2 = "Great 🙃 another delay"
is_sarcastic2, pattern2 = detect_sarcasm(text2)
print(f"TC2: '{text2}'")
print(f"  Sarcasm detected: {is_sarcastic2}, Pattern: {pattern2}")
print()

text3 = "Yeah right, like that's going to work"
is_sarcastic3, pattern3 = detect_sarcasm(text3)
print(f"TC3: '{text3}'")
print(f"  Sarcasm detected: {is_sarcastic3}, Pattern: {pattern3}")
