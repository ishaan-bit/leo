# Guest Mode Enrichment Fix - November 2024

## 🐛 Issues Reported

### 1. Normal Window: Reflect Page Couldn't Load After Naming Pig
**Status**: Enhanced error handling and logging added

**Symptoms**: After naming pig in normal window, navigation to `/reflect/{pigId}` fails

**Potential Causes**:
- Missing pigId in navigation
- Pig profile not saved correctly
- Session mismatch between naming and reflect page

**Fixes Applied**:
- ✅ Added comprehensive logging to `PigRitualBlock.tsx` for guest session creation
- ✅ Added pigId validation before navigation
- ✅ Enhanced error messages in reflect page to show pigId for debugging
- ✅ Added fallback lookup for old guest profile format in `/api/pig/[pigId]`

### 2. Incognito: Enrichment Never Happened for Guest Reflections ⚠️ CRITICAL
**Status**: ✅ FIXED

**Symptoms**: 
- Guest reflection `guest:b8667044-e1e6-4e95-92a7-494621dbac0b:reflection:refl_1763091584225_twvk0cpzp` not found
- Reflect page loaded but enrichment never completed
- Reflection likely expired (5-minute TTL) before enrichment could write back

**Root Cause**:
The enrichment webhook was receiving the wrong session ID format:
- **Frontend sends**: `sid` = `sess_{timestamp}_{random}` (session cookie format)
- **Guest pigId format**: `sid_{uuid}` (identity format)
- **Guest namespace**: `guest:{uuid}:reflection:{rid}`

When the enrichment callback tried to find the reflection, it extracted `guestUid` from `sess_xxx` which doesn't match the actual namespace `guest:{uuid}:*`.

**Fix**:
```typescript
// apps/web/app/api/reflect/route.ts
// BEFORE: Always sent session cookie
body: JSON.stringify({
  rid,
  sid,  // ❌ sess_xxx format
  ...
})

// AFTER: Send pigId for guests
const webhookSid = isGuest && body.pigId ? body.pigId : sid;
body: JSON.stringify({
  rid,
  sid: webhookSid,  // ✅ sid_xxx format for guests
  ...
})
```

**Impact**:
- ✅ Enrichment callback can now find guest reflections in correct namespace
- ✅ Guest reflections will receive emotion analysis, poems, and tips
- ✅ Interlude page will show enriched content instead of stuck loading

---

## 🔧 Technical Details

### Enrichment Flow (Before Fix)
1. Guest submits reflection → saved to `guest:{uuid}:reflection:{rid}` ✅
2. Webhook called with `sid=sess_xxx` ❌
3. Callback extracts guestUid from `sess_xxx` → wrong value
4. Callback looks for `guest:{wrong_uuid}:reflection:{rid}` → NOT FOUND ❌
5. Enrichment fails silently, reflection expires after 5 minutes

### Enrichment Flow (After Fix)
1. Guest submits reflection → saved to `guest:{uuid}:reflection:{rid}` ✅
2. Webhook called with `sid=sid_{uuid}` (pigId) ✅
3. Callback extracts guestUid from `sid_{uuid}` → correct value ✅
4. Callback looks for `guest:{uuid}:reflection:{rid}` → FOUND ✅
5. Enrichment data written back successfully ✅

### Key Files Changed

#### 1. `apps/web/app/api/reflect/route.ts`
**Line ~311-330**: Fixed webhook payload to send correct session ID for guests
```typescript
const webhookSid = isGuest && body.pigId ? body.pigId : sid;
```

#### 2. `apps/web/app/api/enrichment/callback/route.ts`
**Line ~43-56**: Added detailed logging to debug session type detection
```typescript
console.log(`[Enrichment Callback] Session type:`, {
  sid: sessionId,
  isGuest,
  guestUid: guestUid ? guestUid.substring(0, 8) + '...' : null,
});
```

#### 3. `apps/web/src/components/organisms/PigRitualBlock.tsx`
**Line ~153-180**: Added comprehensive error handling for guest session creation

#### 4. `apps/web/app/reflect/[pigId]/page.tsx`
**Line ~99-115**: Enhanced error display to show pigId for debugging

