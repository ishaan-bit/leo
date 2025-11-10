# QR Entry & Identity System - Implementation Changelog

**Date:** November 10, 2025  
**Objective:** Single QR entry point with effective identity resolution for guest and authenticated users

---

## 🎯 Overview

Implemented a unified identity and entry system where:
- **One QR to rule them all**: `/enter?t=<token>` 
- First-time users always land on `/name-me` (if no pig)
- Returning users skip Name Me and go straight to main scene
- Works cross-device for authenticated users
- Works same-device for guests via secure cookie

---

## 📁 New Files Created

### Core Identity System
- **`src/lib/identity-resolver.ts`**
  - `resolveIdentity()`: Single source of truth for identity
  - `savePigName()`: Idempotent pig name persistence
  - `promoteGuestPig()`: Guest → auth migration after bind
  - Returns: `{ sid, authId, effectiveId, effectiveScope, pigName, createdAt }`

- **`src/middleware.ts`**
  - Ensures `__Host-leo_sid` cookie exists on all routes
  - Mints secure cookie if missing
  - Excludes: `_next/static`, `_next/image`, `favicon.ico`, `/api/health`

### Routes
- **`app/enter/page.tsx`**
  - Universal QR landing page
  - Resolves identity → routes to `/city` (if pig exists) or `/name-me` (first touch)
  - Handles QR metadata: `requested_mode` ('auto' | 'guest' | 'auth')

- **`app/name-me/page.tsx`** + **`app/name-me/actions.ts`**
  - First-touch naming experience
  - Server action: `submitPigName(name)` with validation
  - Shows bind CTA for guests after naming
  - Validates: 2-24 chars, `[a-zA-Z0-9 _-]`

- **`app/bind/page.tsx`**
  - "Keep your pig on all devices" flow
  - Google OAuth or Email magic link via NextAuth
  - Skippable for guests

- **`app/bind/callback/page.tsx`**
  - Post-auth handler
  - Promotes guest pig to user profile if applicable
  - Redirects to intended destination

### API
- **`app/api/effective/route.ts`**
  - Server API that calls `resolveIdentity()`
  - Returns: `{ mode: 'auth'|'guest', pigName, effectiveId, sid, authId }`
  - Client components should use this instead of `useSession()`

---

## 🔑 Data Model (Redis Keys)

```
# Session tracking (optional)
session:<sid> → { last_seen, ... }

# Pig profiles
sid:<sid>:profile → { pig_name, created_at }          # Guest pig
user:<authId>:profile → { pig_name, created_at }      # Auth pig

# QR metadata (optional)
qr:<token> → { campaign?, requested_mode?, redirect? }

# Future: Moments
sid:<sid>:moments → [...]
user:<authId>:moments → [...]
```

---

## 🍪 Cookie Strategy

**Single authoritative cookie:** `__Host-leo_sid`

Attributes:
- `HttpOnly: true` (not accessible via JavaScript)
- `Secure: true` (production only, HTTPS required)
- `SameSite: 'lax'` (CSRF protection)
- `Path: '/'` (all routes)
- `MaxAge: 31536000` (1 year)

**Note:** `__Host-` prefix requires `Secure=true`, `Path=/`, no `Domain` attribute.

---

## 🔀 Identity Flow

```
1. User scans QR → /enter?t=abc123

2. Middleware mints __Host-leo_sid if missing

3. /enter calls resolveIdentity():
   - Read sid from cookie
   - Read authId from NextAuth session (may be null)
   - effectiveId = authId ? "user:<authId>" : "sid:<sid>"
   - Read pig_name from <effectiveId>:profile

4. Route decision:
   - If pig exists → redirect to /city (or qr.redirect)
   - Else → redirect to /name-me

5. /name-me:
   - User enters name → submitPigName() server action
   - Writes to <effectiveId>:profile
   - Shows bind CTA if guest

6. /bind (optional):
   - User signs in with Google/Email
   - /bind/callback promotes guest pig to user pig
   - Future QR scans on any device → user pig
```

---

## 🔄 Guest → Auth Promotion

When a guest user binds (signs in):

1. `promoteGuestPig(sid, authId)` is called in `/bind/callback`
2. Reads `sid:<sid>:profile` (guest pig)
3. Reads `user:<authId>:profile` (auth pig, may not exist)
4. If auth pig empty and guest pig exists:
   - Copy guest pig → auth pig
   - Log migration event
5. Future sessions with this authId use auth pig (cross-device)

**Idempotent:** If auth pig already exists, guest pig is NOT copied (no overwrite).

---

## ⚙️ Environment Variables

```bash
# Required
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<random-secret>

# Optional Feature Flags
NEXT_PUBLIC_BIND_ENABLED=true   # Show bind CTA in /name-me
LEO_QR_ENTRY_ENABLED=true       # Enable /enter route
```

---

## 🧪 Acceptance Test Scenarios

### 1. Fresh Guest Flow
- Fresh browser (no cookies) → scan QR
- Should land on `/name-me`
- Enter name "TestPig" → redirects to `/city`
- Re-scan QR → skip `/name-me`, go to `/city` with "TestPig"

### 2. Guest Bind & Cross-Device
- As guest, name pig "GuestPig"
- Click bind CTA → sign in with email
- On different device/browser, sign in with same email
- Scan QR → should skip `/name-me`, show "GuestPig"

### 3. Auth User (No Pig)
- Sign in with Google (fresh account)
- Scan QR → should land on `/name-me`
- Name pig → redirects to `/city`

