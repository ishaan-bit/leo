with open('micro_dream_agent_mock.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Unicode symbols with ASCII
replacements = {
    '✓': 'OK',
    '✗': 'X',
    '•': '*',
    '⚠': '!',
    'Δ': 'delta',
    '→': '->',
    '≥': '>=',
    '≤': '<=',
    '±': '+/-'
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open('micro_dream_agent_mock_fixed.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("Created micro_dream_agent_mock_fixed.py with ASCII symbols")
