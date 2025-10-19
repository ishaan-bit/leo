# 🧪 Complete Flow Test Summary

**Environment:** HTTPS Development Server  
**URLs:**
- Local: `https://localhost:3000`
- Network: `https://10.150.133.214:3000`

**Status:** ✅ Server Running

---

## Quick Test Commands

### 1. Test Pig Naming Flow

```bash
# Open browser and visit:
https://localhost:3000/p/test_pig_001

# Expected:
# - Pig naming form appears
# - Enter name (any language: English, Hindi, Hinglish)
# - Submit redirects to: /reflect/test_pig_001
# - Name saved in Redis: pig:test_pig_001
```

### 2. Test Reflection Submission (Typing - English)

```bash
# After naming pig, on reflect page:
# - Type: "I feel peaceful and calm today"
# - Click submit
# - Check console logs for: "✅ Reflection saved to KV: refl_..."
```

### 3. Test Reflection Submission (Typing - Hindi)

```bash
# Switch to new pig:
https://localhost:3000/p/test_pig_hindi

# Name pig: "फूल"
# Type: "आज मुझे बहुत अच्छा लग रहा है"
# Submit
# Original Hindi text preserved in database
```

### 4. Test Reflection Submission (Typing - Hinglish)

```bash
# New pig:
https://localhost:3000/p/test_pig_hinglish

# Name pig: "Baadal"
# Type: "Aaj thoda down feel ho raha hai yaar"
# Submit
# Hinglish text preserved as-is
```

### 5. Test Voice Mode

```bash
# On reflect page:
# - Click toggle button (switches notebook → voice)
# - Click voice orb
# - Speak: "I'm feeling good today"
# - Auto-transcribes and submits
# - inputMode: 'voice' saved to database
```

### 6. Test Guest Mode

```bash
# Default behavior (no sign-in)
# - Session ID stored in localStorage
# - owner_id: "guest:{sessionId}"
# - signed_in: false
# - All reflections linked to guest session
```

### 7. Test Signed-In Mode

```bash
# Click "sign in" button
# - Authenticate with Google
# - owner_id: "user:{userId}"
# - signed_in: true
# - All future reflections linked to user account
```

---

## Expected Redis Data Structure

### After Creating 1 Reflection

```redis
# Reflection object
Key: reflection:refl_1729342800000_xyz
Type: Hash
Value: {
  id: "refl_1729342800000_xyz",
  owner_id: "guest:session_abc123",
  user_id: null,
  session_id: "session_abc123",
  signed_in: false,
  pig_id: "test_pig_001",
  pig_name: "Guldasta",
  text: "I feel peaceful and calm today",
  valence: null,
  arousal: null,
  language: null,
  input_mode: "typing",
  metrics: {},
  device_info: { type: "desktop", platform: "Windows", ... },
  consent_research: true,
  created_at: "2025-10-19T..."
}

# Owner's reflection list
Key: reflections:guest:session_abc123
Type: Sorted Set
Members: ["refl_1729342800000_xyz"] with score (timestamp)

# Pig's reflection list
Key: pig_reflections:test_pig_001
Type: Sorted Set
Members: ["refl_1729342800000_xyz"] with score (timestamp)

# Pig info
Key: pig:test_pig_001
Type: Hash
Value: {
  pig_id: "test_pig_001",
  name: "Guldasta",
  owner_id: "guest:session_abc123",
  user_id: null,
  session_id: "session_abc123",
  created_at: "2025-10-19T...",
  updated_at: "2025-10-19T..."
}
```

---

## API Endpoints to Test

### 1. POST /api/reflect

**Test with cURL:**
```bash
curl -k -X POST https://localhost:3000/api/reflect \
  -H "Content-Type: application/json" \
  -d '{
    "pigId": "curl_test_pig",
    "pigName": "Test Pig",
    "inputType": "notebook",
    "originalText": "Testing from cURL",
    "detectedLanguage": "en",
    "affect": {
      "valence": 0.5,
      "arousal": 0.3
    },
    "deviceInfo": {
      "type": "api",
      "platform": "cURL"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Reflection saved to database",
  "data": {
    "reflectionId": "refl_...",
    "ownerId": "guest:...",
    "pigId": "curl_test_pig",
    "timestamp": "2025-10-19T..."
  }
}
```

