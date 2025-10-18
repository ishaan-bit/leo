# Identity Flow Setup Guide

## ✅ Step 1 Complete: Minimal Identity Layer

The frictionless identity flow is now implemented with:

### What's Working

1. **Continue as Guest** - Creates anonymous UUID-based session
2. **Sign in with Google** - OAuth flow via NextAuth
3. **Seamless routing** - Both flows lead to `/reflect/{pigId}`
4. **Visual feedback** - Loading states, disabled buttons during auth

### File Structure Created

```
apps/web/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts    # NextAuth config + Google OAuth
│   │   │   └── guest/route.ts            # Guest session creation
│   ├── reflect/
│   │   └── [pigId]/page.tsx              # Post-auth reflection page
├── src/
│   ├── lib/
│   │   └── guest-session.ts              # Guest session management
│   └── components/
│       └── organisms/
│           └── PigRitualBlock.tsx        # Updated with auth buttons
```

### Setup Required

1. **Generate NextAuth secret:**
   ```bash
   openssl rand -base64 32
   ```

2. **Create `.env.local`:**
   ```env
   NEXTAUTH_URL=https://localhost:3000
   NEXTAUTH_SECRET=<your-generated-secret>
   GOOGLE_CLIENT_ID=<from-google-console>
   GOOGLE_CLIENT_SECRET=<from-google-console>
   ```

3. **Setup Google OAuth:**
   - Go to https://console.cloud.google.com
   - Create a new project (or use existing)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URI: `https://localhost:3000/api/auth/callback/google`
   - Copy Client ID and Secret to `.env.local`

### User Experience Flow

```
Name pig "Rosie"
    ↓
Success animation + chime
    ↓
Two buttons appear:
  - Continue as Guest (instant)
  - Sign in with Google (OAuth redirect)
    ↓
Both lead to: /reflect/{pigId}
```

### Guest Session Details

- **Storage**: HTTP-only cookie
- **Lifetime**: 30 days
- **Format**: `guest_<uuid>`
- **Scope**: Per-browser session
- **Cleanup**: Auto-cleared after Google sign-in (Step 3)

### Google OAuth Details

- **Provider**: NextAuth Google Provider
- **Callback**: `/api/auth/callback/google`
- **Session**: JWT-based (NextAuth default)
- **User ID**: Stored in session as `session.user.id`

## Next Steps (Ready for Step 2)

Step 2 will connect the identity layer to pig data storage by:
- Adding `namedByUid` field to pig records
- Binding naming action to user UID (guest or Google)
- Preventing re-naming by different users
- Displaying stored name in reflection view

## Testing Checklist

- [ ] Click "Continue as Guest" → Should create session and redirect
- [ ] Click "Sign in with Google" → Should open Google OAuth
- [ ] Check guest cookie in DevTools → Should see `leo_guest_uid`
- [ ] Reload page as guest → Should reuse same session
- [ ] Complete Google sign-in → Should reach reflection page
- [ ] Check `/reflect/{pigId}` → Should display pig name

## Design Notes

- Kept visual mood soft and dreamy
- No heavy login page - just two buttons
- Loading states integrated seamlessly
- Button animations maintained from existing design
- Error handling graceful with inline messages
