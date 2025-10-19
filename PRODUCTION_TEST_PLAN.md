# 🧪 Reflection Storage Test Plan

**Deployment**: https://leo-indol-theta.vercel.app  
**Date**: October 19, 2025  
**Testing**: Production KV (Upstash Redis)

---

## ✅ Step 1: KV Sanity Check

**Endpoint**: `POST /api/admin/kv-sanity`

### Test Command:
```bash
curl -X POST https://leo-indol-theta.vercel.app/api/admin/kv-sanity
```

### Expected Response:
```json
{
  "ok": true,
  "message": "✅ KV connectivity verified",
  "kv_write": true,
  "kv_read": true,
  "ttl_support": true,
  "results": {
    "env_check": {
      "KV_REST_API_URL": true,
      "KV_REST_API_TOKEN": true,
      "KV_REST_API_READ_ONLY_TOKEN": true,
      "NODE_ENV": "production"
    },
    "write_test": { "ok": true, "key": "sanity:app" },
    "read_test": { "ok": true, "key": "sanity:app", "matches": true },
    "ttl_test": { "ok": true, "key": "sanity:ttl", "ttl_working": true }
  }
}
```

### Keys Created:
- `sanity:app` (no TTL)
- `sanity:ttl` (TTL 10s, auto-expires)

---

## ✅ Step 2: Session Bootstrap

**Endpoint**: `POST /api/session/bootstrap`

### Test Command:
```bash
curl -X POST https://leo-indol-theta.vercel.app/api/session/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "locale": "en-IN",
    "timezone": "Asia/Kolkata"
  }'
```

### Expected Response:
```json
{
  "ok": true,
  "sid": "sess_1729307XXX_xxxxxxx",
  "created": true,
  "session": {
    "sid": "sess_1729307XXX_xxxxxxx",
    "created_at": "2025-10-19T...",
    "last_active": "2025-10-19T...",
    "pig_id": null,
    "user_id": null,
    "device_fingerprint": "a1b2c3d4...",
    "locale": "en-IN",
    "timezone": "Asia/Kolkata"
  }
}
```

### Keys Created:
- `session:{sid}` (TTL 7 days)

### Upstash Verification:
1. Go to https://console.upstash.com/
2. Select your database: **ultimate-pika-17842**
3. Go to **Data Browser**
4. Search for: `session:sess_*`
5. Click the key → Verify TTL ≈ 604800 seconds (7 days)

---

## ✅ Step 3: Name Pig

**Current Endpoint**: `POST /api/pig/name` (existing)

### Test Command:
```bash
curl -X POST https://leo-indol-theta.vercel.app/api/pig/name \
  -H "Content-Type: application/json" \
  -d '{
    "pigId": "test_production_pig",
    "name": "Shanti"
  }'
```

### Expected Response:
```json
{
  "ok": true,
  "name": "Shanti",
  "pigId": "test_production_pig"
}
```

### Keys Created (Current):
- `pig:test_production_pig` (no TTL currently)

### 📝 TODO: Enhance pig naming
Need to update `/api/pig/name` to write `pig:session:{sid}` with TTL 7d.

---

## ✅ Step 4: Autosave Draft

**Endpoint**: `POST /api/reflection/draft`

### Test Command:
```bash
curl -X POST https://leo-indol-theta.vercel.app/api/reflection/draft \
  -H "Content-Type: application/json" \
  -d '{
    "sid": "sess_1729307XXX_xxxxxxx",
    "pigId": "test_production_pig",
    "pigName": "Shanti",
    "rawText": "आज मैं बहुत शांत महसूस कर रहा हूं",
    "inputMode": "typing",
    "typingMetrics": {
      "duration_ms": 12000,
      "wpm": 35,
      "pauses": [500, 800, 1200],
      "avg_pause_ms": 833,
      "autocorrect_events": 2,
      "backspace_count": 5
    },
    "valenceEstimate": 0.7,
    "arousalEstimate": 0.3
  }'
```

### Expected Response:
```json
{
  "ok": true,
  "message": "Draft saved",
  "key": "reflection:draft:sess_1729307XXX_xxxxxxx",
  "ttl_seconds": 10800
}
```

### Keys Created:
- `reflection:draft:{sid}` (TTL 3 hours)

### Upstash Verification:
Search for: `reflection:draft:sess_*`  
TTL: ≈ 10800 seconds (3 hours)

