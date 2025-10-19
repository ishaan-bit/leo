# Hindi/Hinglish Translation Setup

**Status**: ✅ Implemented  
**Date**: October 19, 2025

---

## Overview

The reflection system now automatically translates Hindi and Hinglish (mixed Hindi-English) text to fluent English before saving to the database.

### What Happens

1. **User submits reflection** → Original text saved as `raw_text`
2. **Language detection** → Identifies: `english`, `hindi`, or `mixed`
3. **Translation** → Converts to natural English (preserves tone & emotion)
4. **Save** → `normalized_text` always contains English

---

## Example Transformations

### Pure Hindi
```json
{
  "raw_text": "मुझे आज बहुत अच्छा लग रहा है",
  "normalized_text": "I am feeling very good today",
  "lang_detected": "hindi"
}
```

### Hinglish (Mixed)
```json
{
  "raw_text": "kal doston se milkar accha laga",
  "normalized_text": "It felt good meeting friends yesterday",
  "lang_detected": "mixed"
}
```

### Pure English
```json
{
  "raw_text": "i feel happy today",
  "normalized_text": "I feel happy today.",
  "lang_detected": "english"
}
```

---

## Translation Service: Google Translate API

**Why Google Translate?**
- ✅ Free tier: 500,000 characters/month
- ✅ Excellent Hindi → English quality
- ✅ Handles Hinglish (mixed language) naturally
- ✅ Preserves tone and emotion

**Cost Estimate**:
- Average reflection: ~100 characters
- Free tier supports: ~5,000 reflections/month
- If you exceed: ~$20 per million characters

---

## Setup Instructions

### Step 1: Enable Google Translate API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create new one)
3. Enable **Cloud Translation API**:
   - Visit: https://console.cloud.google.com/apis/library/translate.googleapis.com
   - Click **Enable**

### Step 2: Create API Key

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ Create Credentials** → **API Key**
3. Copy your API key

### Step 3: Add to Environment Variables

Edit `apps/web/.env.local`:

```bash
# Google Translate API (Free tier: 500,000 chars/month)
GOOGLE_TRANSLATE_API_KEY=AIzaSy...your-api-key-here
```

### Step 4: (Optional) Restrict API Key

For security, restrict your API key:
1. Go to API Key settings in Google Cloud Console
2. **Application restrictions**: Set to "HTTP referrers" or "IP addresses"
3. **API restrictions**: Restrict to "Cloud Translation API" only

---

## How It Works

### File: `src/lib/translation.ts`

```typescript
// 1. Detect language
const detection = detectLanguage(rawText);
// → { lang: 'mixed', hasHindiScript: false, hasEnglishWords: true }

// 2. Translate if needed
const result = await translateToEnglish(rawText, detection.lang);
// → { translatedText: "...", usedTranslation: true, error: null }

// 3. Return normalized English
return {
  normalizedText: result.translatedText,
  langDetected: detection.lang,
  translationUsed: result.usedTranslation,
  translationError: result.error
};
```

### Integration in `/api/reflect`

```typescript
// Before saving reflection
const translationResult = await processReflectionText(rawText);

const reflection = {
  raw_text: rawText,                      // Original: "kal doston se milkar accha laga"
  normalized_text: translationResult.normalizedText, // English: "It felt good meeting friends yesterday"
  lang_detected: translationResult.langDetected,     // "mixed"
  // ... rest of reflection data
};
```

---

## Fallback Behavior

**If Google Translate API key is NOT set:**
- ✅ System still works
- ✅ English text: normalized (grammar, punctuation)
- ⚠️ Hindi/Hinglish: stored as-is without translation
- Logs warning: `GOOGLE_TRANSLATE_API_KEY not configured`

**If translation fails (API error, network issue):**
- ✅ Fallback to normalized original text
- ✅ Error logged for debugging
- ✅ Reflection still saved successfully

---

## Testing

### Test Without API Key (Fallback Mode)

```bash
# Remove or comment out API key in .env.local
# GOOGLE_TRANSLATE_API_KEY=

# Test reflection
curl -X POST http://localhost:3000/api/reflect \
  -H "Content-Type: application/json" \
  -d '{
    "pigId": "test_pig",
    "originalText": "kal doston se milkar accha laga",
    "inputType": "notebook",
    "timestamp": "2025-10-19T12:00:00.000Z"
  }'
```

