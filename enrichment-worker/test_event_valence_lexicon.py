"""Test expanded event valence with lexicons"""
from src.enrich.event_valence import detect_event_anchors, compute_event_valence

# Test meeting lateness (v2.0+ anchor)
text1 = "The meeting started 45 minutes late"
pos, neg = detect_event_anchors(text1)
ev = compute_event_valence(text1)
print(f"TC1: '{text1}'")
print(f"  Positive: {pos}")
print(f"  Negative: {neg}")
print(f"  Event valence: {ev:.3f}")
print()

# Test promotion (career category)
text2 = "Got promoted to senior engineer"
pos2, neg2 = detect_event_anchors(text2)
ev2 = compute_event_valence(text2)
print(f"TC2: '{text2}'")
print(f"  Positive: {pos2}")
print(f"  Negative: {neg2}")
print(f"  Event valence: {ev2:.3f}")
print()

# Test delay + blocker (v2.0+)
text3 = "Project delayed because we're blocked by the outage"
pos3, neg3 = detect_event_anchors(text3)
ev3 = compute_event_valence(text3)
print(f"TC3: '{text3}'")
print(f"  Positive: {pos3}")
print(f"  Negative: {neg3}")
print(f"  Event valence: {ev3:.3f}")
print()

# Test delivery (v2.0+)
text4 = "Finally shipped the new feature to production"
pos4, neg4 = detect_event_anchors(text4)
ev4 = compute_event_valence(text4)
print(f"TC4: '{text4}'")
print(f"  Positive: {pos4}")
print(f"  Negative: {neg4}")
print(f"  Event valence: {ev4:.3f}")
