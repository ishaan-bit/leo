"""Test lexicon loader"""
from src.enrich.lexicons import *

# Test loader
print("✅ Lexicons loaded successfully!")
print(f"Sarcasm shells: {len(get_sarcasm_shells()['phrases'])} phrases")
print(f"Negative anchors: {len(get_all_negative_anchors())} total")
print(f"Positive anchors: {len(get_all_positive_anchors())} total")
print(f"Agency verbs: {len(get_agency_verbs())} verbs")
print(f"Emotion terms (joy): {len(get_emotion_terms('joy'))} words")
print(f"Duration patterns: {len(get_duration_patterns())} regex patterns")

# Test samples
print("\n📋 Sample data:")
print(f"First 3 sarcasm phrases: {get_sarcasm_shells()['phrases'][:3]}")
print(f"First 3 agency verbs: {get_agency_verbs()[:3]}")
print(f"Concession markers: {get_concession_markers()}")