---

## ✅ Step 5: Submit Reflection

**Endpoint**: `POST /api/reflect`

### Test Command:
```bash
curl -X POST https://leo-indol-theta.vercel.app/api/reflect \
  -H "Content-Type: application/json" \
  -d '{
    "pigId": "test_production_pig",
    "pigName": "Shanti",
    "inputType": "notebook",
    "originalText": "आज मैं बहुत शांत महसूस कर रहा हूं। मेरा दिन अच्छा रहा।",
    "normalizedText": "aaj main bahut shaant mehsoos kar raha hoon. mera din achha raha.",
    "detectedLanguage": "hi",
    "timestamp": "2025-10-19T12:00:00.000Z",
    "affect": {
      "valence": 0.75,
      "arousal": 0.3,
      "cognitiveEffort": 0.6
    },
    "metrics": {
      "typing": {
        "duration_ms": 15000,
        "wpm": 38,
        "pauses": [500, 800, 1200, 600],
        "avg_pause_ms": 775,
        "autocorrect_events": 2,
        "backspace_count": 7
      }
    },
    "deviceInfo": {
      "device": "mobile",
      "os": "Android",
      "browser": "Chrome",
      "locale": "hi-IN",
      "timezone": "Asia/Kolkata",
      "viewport": { "width": 412, "height": 915 }
    },
    "consentResearch": true,
    "consentAudioRetention": false
  }'
```

### Expected Response:
```json
{
  "ok": true,
  "rid": "refl_1729307XXX_xxxxxxx",
  "message": "Reflection saved",
  "data": {
    "reflectionId": "refl_1729307XXX_xxxxxxx",
    "ownerId": "guest:sess_1729307XXX_xxxxxxx",
    "pigId": "test_production_pig",
    "timestamp": "2025-10-19T12:00:00.000Z",
    "ttl_days": 30
  }
}
```

### Keys Created:
- `reflection:{rid}` (TTL 30 days)
- `reflections:{ownerId}` (sorted set, no TTL)
- `pig_reflections:{pigId}` (sorted set, no TTL)
- `reflections:all` (sorted set, no TTL)

### Upstash Verification:
1. Search for: `reflection:refl_*`
2. Click key → View JSON → Verify fields:
   - `rid`, `sid`, `timestamp`
   - `raw_text` (Hindi text preserved)
   - `normalized_text` (transliteration)
   - `lang_detected`: "hi"
   - `input_mode`: "typing"
   - `typing_summary` (all metrics)
   - `valence`, `arousal`, `confidence`
   - `signals` (autocorrect, hesitation, etc.)
   - `consent_flags` (research: true, audio_retention: false)
   - `client_context` (device, os, browser)
   - `version` (nlp, valence, ui)
3. Check TTL: ≈ 2592000 seconds (30 days)

---

## ✅ Step 6: View in Admin Panel

**URL**: https://leo-indol-theta.vercel.app/admin/kv-viewer

### Expected Display:
- **Stats**: 
  - Total Reflections: 1
  - Total Pigs: 1
  - Total Keys: 8+
- **All Keys**:
  ```
  sanity:app
  session:sess_1729307XXX_xxxxxxx
  pig:test_production_pig
  reflection:draft:sess_1729307XXX_xxxxxxx
  reflection:refl_1729307XXX_xxxxxxx
  reflections:guest:sess_1729307XXX_xxxxxxx
  pig_reflections:test_production_pig
  reflections:all
  rl:sid:sess_1729307XXX_xxxxxxx (may have expired)
  ```
- **Reflections Section**:
  - Shows full JSON with all fields
  - Expandable view

---

## ✅ Step 7: Check Vercel Runtime Logs

1. Go to https://vercel.com/dashboard
2. Select project: **Leo**
3. Go to **Logs** tab
4. Filter: **Functions**
5. Search for: `KV_OK`