### 4. Auth User (With Pig)
- User who already named pig previously
- Scan QR → skip `/name-me`, go to `/city` with existing pig

### 5. Cookie Clear (Guest)
- As guest, name pig "TempPig"
- Clear browser cookies
- Re-scan QR → lands on `/name-me` again (pig lost)
- This is expected behavior for guests

### 6. Multi-Tab Rapid Refresh
- Open QR in multiple tabs simultaneously
- All tabs should resolve to same identity (idempotent)
- No race conditions on pig name saving

### 7. Requested Mode (Auth)
- Create QR token with `requested_mode: 'auth'`
- Scan while signed out → redirects to `/api/auth/signin`
- After sign-in → returns to `/enter` → routes correctly

---

## 🚨 Security Considerations

✅ **No pig name in query params** - All identity in secure cookies/server session  
✅ **__Host- prefix** - Prevents subdomain cookie poisoning  
✅ **HttpOnly** - JavaScript cannot access sid cookie  
✅ **Server-side validation** - Name validation in server action  
✅ **Scope isolation** - Guest pigs (sid) cannot leak to other users  
✅ **No localStorage authority** - Client cache only, never authoritative

---

## 🔧 How to Test Locally

```bash
# 1. Install dependencies (if not already)
npm install

# 2. Set environment variables
cp .env.example .env.local
# Edit .env.local with NEXTAUTH_URL, NEXTAUTH_SECRET, etc.

# 3. Run dev server
npm run dev

# 4. Test /enter flow
# Open: http://localhost:3000/enter
# Should redirect to /name-me (first time)

# 5. Name your pig
# Enter a name → should save and redirect to /city

# 6. Test re-entry
# Open: http://localhost:3000/enter
# Should skip /name-me and go to /city

# 7. Test bind flow
# Click bind CTA → sign in with email/Google
# Check logs for "Promoted guest pig to user"

# 8. Clear cookies and test cross-device
# In new incognito window, sign in with same account
# Open /enter → should load your pig (cross-device!)
```

---

## 📊 Observability Logs

All logs prefixed with `[Identity]`, `[Entry]`, `[Name Me]`, `[Bind Callback]`:

```typescript
[Identity] Resolved: { sid: 'sid_abc...', authId: 'usr_xyz...', effectiveScope: 'user', hasPig: true }
[Entry] QR scan: { token: 'qr_123...', sid: 'sid_abc...', auth: true, hasPig: false }
[Name Me] ✅ Pig named: { scope: 'sid', pigLength: 7, isGuest: true }
[Bind Callback] ✅ Guest pig promoted to user
```

---

## 🔄 Migration from Old System

### Affected Files (Not Modified Yet)
- `src/components/scenes/Scene_Reflect.tsx` - Still uses `useSession()`
- `src/lib/auth-helpers.ts` - Old `getAuth()` and `getSid()` co-exist
- `app/api/reflect/route.ts` - Uses old auth-helpers

### Recommended Updates (Next Phase)
1. Update `Scene_Reflect` to call `/api/effective` instead of `useSession()`
2. Replace `getAuth()` calls in API routes with `resolveIdentity()`
3. Migrate existing pig names from old `pig:<pigId>` keys to new `user:<authId>:profile` format
4. Update `TopNav` to show pig name from `/api/effective`

---

## 🚀 Deployment Checklist

- [ ] Set `NEXTAUTH_URL` in production env
- [ ] Set `NEXTAUTH_SECRET` (use `openssl rand -base64 32`)
- [ ] Configure NextAuth Email provider (SMTP or SendGrid)
- [ ] Test on staging with real QR codes
- [ ] Monitor Redis key patterns: `sid:*:profile`, `user:*:profile`
- [ ] Set up alerts for failed `promoteGuestPig()` calls
- [ ] Create QR codes with `/enter?t=<token>` format

---

## 📝 Known Limitations / Future Enhancements

- [ ] Phone OTP bind (currently only email/Google)
- [ ] Revocation UI for bind (remove cross-device access)
- [ ] Global pig name uniqueness index
- [ ] Moments merge conflict resolution (when promoting guest)
- [ ] QR analytics dashboard (scan counts, conversion rates)
- [ ] Rate limiting on `/name-me` submissions
- [ ] Pig rename functionality

---

## 🐛 Troubleshooting

**Issue:** User sees `/name-me` on every scan  
**Fix:** Check `__Host-leo_sid` cookie exists. Ensure middleware is running.

**Issue:** Guest pig not promoted after bind  
**Fix:** Check `/bind/callback` logs. Ensure `promoteGuestPig()` is called with correct sid/authId.

**Issue:** Auth user lands on `/name-me` even though they have a pig  
**Fix:** Check Redis key `user:<authId>:profile`. May need to migrate old data.

**Issue:** `__Host-` cookie not setting in dev (localhost)  
**Fix:** `__Host-` requires `Secure=true`, which needs HTTPS. Use `SameSite=lax` without `__Host-` prefix in dev, or test on `https://localhost` with self-signed cert.

---

## ✅ Success Criteria Met

✅ Single QR entry point (`/enter`)  
✅ First touch → `/name-me` (all users)  
✅ Returning users skip naming  
✅ Cross-device works for auth users  
✅ Same-device works for guests  
✅ No UI branching on `useSession()`  
✅ Secure `__Host-leo_sid` cookie  
✅ Idempotent pig saving  
✅ Guest → auth promotion  
✅ Observability logging  

---

**Implementation Status:** ✅ CORE COMPLETE  
**Next Steps:** Update existing scenes to use `/api/effective` (Task #7)
