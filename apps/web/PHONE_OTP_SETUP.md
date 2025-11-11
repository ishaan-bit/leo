# Phone OTP Authentication Setup Guide

## Overview

Phone OTP authentication allows users to sign in using their phone number. The flow:

1. User enters phone number on `/auth/phone`
2. System sends 6-digit OTP code via SMS (Twilio)
3. User enters code to verify
4. System creates session and redirects to `/name`

## Backend Implementation

✅ **Created:**
- `/api/auth/phone/send-otp` - Generates and sends OTP code
- `/api/auth/phone/verify-otp` - Verifies code and creates session

## Environment Variables Needed

Add these to your `.env.local` (for Vercel, add in dashboard):

```bash
# Twilio SMS Service (get from https://www.twilio.com/console)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio phone number

# Already exists - used for JWT signing
NEXTAUTH_SECRET=your-secret-key
```

## Twilio Setup (Recommended)

### 1. Create Twilio Account
- Go to https://www.twilio.com/try-twilio
- Sign up for free account
- Get **$15 trial credit** (enough for ~500 SMS)

### 2. Get Credentials
- **Account SID**: Dashboard → Account Info
- **Auth Token**: Dashboard → Account Info (click "View")
- **Phone Number**: Console → Phone Numbers → Get a Number

### 3. Verify Test Numbers (Trial Account)
During trial, you must verify recipient numbers:
- Console → Phone Numbers → Verified Caller IDs
- Add your phone number for testing

### 4. Production Upgrade
For production (sending to any number):
- Upgrade account (pay-as-you-go, ~$0.0075/SMS)
- No monthly fees, only pay for usage

## Alternative: Twilio Verify API (Easier)

Instead of manually sending SMS, use Twilio Verify (handles OTP generation, rate limiting, etc.):

```typescript
// In send-otp/route.ts
const client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

await client.verify.v2
  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
  .verifications.create({
    to: `+${normalizedPhone}`,
    channel: 'sms'
  });

// In verify-otp/route.ts
const verification = await client.verify.v2
  .services(process.env.TWILIO_VERIFY_SERVICE_SID)
  .verificationChecks.create({
    to: `+${normalizedPhone}`,
    code: code
  });

if (verification.status === 'approved') {
  // Create session
}
```

## Development Mode

Without Twilio credentials, the API works in **dev mode**:
- OTP is logged to console instead of SMS
- Check terminal output for the code
- Frontend works the same

Example console output:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 DEV MODE: OTP for 1234567890
🔐 Code: 123456
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Testing the Flow

### 1. Start dev server
```bash
npm run dev
```

### 2. Navigate to `/start`
- Click "Sign in with Phone"

### 3. Enter phone number
- Format: `+1 (555) 123-4567` or `15551234567`
- Click "Send Code"

### 4. Check console for OTP
```
[OTP] Generated for 15551234567 : 123456
```

### 5. Enter code
- Type the 6-digit code
- Click "Verify Code"

### 6. Redirected to `/name`
- Session cookie set: `leo-phone-session`
- User can now name their pig

## Security Features

✅ **OTP Storage**: Redis with 10-minute expiry
✅ **One-time use**: OTP deleted after verification
✅ **Rate limiting**: TODO - add rate limiting per phone number
✅ **Phone normalization**: Strips formatting, validates length
✅ **JWT sessions**: Secure, httpOnly cookies (30-day expiry)

## Production Checklist

- [ ] Add Twilio credentials to Vercel environment variables
- [ ] Upgrade Twilio account (remove trial restrictions)
- [ ] Add rate limiting (max 3 OTP requests per phone per hour)
- [ ] Add phone number blacklist/whitelist (optional)
- [ ] Monitor SMS costs in Twilio dashboard
- [ ] Add analytics for OTP success rate
- [ ] Consider SMS fallback provider (AWS SNS, MessageBird)

## Cost Estimation

**Twilio Pricing (US):**
- SMS: $0.0075 per message
- 1,000 OTP sends = $7.50
- 10,000 OTP sends = $75

**Expected Usage:**
- Assume 50% OTP success rate (users verify on first try)
- Assume 20% users re-request OTP
- 1,000 new users/month ≈ 1,200 SMS ≈ $9/month

## Alternative Providers

If Twilio is too expensive:

1. **AWS SNS** - $0.00645/SMS (cheaper, more setup)
2. **MessageBird** - $0.006/SMS (global coverage)
3. **Vonage (Nexmo)** - $0.0076/SMS (good APIs)
4. **Plivo** - $0.0065/SMS (developer-friendly)

## Session Management

After verification, the system:
1. Creates/updates user in Redis: `user:phone:{normalizedPhone}`
2. Generates JWT with 30-day expiry
3. Sets httpOnly cookie: `leo-phone-session`
4. Stores session in Redis: `session:{sessionId}` (30 days)

The session integrates with NextAuth.js - update `lib/auth.config.ts` to check for phone sessions.

## Next Steps

1. **Install Twilio SDK** (optional, for Verify API):
   ```bash
   npm install twilio
   ```

2. **Add rate limiting** to prevent abuse:
   ```typescript
   // Check Redis for recent OTP requests
   const recentRequests = await redis.get(`otp_rate:${normalizedPhone}`);
   if (recentRequests && parseInt(recentRequests) >= 3) {
     return NextResponse.json(
       { error: 'Too many requests. Try again in 1 hour.' },
       { status: 429 }
     );
   }
   await redis.setex(`otp_rate:${normalizedPhone}`, 3600, '1'); // 1 hour
   ```

3. **Integrate with NextAuth** - Update session provider to check phone sessions

4. **Test on staging** before production deployment

## Support

- Twilio Docs: https://www.twilio.com/docs/sms
- Twilio Console: https://console.twilio.com
- Twilio Support: support@twilio.com