### Expected Log Lines:
```json
{"timestamp":"2025-10-19T...","service":"kv","op":"SET","key":"sanity:app","phase":"ok"}
{"timestamp":"2025-10-19T...","service":"kv","op":"SETEX","key":"session:sess_...","phase":"ok","sid":"sess_..."}
{"timestamp":"2025-10-19T...","service":"kv","op":"SETEX","key":"reflection:draft:sess_...","phase":"ok","sid":"sess_..."}
{"timestamp":"2025-10-19T...","service":"kv","op":"SETEX","key":"reflection:refl_...","phase":"ok","sid":"sess_...","rid":"refl_..."}
{"timestamp":"2025-10-19T...","service":"kv","op":"ZADD","key":"reflections:guest:sess_...","phase":"ok","sid":"sess_...","rid":"refl_..."}
```

---

## ✅ Step 8: Rate Limit Test

**Goal**: Verify 429 response after 10 requests/minute

### Test Command (run 12 times quickly):
```bash
for i in {1..12}; do 
  curl -X POST https://leo-indol-theta.vercel.app/api/reflect \
    -H "Content-Type: application/json" \
    -d '{"pigId":"test","originalText":"test","inputType":"notebook","timestamp":"2025-10-19T12:00:00.000Z"}' \
  && echo " (request $i)"
done
```

### Expected:
- Requests 1-10: `{"ok": true, "rid": "refl_..."}`
- Requests 11-12: `{"error": "Rate limit exceeded", "code": "RATE_LIMIT_EXCEEDED"}`

### Key Created:
- `rl:sid:{sid}` (TTL 60s, auto-increments)

---

## 📊 Final Verification Checklist

- [ ] Sanity check passes (write/read/TTL working)
- [ ] Session created with TTL 7d
- [ ] Pig named successfully
- [ ] Draft autosaved with TTL 3h
- [ ] Reflection saved with TTL 30d
- [ ] Admin viewer shows all keys
- [ ] Vercel logs show `KV_OK` entries
- [ ] Rate limit triggers at 10/min
- [ ] All keys visible in Upstash Data Browser with correct TTLs

---

## 🔑 Keys Summary

### Expected in Upstash (after full flow):

| Key Pattern | Example | TTL | Purpose |
|-------------|---------|-----|---------|
| `sanity:app` | `sanity:app` | None | Connectivity test |
| `sanity:ttl` | `sanity:ttl` | 10s | TTL test (auto-expires) |
| `session:{sid}` | `session:sess_1729...` | 7d | User session |
| `pig:{pigId}` | `pig:test_production_pig` | None* | Pig metadata |
| `reflection:draft:{sid}` | `reflection:draft:sess_...` | 3h | Autosaved draft |
| `reflection:{rid}` | `reflection:refl_1729...` | 30d | Final reflection |
| `reflections:{ownerId}` | `reflections:guest:sess_...` | None | Sorted set (owner index) |
| `pig_reflections:{pigId}` | `pig_reflections:test_...` | None | Sorted set (pig index) |
| `reflections:all` | `reflections:all` | None | Sorted set (global index) |
| `rl:sid:{sid}` | `rl:sid:sess_1729...` | 60s | Rate limit counter |

*Note: `pig:*` keys don't currently have TTL. TODO: Add `pig:session:{sid}` pattern.

---

## 🐛 Debug Playbook

### If 500 error:
1. Check Vercel Logs for `KV_ERROR` entries
2. Verify env vars are set in Production: `KV_REST_API_URL`, `KV_REST_API_TOKEN`
3. Check error stack trace for specific failure

### If write silently fails:
1. Go to Upstash console
2. Check if write token is correct (not read-only token)
3. Verify database is in correct region/environment

### If nothing in logs:
1. Check route is executing (should see request in Vercel Logs)
2. Verify API route path matches expected pattern
3. Check build output for route registration

### If keys have different prefixes:
1. Check if `prod:` or other prefix is used
2. Normalize prefix configuration
3. Search Upstash with prefix pattern

---

## ✅ Success Criteria Met

- [x] Environment variables validated (sanity check)
- [x] KV client uses write token (not RO)
- [x] Server-only writes (API routes, no client)
- [x] Input validation with 400 errors
- [x] Structured logging (KV_START, KV_OK, KV_ERROR)
- [x] TTL support (7d, 3h, 30d)
- [x] Rate limiting (10/min, 429 response)
- [x] Privacy: hashed device fingerprint, consent flags
- [x] Complete Reflection schema with all fields
- [x] Error codes: 400 (validation), 429 (rate limit), 503 (KV fail)
- [x] Build passes ✓
- [x] Deployed to production ✓

**Next**: Run manual tests in production and verify keys in Upstash!
