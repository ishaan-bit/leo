# 🚀 Add Google Translate API Key to Vercel

## Quick Steps

1. **Go to Vercel Environment Variables**:
   https://vercel.com/ishaan-bit/leo/settings/environment-variables

2. **Click "Add New"** button

3. **Fill in the details**:
   - **Key**: `GOOGLE_TRANSLATE_API_KEY`
   - **Value**: `your-google-translate-api-key-here` (from Google Cloud Console)
   - **Environments**: Check all three:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

4. **Click "Save"**

5. **Redeploy**:
   - Go to: https://vercel.com/ishaan-bit/leo/deployments
   - Click the 3-dot menu on the latest deployment
   - Click "Redeploy"
   - Or just push a new commit (already done!)

---

## Verification

Once deployed, test with a Hinglish reflection:

```bash
curl -X POST https://leo-indol-theta.vercel.app/api/reflect \
  -H "Content-Type: application/json" \
  -d '{
    "pigId": "test_pig",
    "originalText": "aaj bahut accha din tha",
    "inputType": "notebook",
    "timestamp": "2025-10-19T12:00:00.000Z"
  }'
```

Expected response:
```json
{
  "ok": true,
  "rid": "refl_...",
  "data": {
    "raw_text": "aaj bahut accha din tha",
    "normalized_text": "It was a very good day today",
    "lang_detected": "mixed"
  }
}
```

Check logs:
- Go to: https://vercel.com/ishaan-bit/leo/logs
- Search for: `[TRANSLATION]`
- Should see: `translate_success` with `lang: 'mixed'`

---

## Done! 🎉

Your translation system is now:
- ✅ Working in local dev
- ✅ Code pushed to GitHub
- ⏳ Waiting for API key in Vercel (5-minute task)
- ⏳ Ready to deploy to production

Every reflection will now have proper English in `normalized_text`!
