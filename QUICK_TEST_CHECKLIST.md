# ✅ Quick Test Checklist

**Server:** https://localhost:3000 (HTTPS ✓)  
**Status:** Running ✓

---

## 🎯 Flow Test: Pig Naming → Reflection Storage

### Test 1: English Flow
- [ ] Visit: `https://localhost:3000/p/eng_001`
- [ ] Name pig: `Fluffy`
- [ ] Redirects to: `/reflect/eng_001` ✓
- [ ] Type reflection: `I feel peaceful today`
- [ ] Submit → Check console for: `✅ Reflection saved`
- [ ] **Verify Redis:**
  - `pig:eng_001` → `{ name: "Fluffy" }`
  - `reflection:refl_*` → Original text preserved

### Test 2: Hindi Flow
- [ ] Visit: `https://localhost:3000/p/hindi_001`
- [ ] Name pig: `फूल`
- [ ] Redirects to: `/reflect/hindi_001` ✓
- [ ] Type reflection: `आज मुझे अच्छा लग रहा है`
- [ ] Submit → Check console
- [ ] **Verify:** Hindi text stored as-is (no translation)

### Test 3: Hinglish Flow
- [ ] Visit: `https://localhost:3000/p/hinglish_001`
- [ ] Name pig: `Baadal`
- [ ] Type reflection: `Aaj thoda peaceful feel ho raha hai`
- [ ] Submit → Check console
- [ ] **Verify:** Hinglish preserved exactly

### Test 4: Voice Mode
- [ ] On any reflect page
- [ ] Toggle input mode (notebook → voice)
- [ ] Click voice orb
- [ ] Speak: `I am testing voice input`
- [ ] Auto-submits
- [ ] **Verify:** `input_mode: "voice"` in Redis

### Test 5: Guest vs Signed-In
**Guest Mode (default):**
- [ ] Check top bar: "continuing as guest"
- [ ] Create 2 reflections
- [ ] **Verify:** `owner_id: "guest:session_*"`
- [ ] **Verify:** `signed_in: false`

**Signed-In Mode:**
- [ ] Click "sign in" button
- [ ] Authenticate with Google
- [ ] Check top bar: "signed in as you"
- [ ] Create reflection
- [ ] **Verify:** `owner_id: "user:*"`
- [ ] **Verify:** `signed_in: true`

---

## 🔍 API Tests (cURL)

### Save Reflection
```bash
curl -k -X POST https://localhost:3000/api/reflect \
  -H "Content-Type: application/json" \
  -d '{"pigId":"api_test","pigName":"API Pig","inputType":"notebook","originalText":"API test reflection"}'
```
- [ ] Response: `{ "success": true, "data": { "reflectionId": "refl_..." } }`

### Get Reflections by Pig
```bash
curl -k "https://localhost:3000/api/reflect?pigId=eng_001"
```
- [ ] Response: Array of reflections with correct data

### Get Pig Info
```bash
curl -k "https://localhost:3000/api/pig/eng_001"
```
- [ ] Response: `{ "pigId": "eng_001", "named": true, "name": "Fluffy" }`

---

## 📊 Data Verification

Open browser console on reflect page and run:

```javascript
// Check session
localStorage.getItem('sessionId')
// Should return: "session_..."

// Test API call
fetch('/api/reflect?pigId=eng_001')
  .then(r => r.json())
  .then(d => console.table(d.reflections))
```

Expected console output:
```
✅ Reflection saved to KV: refl_1729342800000_xyz
✅ Pig info saved: eng_001 Fluffy
```

---

## 🗂️ Expected Redis Keys

After all tests, you should have:

```
pig:eng_001
pig:hindi_001
pig:hinglish_001
pig:api_test

reflection:refl_* (multiple)

reflections:guest:session_* (sorted set)
reflections:user:* (sorted set, if signed in)

pig_reflections:eng_001 (sorted set)
pig_reflections:hindi_001 (sorted set)
pig_reflections:hinglish_001 (sorted set)
```

---

## ✨ Success Criteria

All tests pass if:

✅ Server logs show "✅ Reflection saved to KV: refl_..."  
✅ Server logs show "✅ Pig info saved: [pigId] [name]"  
✅ No errors in server console  
✅ No errors in browser console  
✅ Original language text preserved (no unwanted translation)  
✅ Correct owner_id format (guest:... or user:...)  
✅ API endpoints return correct data  
✅ Redis keys created properly  

---

## 🚀 Ready for Production?

Before deploying to Vercel:

- [ ] All tests pass ✓
- [ ] Environment variables configured in Vercel
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL` (https://leo-indol-theta.vercel.app)
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors
- [ ] No lint errors

Then:
```bash
git add .
git commit -m "Complete reflection storage with Vercel KV"
git push origin main
```

Vercel will auto-deploy to:
**https://leo-indol-theta.vercel.app**
