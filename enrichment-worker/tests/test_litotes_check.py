"""Test litotes detection"""
from src.enrich.negation import analyze_negation

test_cases = [
    "The presentation wasn't bad at all",
    "I'm not unhappy with how things turned out",
    "Not a terrible outcome",
]

for text in test_cases:
    result = analyze_negation(text)
    print(f"Text: {text}")
    print(f"  Strength: {result.strength}")
    print(f"  Has negation: {result.has_negation}")
    print(f"  Flip factor: {result.flip_factor}")
    print()
