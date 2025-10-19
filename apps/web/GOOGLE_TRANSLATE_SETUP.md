# 🌐 Google Translate API Setup (FREE)

## Why This is Free

Google provides **500,000 characters per month FREE** for Cloud Translation API.

- Average reflection: ~100 characters
- **5,000 reflections/month FREE**
- No credit card required for free tier

---

## Quick Setup (5 minutes)

### Step 1: Create Google Cloud Project

1. Go to: https://console.cloud.google.com/
2. Click **"Select a project"** → **"New Project"**
3. Name it: `leo-translation`
4. Click **"Create"**

### Step 2: Enable Cloud Translation API

1. Go to: https://console.cloud.google.com/apis/library/translate.googleapis.com
2. Click **"Enable"** button
3. Wait ~30 seconds for activation

### Step 3: Create API Key

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click **"Create Credentials"** → **"API Key"**
3. Copy your new API key (looks like: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

### Step 4: Secure Your API Key (Optional but Recommended)

1. Click on your new API key to edit it
2. Under **"API restrictions"**, select **"Restrict key"**
3. Search for and select: **"Cloud Translation API"**
4. Under **"Application restrictions"**, choose:
   - **"HTTP referrers"** if deploying to web
   - Add your domain: `https://leo-indol-theta.vercel.app/*`
   - Or leave unrestricted for local development
5. Click **"Save"**

### Step 5: Add to Environment Variables

Open `apps/web/.env.local` and replace:

```bash
# BEFORE:
GOOGLE_TRANSLATE_API_KEY=your-google-translate-api-key-here

# AFTER:
GOOGLE_TRANSLATE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 6: Add to Vercel (for Production)

1. Go to: https://vercel.com/ishaan-bit/leo/settings/environment-variables
2. Add new variable:
   - **Name**: `GOOGLE_TRANSLATE_API_KEY`
   - **Value**: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`
   - **Environment**: Production + Preview + Development
3. Click **"Save"**
4. Redeploy your app

---

## Testing

### Test Locally

```bash
cd apps/web
npm run dev:https
```

Then submit a reflection with Hinglish text:
```
kal doston se milkar accha laga
```

Expected result:
```json
{
  "raw_text": "kal doston se milkar accha laga",
  "normalized_text": "It felt good to meet friends yesterday.",
  "lang_detected": "mixed"
}
```

### Test in Production

1. Deploy to Vercel
2. Open: https://leo-indol-theta.vercel.app
3. Submit Hinglish reflection
4. Check Vercel Logs for `[TRANSLATION]` entries

---

## Usage Monitoring

### Check Your Usage

1. Go to: https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas
2. View **"Translate API requests per day"**
3. Current quota: **500,000 characters/month FREE**

### Monthly Usage Estimate

| Reflections/Month | Avg Chars | Total Chars | Cost |
|-------------------|-----------|-------------|------|
| 1,000 | 100 | 100,000 | **FREE** ✅ |
| 5,000 | 100 | 500,000 | **FREE** ✅ |
| 10,000 | 100 | 1,000,000 | **$10/month** |

**You'll likely stay in the free tier!**

---

## Fallback Behavior

If the API key is not set or quota is exceeded:

1. **Language detection still works** (Hinglish words detected)
2. **Translation skipped** (returns normalized original text)
3. **No errors** (graceful fallback)
4. **Logs warning**: `No API key found, using fallback normalization`

So the app **works without the API key**, just without translation.

---

## Troubleshooting

### Error: "API key not valid"
- Check if Cloud Translation API is enabled
- Verify API key is copied correctly (no extra spaces)
- Check if API key has proper restrictions

### Error: "Quota exceeded"
- You've hit the 500K/month limit
- Wait until next month, or upgrade to paid tier
- Fallback will activate automatically

### Translation not working
- Check Vercel Logs: https://vercel.com/ishaan-bit/leo/logs
- Look for `[TRANSLATION]` entries
- Check if `lang_detected` is "mixed" or "hindi"
- Verify API key is set in Vercel environment variables

---

## Alternative: Free Offline Translation (No API)

If you don't want to use Google Translate API at all, I can implement a **dictionary-based Hinglish normalizer** that works offline:

- ❌ Won't translate full sentences
- ✅ Will normalize common Hinglish words
- ✅ 100% free, no API key needed
- ✅ Works offline

Example:
```
"kal doston se milkar accha laga"
→ "yesterday friends with meeting good felt"
```

Let me know if you want this instead!

---

## Current Status

- ✅ Translation service implemented
- ✅ Language detection with Hinglish support
- ✅ Graceful fallback if API key missing
- ✅ **API key configured and TESTED** ✨
- ✅ All code deployed and ready to use

**✅ Translation is working!**

Test results:
- ✅ "kal doston se milkar accha laga" → "It was nice to meet friends yesterday"
- ✅ "check karna hai ki Hindi se English translation Hoga ya nahin" → "Have to check whether there will be Hindi to English translation or not"
- ✅ Pure Hindi (Devanagari) → English ✓
- ✅ Pure English → Normalized ✓

**Next step**: Add API key to Vercel for production deployment!
