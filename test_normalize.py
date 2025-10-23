#!/usr/bin/env python3
"""Test poem normalization logic"""

def split_single_poem(poem):
    """Split a single-line poem into two lines"""
    words = poem.split()
    
    if len(words) >= 6:
        mid = len(words) // 2
        line1 = ' '.join(words[:mid])
        line2 = ' '.join(words[mid:])
        return f"{line1}, {line2}"
    
    return f"{poem}, ..."

# Your example data
poems = [
    "All my work in a whirlwind of time",
    "Work done, now peace sits on the dome"
]

print("=" * 60)
print("TESTING POEM NORMALIZATION")
print("=" * 60)
print()

for i, poem in enumerate(poems, 1):
    print(f"Poem {i}: {poem}")
    print(f"  Length: {len(poem)} chars, {len(poem.split())} words")
    print(f"  Has comma: {', ' in poem}")
    
    if ',' in poem:
        print(f"  ✅ Already correct format")
        print(f"  Result: {poem}")
    else:
        result = split_single_poem(poem)
        print(f"  🔧 Needs splitting")
        print(f"  Result: {result}")
        
        # Show the two lines
        lines = result.split(',')
        print(f"    Line 1: {lines[0].strip()}")
        print(f"    Line 2: {lines[1].strip()}")
    
    print()

print("=" * 60)
print("FINAL NORMALIZED POEMS:")
print("=" * 60)
poem1 = poems[0] if ',' in poems[0] else split_single_poem(poems[0])
poem2 = poems[1] if ',' in poems[1] else split_single_poem(poems[1])

print(f"1. {poem1}")
print(f"2. {poem2}")
