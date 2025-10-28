"""Remove UTF-8 BOM from .env file"""
with open('.env', 'rb') as f:
    content = f.read()

# Remove BOM if present
if content.startswith(b'\xef\xbb\xbf'):
    print("Found UTF-8 BOM, removing...")
    content = content[3:]  # Skip the 3-byte BOM
    with open('.env', 'wb') as f:
        f.write(content)
    print("BOM removed successfully!")
else:
    print("No BOM found, file is OK")