### 2. GET /api/reflect?pigId=...

**Test:**
```bash
curl -k https://localhost:3000/api/reflect?pigId=test_pig_001
```

**Expected Response:**
```json
{
  "success": true,
  "reflections": [
    {
      "id": "refl_...",
      "text": "I feel peaceful and calm today",
      "pig_name": "Guldasta",
      "created_at": "2025-10-19T...",
      ...
    }
  ],
  "count": 1
}
```

### 3. GET /api/reflect?ownerId=...

**Test:**
```bash
curl -k https://localhost:3000/api/reflect?ownerId=guest:session_abc123
```

**Expected Response:**
```json
{
  "success": true,
  "reflections": [ /* all reflections for this owner */ ],
  "count": 3
}
```

### 4. GET /api/pig/[pigId]

**Test:**
```bash
curl -k https://localhost:3000/api/pig/test_pig_001
```

**Expected Response:**
```json
{
  "pigId": "test_pig_001",
  "named": true,
  "name": "Guldasta"
}
```

### 5. POST /api/pig/name

**Test:**
```bash
curl -k -X POST https://localhost:3000/api/pig/name \
  -H "Content-Type: application/json" \
  -d '{
    "pigId": "curl_pig_002",
    "name": "Curl Pig"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "pigId": "curl_pig_002",
  "name": "Curl Pig"
}
```

---

## Browser Console Tests

### Check Session ID
```javascript
// In browser console:
localStorage.getItem('sessionId')
// Should return: "session_xyz..."
```

### Check Ambient Sound State
```javascript
// In browser console:
localStorage.getItem('leo.ambient.muted')
// Should return: "false" or "true"

window.__leoAmbientSound
// Should return: Howl object if sound initialized
```

### Manual Reflection Save Test
```javascript
// In browser console on reflect page:
fetch('/api/reflect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    pigId: 'console_test_pig',
    pigName: 'Console Pig',
    inputType: 'notebook',
    originalText: 'Testing from browser console',
    detectedLanguage: 'en'
  })
})
  .then(r => r.json())
  .then(data => console.log('✅ Saved:', data))
  .catch(err => console.error('❌ Error:', err));
```

---

## Multi-Language Test Cases

### Test 1: Pure English
```
Input: "I am feeling very calm and peaceful today"
Expected Storage:
- text: "I am feeling very calm and peaceful today"
- language: null (if not implemented)
- Stored as-is
```

### Test 2: Pure Hindi (Devanagari)
```
Input: "आज मैं बहुत शांत और खुश महसूस कर रहा हूं"
Expected Storage:
- text: "आज मैं बहुत शांत और खुश महसूस कर रहा हूं"
- language: "hi" (if detected)
- Original Hindi preserved
```

### Test 3: Hinglish (Roman Script)
```
Input: "Aaj main bahut peaceful feel kar raha hoon"
Expected Storage:
- text: "Aaj main bahut peaceful feel kar raha hoon"
- language: "hi-en" (if detected)
- Hinglish preserved as-is
```

### Test 4: Mixed Hindi-English
```
Input: "Today मुझे बहुत अच्छा feel हो रहा है"
Expected Storage:
- text: "Today मुझे बहुत अच्छा feel हो रहा है"
- language: "mixed" (if detected)
- Mixed script preserved
```

### Test 5: Emoji Support
```
Input: "Feeling good today 😊🌸"
Expected Storage:
- text: "Feeling good today 😊🌸"
- Emojis preserved
```

---

## Device Context Tests

### Desktop - Windows
```
Expected device_info:
{
  type: "desktop",
  platform: "Windows",
  locale: "en-US",
  timezone: "America/New_York"
}
```

