# QR Entry System - Quick Start Guide

## 🎯 What This Does

Provides a single QR code entry point that:
- ✅ Works for first-time users (name your pig)
- ✅ Works for returning users (skip naming, load your pig)
- ✅ Works across devices when signed in
- ✅ Works on same device for guests
- ✅ Never shows wrong pig to wrong person

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd apps/web
npm install
```

### 2. Environment Setup

Copy `.env.qr-entry.example` → `.env.local` and fill in:

```bash
# Required
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# For Email Magic Links (bind flow)
EMAIL_SERVER_HOST=smtp.gmail.com
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER=your-email@gmail.com
EMAIL_SERVER_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourdomain.com

# For Google Sign-In (bind flow)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Feature Flags
NEXT_PUBLIC_BIND_ENABLED=true
LEO_QR_ENTRY_ENABLED=true
```

### 3. Run Dev Server

```bash
npm run dev
```

### 4. Test the Flow

#### Fresh Guest (First Time)
```
1. Open: http://localhost:3000/enter
2. Should redirect to: /name-me
3. Enter name "TestPig" → Submit
4. Should redirect to: /city
5. Re-visit: http://localhost:3000/enter
6. Should skip /name-me and go to /city with "TestPig"
```

#### Guest Bind (Cross-Device)
```
1. As guest, name pig "GuestPig"
2. Click "Keep this pig on all devices" → Sign in with email/Google
3. Check email for magic link → Click link
4. On different device/browser, sign in with same account
5. Visit: http://localhost:3000/enter
6. Should load "GuestPig" (migrated from guest session!)
```

#### Authenticated User
```
1. Sign in with Google first
2. Visit: http://localhost:3000/enter
3. Should land on /name-me (first touch)
4. Name pig → redirect to /city
5. On any device, sign in with same Google account
6. Visit: http://localhost:3000/enter
7. Should skip /name-me and load your pig (cross-device!)
```

## 📐 Architecture

```
┌─────────────────────────────────────────┐
│  QR Code: /enter?t=abc123               │
└──────────────┬──────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Middleware: Mint __Host-leo_sid         │
│  (Secure session cookie)                 │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  /enter: resolveIdentity()               │
│  - Read sid from cookie                  │
│  - Read authId from NextAuth             │
│  - effectiveId = authId ? user : sid     │
│  - Read pig from Redis                   │
└──────────────┬───────────────────────────┘
               │
         ┌─────┴──────┐
         │            │
    Has Pig?     No Pig?
         │            │
         ▼            ▼
    ┌────────┐  ┌──────────┐
    │ /city  │  │ /name-me │
    └────────┘  └────┬─────┘
                     │
                     ▼
              ┌─────────────────┐
              │ Submit pig name │
              │ (server action) │
              └────────┬────────┘
                       │
                ┌──────┴───────┐
                │              │
            Guest?        Auth?
                │              │
                ▼              ▼
         ┌─────────┐    ┌─────────┐
         │ Bind CTA│    │ Redirect│
         │ (sign in│    │ to /city│
         │  email) │    └─────────┘
         └────┬────┘
              │
              ▼
        ┌──────────────┐
        │ /bind/callback│
        │ Promote guest │
        │ pig → user pig│
        └──────┬────────┘
               │
               ▼
           ┌────────┐
           │ /city  │
           └────────┘
```

## 🗂️ New Routes

| Route | Purpose | Auth Required |
|-------|---------|--------------|
| `/enter?t=<token>` | Universal QR landing | No |
| `/name-me` | First-touch pig naming | No |
| `/bind` | Sign-in for cross-device | No |
| `/bind/callback` | Post-auth handler | Yes (after sign-in) |
| `/api/effective` | Get resolved identity | No |

## 🔑 Redis Data Model

```typescript
// Guest pig (same device only)
sid:<sid>:profile → {
  pig_name: "GuestPig",
  created_at: "2025-11-10T12:00:00Z"
}

// Auth pig (cross-device)
user:<authId>:profile → {
  pig_name: "MyPig",
  created_at: "2025-11-10T12:00:00Z"
}

// QR metadata (optional)
qr:<token> → {
  campaign: "launch-week",
  requested_mode: "auto",  // or "guest" or "auth"
  redirect: "/city"
}
```

## 🍪 Cookies

| Name | Purpose | Attributes |
|------|---------|------------|
| `__Host-leo_sid` | Stable session ID | HttpOnly, Secure, SameSite=Lax, 1yr |
| `next-auth.session-token` | NextAuth auth session | HttpOnly, Secure, SameSite=Lax |
| `next-auth.callback-url` | Post-auth redirect | SameSite=Lax |

## 🧪 Testing Checklist

- [ ] Fresh guest: Name pig → re-scan QR → skip naming ✅
- [ ] Guest bind: Name as guest → sign in → different device → pig persists ✅
- [ ] Auth first: Sign in → no pig → name pig → re-scan → skip naming ✅
- [ ] Auth with pig: Sign in with existing pig → skip naming ✅
- [ ] Cookie clear: Clear cookies → re-scan → lands on /name-me ✅
- [ ] Multi-tab: Open QR in 3 tabs → all resolve same identity ✅
- [ ] Requested mode='auth': Unsigned user → forced to sign in ✅

## 🐛 Troubleshooting

**Q: Why does `/enter` always redirect to `/name-me`?**  
A: Check if `__Host-leo_sid` cookie is being set. In dev, `Secure=true` requires HTTPS. Use `http://localhost:3000` or update middleware to use non-`__Host-` cookie in dev.

**Q: Guest pig not promoted after sign-in?**  
A: Check `/bind/callback` logs. Ensure `promoteGuestPig()` is called. Verify sid cookie exists when binding.

**Q: How do I create a QR token?**  
A: Set Redis key: `qr:abc123` → `{ requested_mode: "auto", redirect: "/city" }`. Then create QR for `https://your-domain.com/enter?t=abc123`.

**Q: Can I use this with existing auth system?**  
A: Yes! The resolver is separate from NextAuth. You can integrate other auth providers by updating `resolveIdentity()` to read from your session system.

## 📊 Observability

All identity operations log to console with structured metadata:

```typescript
[Identity] Resolved: { sid: '...', authId: '...', hasPig: true }
[Entry] QR scan: { token: '...', effectiveScope: 'user' }
[Name Me] ✅ Pig named: { scope: 'sid', pigLength: 7 }
[Bind Callback] ✅ Guest pig promoted to user
```

## 🚀 Deployment

1. Set env vars in production (Vercel, Railway, etc.)
2. Ensure `NEXTAUTH_URL` is your production domain
3. Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`
4. Configure Email provider (SMTP or SendGrid)
5. Test QR flow in staging first
6. Monitor Redis keys: `sid:*:profile`, `user:*:profile`

## 📝 Next Steps

- [ ] Update existing scenes to use `/api/effective` instead of `useSession()`
- [ ] Migrate existing pig data to new profile keys
- [ ] Add QR analytics (scan tracking, conversion rates)
- [ ] Implement pig rename functionality
- [ ] Add phone OTP bind option
- [ ] Create admin dashboard for QR management

## 🔗 Related Docs

- [Full Implementation Changelog](./QR_ENTRY_IMPLEMENTATION.md)
- [Identity Resolver Source](./apps/web/src/lib/identity-resolver.ts)
- [Middleware Source](./apps/web/src/middleware.ts)

---

**Status:** ✅ Core implementation complete  
**Last Updated:** November 10, 2025