**Expected**: 
- `normalized_text` = normalized original (not translated)
- `lang_detected` = "mixed"
- Logs: `[TRANSLATION] No API key found, using fallback normalization`

### Test With API Key (Full Translation)

```bash
# Add API key to .env.local
GOOGLE_TRANSLATE_API_KEY=AIzaSy...

# Test same request
```

**Expected**:
- `normalized_text` = "It felt good meeting friends yesterday"
- `lang_detected` = "mixed"
- Logs: `[TRANSLATION] translate_success`

---

## Language Detection

### Detection Logic

```typescript
// Pure Hindi: Contains Devanagari script, no English letters
"मुझे आज अच्छा लग रहा है" → { lang: 'hindi' }

// Pure English: No Devanagari, valid English pattern
"i feel happy today" → { lang: 'english' }

// Mixed/Hinglish: Has English letters (with or without Devanagari)
"kal doston se milkar accha laga" → { lang: 'mixed' }
"मैं feeling good today" → { lang: 'mixed' }
```

### Confidence Levels
- High confidence (0.95): Pure Hindi or pure English
- Medium confidence (0.85): Mixed/Hinglish
- Low confidence (0.5): Unclear/edge cases

---

## Logging

Translation operations are logged with structured data:

### Successful Translation
```javascript
[TRANSLATION] {
  op: 'translate_success',
  lang: 'mixed',
  original_length: 34,
  translated_length: 41,
  duration_ms: 342,
  preview: 'It felt good meeting friends yesterday'
}
```

### Fallback (No API Key)
```javascript
[TRANSLATION] {
  op: 'normalize_only',
  lang: 'english',
  original_length: 20,
  normalized_length: 21,
  duration_ms: 2
}
```

### Error
```javascript
[TRANSLATION] {
  op: 'translate_error',
  lang: 'hindi',
  error: 'Google Translate API error: 403 - ...',
  duration_ms: 156
}
```

---

## Cost Management

### Monitoring Usage

Check your usage in [Google Cloud Console](https://console.cloud.google.com/apis/api/translate.googleapis.com/quotas):
- Free quota: 500,000 chars/month
- Current usage: Updated daily
- Set alerts when approaching limit

### Reducing Costs

1. **Cache translations**: Store common phrases (future enhancement)
2. **Client-side detection**: Skip translation for obvious English
3. **Batch requests**: Group multiple reflections (if needed)
4. **Rate limiting**: Already implemented (10 req/min per session)

---

## Production Deployment

### Environment Variables (Vercel)

Add to Vercel project settings:
```bash
GOOGLE_TRANSLATE_API_KEY=AIzaSy...your-key-here
```

### Monitoring

Watch Vercel logs for:
- `[TRANSLATION] translate_success` - Working correctly
- `[TRANSLATION] translate_error` - API issues
- `No API key found` - Missing environment variable

---

## Future Enhancements

- [ ] Add caching for common phrases
- [ ] Support more Indian languages (Tamil, Telugu, Bengali)
- [ ] Implement translation confidence scores
- [ ] Add user preference: "Always translate" vs "Ask first"
- [ ] Store translation metadata for analysis

---

## Troubleshooting

### Issue: "No translation returned"
**Fix**: Check API key is valid and Cloud Translation API is enabled

### Issue: 403 Forbidden
**Fix**: 
1. Check API key restrictions in Google Cloud Console
2. Verify billing is enabled (free tier requires card on file)

### Issue: Quota exceeded
**Fix**: 
1. Check usage in Google Cloud Console
2. Wait for quota reset (monthly)
3. Or upgrade to paid tier

### Issue: Translation quality poor
**Note**: Google Translate works best with:
- Complete sentences (not fragments)
- Proper grammar
- Context-rich text

---

## Support

For issues:
1. Check Vercel logs: `[TRANSLATION]` entries
2. Test API key manually: https://cloud.google.com/translate/docs/basic/discovering-supported-languages
3. Verify environment variables are set

**The translation system includes graceful fallbacks - reflections will always save, even if translation fails.**
