# Quick Testing Guide - WhatsApp Share v2

## 🚀 Start Here

1. **Open Dev Console** (F12) to see QA logs
2. **Create a moment** with a reflection (and wait for poem to generate)
3. **Test each share option** from the library

---

## ✅ Quick Tests (5 minutes)

### Test 1: Heart Only (English)
1. Click WhatsApp button on any moment
2. Select "Share my heart"
3. **Verify in WhatsApp:**
   - ✅ "This has been sitting on my chest lately:"
   - ✅ Reflection in quotes
   - ✅ "Keeping it here with you too: 🔗 [link]"
   - ❌ NO old phrases
4. **Click the link** and verify:
   - ✅ Pig with glowing envelope appears
   - ✅ Tap reveals ONLY reflection (no poem)
   - ✅ Subtitle: "Someone trusted you with a piece of their heart."

### Test 2: Poem Only (English)  
1. Click WhatsApp → "Share my poem"
2. **Verify in WhatsApp:**
   - ✅ "This little QuietDen poem wouldn't leave me alone today:"
   - ✅ Poem in quotes
   - ✅ "Thought of you — open it here: 🔗"
   - ❌ NO reflection included
3. **Click link:**
   - ✅ Tap reveals ONLY poem (no reflection)

### Test 3: Both (English)
1. Click WhatsApp → "Share both"
2. **Verify in WhatsApp:**
   - ✅ "This has been living quietly in my head:"
   - ✅ Reflection in quotes
   - ✅ "So QuietDen turned it into this tiny poem:"
   - ✅ Poem in quotes
   - ✅ "Keeping both here with you: 🔗"
   - ❌ NO duplication
3. **Click link:**
   - ✅ Shows reflection, then ✦ divider, then poem

### Test 4: Hindi Translation
1. Click translate button (हिं) on a moment
2. Wait for translation
3. Click WhatsApp → any option
4. **Verify:**
   - ✅ Hindi text renders correctly (no broken characters)
   - ✅ Link has `&lang=hi` in URL
5. **Click link:**
   - ✅ Error messages in Hindi (if testing with invalid ID)
   - ✅ Subtitles in Hindi

### Test 5: Windows Overflow (Buildings)
1. **Open console** (F12)
2. Look for `[QA Windows]` logs
3. **Check each building:**
   - ✅ `maxWindows` >= `actualMoments` (or moments are truncated)
   - ✅ No windows sticking out of building tops
4. **Add more moments** and verify:
   - ✅ Buildings grow taller dynamically
   - ✅ More windows appear
   - ✅ Still no overflow

### Test 6: Edge Cases
1. **Invalid moment ID:**
   - Visit: `http://localhost:3000/share/invalid-12345`
   - ✅ Shows "This letter got lost in the city"
   - ✅ Floating sad pig (🐷)
   - ✅ CTA: "Create your own moment"

2. **Invalid mode:**
   - Visit: `http://localhost:3000/share/[valid-id]?mode=pizza`
   - ✅ Defaults to showing both
   - ✅ No errors in console

3. **Invalid lang:**
   - Visit: `http://localhost:3000/share/[valid-id]?lang=klingon`
   - ✅ Defaults to English
   - ✅ No errors in console

---

## 🔍 Console Logs to Check

When you share via WhatsApp, console should show:

```
[QA WhatsApp Share] Starting share with: { choice: 'heart', language: 'en', momentId: '...' }
[QA WhatsApp Share] Content: { isHindi: false, hasTranslation: false, hasPoem: true, textLength: 47 }
[QA WhatsApp Share] Reveal URL: https://your-domain.com/share/xyz123?mode=heart&lang=en
[WhatsApp Share] Composed message: This has been sitting on my chest lately:...
[QA WhatsApp Share] Final WhatsApp URL length: 342
[QA WhatsApp Share] Share text preview: This has been sitting on my chest lately:

"I felt overwhelmed by all the emails today"

Keeping it h...
```

When buildings render:

```
[QA Windows] Tower peaceful: {
  momentCount: 3,
  baseHeight: 225,
  additionalHeight: 0,
  totalHeight: 225,
  availableHeight: 193,
  maxRows: 4,
  maxWindows: 16,
  actualMoments: 3
}
```

---

## 🐛 What to Look For (Red Flags)

❌ **WhatsApp Messages:**
- "Sharing a piece of my heart with you:" (OLD - should be removed)
- "Here's what's been on my mind" (OLD - should be removed)  
- "And this is the poem that grew from it:" (OLD - should be removed)
- Reflection or poem appearing twice

❌ **Buildings:**
- Windows floating above building roof
- Windows clipped/cut off at edges
- Huge gaps between windows or overlapping windows

❌ **Reveal Page:**
- Raw error: "Error: Moment not found" (should show graceful pig message)
- Blank page with no content
- "undefined" or "null" text showing
- Broken Unicode (�����) in Hindi text
- Showing both reflection AND poem when mode=heart or mode=poem

❌ **Console:**
- Red errors about invalid mode/lang
- "Cannot read property of undefined"
- 404 errors for /api/share/[id]

---

## 📱 Mobile Testing (If Possible)

1. **Share from mobile device** to your own WhatsApp
2. **Open the link in WhatsApp** (tests link preview)
3. **Verify:**
   - Link preview shows pig emoji thumbnail
   - Title: "A quiet moment for you."
   - Tap link opens reveal page
   - Tap envelope works (no lag on mobile)
   - Text is readable (not too small)
   - CTA button is tappable (not too small)

---

## ✅ Success Criteria

**All Tests Pass If:**
- ✅ All 6 share combinations work (heart/poem/both × en/hi)
- ✅ NO old template phrases appear anywhere
- ✅ Hindi text renders correctly (no mojibake)
- ✅ Reveal page shows correct content for each mode
- ✅ Buildings never overflow with windows
- ✅ Edge cases show graceful errors (not raw crashes)
- ✅ Console logs show expected QA output
- ✅ Link previews work in WhatsApp

**If ANY test fails:**
- Check console for errors
- Verify you're on latest commit (21c23e1)
- Clear browser cache and reload
- Check if moment has required data (text, poem, etc.)

---

## 🎯 Production Smoke Test

After deploying:

1. **Create one real moment**
2. **Share via WhatsApp** to yourself
3. **Click the link** from WhatsApp
4. **Verify it works** end-to-end
5. **Check error monitoring** for any crashes

That's it! 🚀

---

*Full checklist: See QA_WHATSAPP_SHARE_V2.md*
