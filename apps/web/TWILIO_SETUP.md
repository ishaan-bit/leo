# Twilio Phone OTP Setup

## Development Mode (No Setup Required)

**The app works WITHOUT Twilio** - in development mode, the OTP code is:
1. Logged to the server console (check Vercel logs)
2. Returned in the API response and displayed on screen

**You don't need Twilio to test phone authentication locally or in production.**

---

## Production SMS Setup (Optional)

If you want to send real SMS messages to users, you can set up Twilio:

### 1. Create Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account
3. You get **$15 free credit** (~500 SMS messages)

### 2. Get Your Credentials

After signing up:

1. Go to [Twilio Console](https://console.twilio.com/)
2. Copy these values:
   - **Account SID** - looks like `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Auth Token** - click "View" to reveal it
   - **Phone Number** - Get a phone number that supports SMS

### 3. Get a Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Buy a Number**
2. Choose a number that supports **SMS**
3. Complete the purchase (uses your free credit)

### 4. Add to Vercel Environment Variables

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add these three variables:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

3. Click **Save**
4. **Redeploy** your app to pick up the new environment variables

### 5. Verify It Works

1. Go to `/auth/phone` on your deployed app
2. Enter your phone number
3. You should receive an SMS with the 6-digit code
4. Enter the code to complete sign-in

---

## Cost Breakdown

- **Free Trial**: $15 credit = ~500 SMS
- **Production**: ~$0.0075 per SMS = $7.50 per 1,000 messages
- **Monthly Cost**: For 1,000 users signing in once/month = ~$7.50

---

## Troubleshooting

### "Dev Mode" shows on screen
✅ This is **correct** - it means Twilio is not configured. Use the displayed code to sign in.

### SMS not sending (with Twilio configured)
1. Check Vercel logs for errors
2. Verify all 3 env vars are set correctly
3. Verify your Twilio phone number supports SMS
4. Check Twilio console for delivery status

### "Invalid phone number" error
- Phone number must be 10-15 digits
- Don't include country code `+` in the input (it's added automatically)
- Example: `1234567890` (for US numbers)

---

## Alternative SMS Providers

If you prefer not to use Twilio, you can easily swap to:

- **AWS SNS** (~$0.00645/SMS, even cheaper)
- **MessageBird**
- **Vonage (Nexmo)**
- **Plivo**

Just update the SMS sending logic in `/apps/web/app/api/auth/phone/send-otp/route.ts`