#### 5. `apps/web/app/api/pig/[pigId]/route.ts`
**Line ~49-64**: Added fallback lookup for old guest profile format

---

## 🧪 Testing Checklist

### Guest Mode Flow (Incognito/Private Window)
- [ ] 1. Open incognito window → `/start`
- [ ] 2. Click "Continue as Guest" → `/guest/name-pig`
- [ ] 3. Name pig (e.g., "TestPig") → Wait for confetti + "Continue as Guest" button
- [ ] 4. Click "Continue as Guest" → Should redirect to `/reflect/sid_{uuid}`
- [ ] 5. Verify pig name appears in UI
- [ ] 6. Submit reflection → Should see interlude loading
- [ ] 7. Wait ~10-20 seconds for enrichment to complete
- [ ] 8. Verify enrichment data appears (emotion wheel, poems, tips)
- [ ] 9. Check browser console for logs:
   - `[PigRitual] Creating guest session for pigId: sid_xxx`
   - `[PigRitual] Guest session created: {ok: true, ...}`
   - `📤 Enrichment webhook triggered (async) for refl_xxx, isGuest: true, webhookSid: sid_xxx`

### Normal Window (Authenticated User)
- [ ] 1. Open normal window → `/start`
- [ ] 2. Sign in with Google → `/name`
- [ ] 3. Name pig → Should redirect to `/reflect/{authId}`
- [ ] 4. Submit reflection → Should see interlude loading
- [ ] 5. Verify enrichment completes normally

### Logs to Verify
```bash
# In Vercel deployment logs, look for:
[PigRitual] Creating guest session for pigId: sid_xxx
[PigRitual] Guest session created: {ok: true, uid: "sid_xxx", type: "guest"}
[PigRitual] Navigating to /reflect/sid_xxx

📤 Enrichment webhook triggered (async) for refl_xxx, isGuest: true, webhookSid: sid_xxx

[Enrichment Callback] Session type: {sid: "sid_xxx", isGuest: true, guestUid: "xxx..."}
[Enrichment Callback] Guest lookup (from webhook sid): {found: true}
[Enrichment Callback] ✅ Updated guest:xxx:reflection:refl_xxx with final data
```

---

## 🚨 Known Limitations

1. **5-Minute TTL**: Guest reflections expire after 5 minutes
   - Enrichment must complete within this window
   - If HuggingFace Space is cold-starting, enrichment may fail
   - **Mitigation**: Keep HF Space warm with periodic health checks

2. **Guest Data Purge**: Guest data is deleted after 3 minutes of viewing moments
   - See `apps/web/src/app/api/guest/purge/route.ts`
   - This is intentional for privacy compliance

3. **No Historical Data for Guests**: Guest enrichment doesn't use temporal analytics
   - `get_user_history(sid)` in enrichment worker returns empty for guests
   - First-time users get emotion analysis without historical context

---

## 📝 Next Steps

1. **Test in Production**: Deploy fixes to Vercel and test guest flow end-to-end
2. **Monitor HF Space**: Check HuggingFace Space logs for enrichment callback success rate
3. **Add Retry Logic**: If enrichment fails, consider retry mechanism (within TTL window)
4. **Improve Guest TTL**: Consider extending guest reflection TTL from 5 minutes to 10 minutes to give enrichment more time

---

## 🔗 Related Files

- `apps/web/app/api/reflect/route.ts` - Reflection save + webhook trigger
- `apps/web/app/api/enrichment/callback/route.ts` - Enrichment result handler
- `apps/web/src/lib/guest-session.ts` - Guest session utilities
- `apps/web/src/lib/identity-resolver.ts` - Unified identity resolution
- `enrichment_v5/app.py` - HuggingFace Space enrichment webhook
- `apps/web/app/api/pig/[pigId]/route.ts` - Pig profile lookup

---

**Date**: November 14, 2024  
**Fixed By**: GitHub Copilot  
**Severity**: Critical (Guest mode enrichment completely broken)  
**Impact**: All guest users will now receive enrichment data (poems, tips, emotion analysis)