### Mobile - iOS
```
Expected device_info:
{
  type: "mobile",
  platform: "iOS",
  locale: "en-IN",
  timezone: "Asia/Kolkata"
}
```

### Mobile - Android
```
Expected device_info:
{
  type: "mobile",
  platform: "Android",
  locale: "hi-IN",
  timezone: "Asia/Kolkata"
}
```

---

## Server Logs to Monitor

### Successful Reflection Save
```
💭 Saving reflection: {
  ownerId: 'guest:session_abc123',
  pigId: 'test_pig_001',
  signedIn: false,
  textLength: 28,
  inputType: 'notebook'
}
✅ Reflection saved to KV: refl_1729342800000_xyz
```

### Successful Pig Name Save
```
✅ Pig info saved: test_pig_001 Guldasta
```

### Failed Validation
```
❌ Error saving reflection: Missing required fields: pigId, originalText
```

---

## Verification Checklist

After each test, verify:

- [ ] Server console shows "✅ Reflection saved to KV: refl_..."
- [ ] Server console shows "✅ Pig info saved: [pigId] [name]"
- [ ] No error messages in server console
- [ ] No error messages in browser console
- [ ] Reflection page shows success state (check marks, blush effect)
- [ ] Original language text is preserved (no unwanted translation)
- [ ] Correct owner_id format (guest:... or user:...)
- [ ] Correct input_mode ('typing' or 'voice')
- [ ] Device info captured correctly

---

## Known Working Features

✅ **HTTPS Server**
- Running on https://localhost:3000
- Self-signed certificates working
- Network access available

✅ **Pig Naming**
- Any language support (English, Hindi, Hinglish)
- Redis persistence
- Duplicate name prevention (per pig)

✅ **Guest Session**
- Auto-generated session ID
- localStorage persistence
- Works without authentication

✅ **Reflection Storage**
- Original text preserved (any language)
- Redis KV storage
- Sorted sets for chronological queries

✅ **API Endpoints**
- POST /api/reflect - saves reflections
- GET /api/reflect - retrieves by pig or owner
- POST /api/pig/name - saves pig names
- GET /api/pig/[pigId] - gets pig info

✅ **Multi-Language**
- English support
- Hindi (Devanagari) support
- Hinglish support
- Mixed script support
- Emoji support

---

## Features Not Yet Implemented

⚠️ **Language Detection**
- Currently passes `detectedLanguage` but not computed
- Need to add language detection library

⚠️ **Sentiment Analysis**
- `valence` and `arousal` currently null
- Need sentiment analysis integration

⚠️ **Text Normalization**
- No automatic translation to English
- Original text stored as-is (which is correct for now)

⚠️ **Guest → User Migration**
- Not triggered on sign-in
- Need to implement migration logic in auth callback

⚠️ **Typing Metrics**
- `metrics` field empty for notebook input
- Need to capture typing speed, pauses, etc.

⚠️ **Voice Metrics**
- `metrics` field empty for voice input
- Need to capture duration, confidence, etc.

---

## Next Steps

1. **Test the complete flow manually:**
   - Visit https://localhost:3000/p/test_001
   - Name the pig
   - Write a reflection
   - Check server logs
   - Query the API to verify storage

2. **Add language detection:**
   ```bash
   npm install franc-min
   # or
   npm install @google-cloud/translate
   ```

3. **Add sentiment analysis:**
   ```bash
   npm install sentiment
   # or integrate with external API
   ```

4. **Implement guest→user migration:**
   - Add migration call in NextAuth callback
   - Update all guest reflections to user

5. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "Complete reflection storage with KV"
   git push origin main
   # Auto-deploys to Vercel
   ```

---

## Production URLs

Once deployed, update these in `.env.production`:

```env
NEXT_PUBLIC_BASE_URL=https://leo-indol-theta.vercel.app
NEXTAUTH_URL=https://leo-indol-theta.vercel.app
```

All API calls will use HTTPS automatically in production.
