# QA Checklist: WhatsApp Share v2 & Building Windows

## 🪟 Building Windows

### Desktop Testing
- [ ] **Shortest building** - No windows overflow beyond building top
- [ ] **Medium-height building** - Windows fit within boundaries
- [ ] **Tallest building** - All windows contained properly
- [ ] **Dynamically grown building** (after 4+ moments) - Building grows taller and windows stay within bounds

### Mobile Testing  
- [ ] Same tests as desktop on mobile viewport
- [ ] Buildings scale correctly on narrow screens
- [ ] Windows remain proportional and don't clip

### Dynamic Recalculation
- [ ] **City regenerates** - `maxWindows` recalculates correctly for new buildings
- [ ] **Same building grows taller** - Adding moments increases building height and window capacity dynamically
- [ ] Check dev console for `[QA Windows]` logs showing:
  - `momentCount` matches actual moments
  - `maxWindows` is reasonable (not 0, not 1000+)
  - `actualMoments` <= `maxWindows`

### Visual Quality Checks
- [ ] No clipping against sky/gradient at building tops
- [ ] Even spacing between rows of windows (gap-3 = 12px)
- [ ] No weird "last half-row" when height is borderline
- [ ] Windows remain clickable/hoverable with tooltips working
- [ ] Newest window glows brightest with golden halo
- [ ] Blinking animation works on newly added moments

---

## 📱 WhatsApp Share v2

### Text Templates - English

**Test mode=heart&lang=en**
- [ ] Share button opens WhatsApp
- [ ] Message reads: "This has been sitting on my chest lately:"
- [ ] Reflection text appears in quotes
- [ ] Footer: "Keeping it here with you too: 🔗 [reveal link]"
- [ ] NO old phrases ("Sharing a piece of my heart", etc.)

**Test mode=poem&lang=en**
- [ ] Message reads: "This little QuietDen poem wouldn't leave me alone today:"
- [ ] Poem text appears in quotes
- [ ] Footer: "Thought of you — open it here: 🔗 [reveal link]"
- [ ] NO reflection text included
- [ ] If no poem exists, gracefully falls back to heart mode

**Test mode=both&lang=en**
- [ ] Message reads: "This has been living quietly in my head:"
- [ ] Reflection appears in quotes
- [ ] Separator line: "So QuietDen turned it into this tiny poem:"
- [ ] Poem appears in quotes
- [ ] Footer: "Keeping both here with you: 🔗 [reveal link]"
- [ ] NO duplication of reflection or poem

### Text Templates - Hindi

**Test mode=heart&lang=hi**
- [ ] Message reads: "दिल का एक छोटा-सा टुकड़ा तुम्हारे साथ बाँट रही/रहा हूँ:"
- [ ] Reflection in Hindi (if translated) or English
- [ ] Footer: "QuietDen ने इसे ऐसे सँभाला: 🔗 [reveal link]"
- [ ] Hindi text renders correctly (no mojibake/broken characters)
- [ ] Unicode characters display properly on Android/iOS

**Test mode=poem&lang=hi**
- [ ] Message reads: "QuietDen से ये छोटी-सी कविता मिली, तुम्हारा ख़याल आ गया:"
- [ ] Poem in Hindi (if translated) or English
- [ ] Footer: "अगर ये तुम्हें भी छू जाए: 🔗 [reveal link]"
- [ ] NO reflection included

**Test mode=both&lang=hi**
- [ ] Message reads: "काफ़ी समय से दिल में ये बात घूम रही है:"
- [ ] Reflection in quotes
- [ ] Separator: "QuietDen ने इसे ऐसी छोटी-सी कविता में बदल दिया:"
- [ ] Poem in quotes
- [ ] Footer: "ये दोनों तुम्हारे लिए: 🔗 [reveal link]"

### Console Logging (Dev Mode)
Check browser console for QA logs:
- [ ] `[QA WhatsApp Share] Starting share with:` shows correct choice & language
- [ ] `[QA WhatsApp Share] Content:` shows hasPoem, hasTranslation, textLength
- [ ] `[QA WhatsApp Share] Reveal URL:` shows properly formatted URL with mode & lang params
- [ ] `[QA WhatsApp Share] Final WhatsApp URL length:` is reasonable (<2000 chars)
- [ ] `[QA WhatsApp Share] Share text preview:` shows first 100 chars (verify template is correct)

---

## 🔗 Reveal Page

### Link Preview (OpenGraph)
- [ ] **Android WhatsApp** - Link preview shows pig emoji, title, description
- [ ] **iOS WhatsApp** - Same as Android
- [ ] **Browser copy-paste** - Preview loads correctly
- [ ] Title matches language (EN: "A quiet moment for you." / HI: "आपके लिए एक शांत पल।")
- [ ] Description matches mode:
  - `heart` (EN): "Someone trusted you with a piece of what they're feeling."
  - `heart` (HI): "किसी ने अपने महसूस किए हुए का एक हिस्सा आपके साथ बाँटा है।"
  - `poem` (EN): "Someone shared a small QuietDen poem with you."
  - `poem` (HI): "किसी ने QuietDen की छोटी-सी कविता आपके साथ बाँटी है।"
  - `both` (EN): "Someone shared both their words and the poem that grew out of them."
  - `both` (HI): "किसी ने अपनी बात और उससे निकली कविता — दोनों आपके लिए भेजे हैं।"

### Envelope Animation
- [ ] Page loads with gradient background (matching moment's emotion zone color)
- [ ] Pig holding glowing envelope appears
- [ ] Envelope glows with pulsing animation (subtle breathe effect)
- [ ] Pig floats gently (y: [-8, 8, -8] animation loop)
- [ ] Instruction text appears: "Tap to open the moment." (EN) / "पल खोलने के लिए टैप करें।" (HI)
- [ ] Cursor changes to pointer on hover
- [ ] Hover scales pig slightly (1.05)

### Tap-to-Reveal Interaction
- [ ] Tap/click triggers smooth transition (no lag/stutter)
- [ ] Envelope screen fades out (opacity: 0)
- [ ] Content fades in (opacity: 1, y: 20 → 0)
- [ ] Transition duration feels natural (~800ms)
- [ ] Works on touch (mobile) and click (desktop)

### Content Display - Mode Awareness

**mode=heart**
- [ ] Shows only reflection text (large serif font)
- [ ] Image displays if present
- [ ] NO poem shown
- [ ] Subtitle: "Someone trusted you with a piece of their heart." (EN)
- [ ] Subtitle: "किसी ने दिल का एक हिस्सा आपके साथ बाँटा है।" (HI)

**mode=poem**
- [ ] Shows only poem text (centered, italic)
- [ ] Image displays if present
- [ ] NO reflection shown
- [ ] Subtitle: "Someone wanted to share a quiet moment with you." (EN)
- [ ] Subtitle: "किसी ने आपके साथ एक शांत पल बाँटना चाहा।" (HI)

**mode=both**
- [ ] Shows reflection text first
- [ ] Decorative divider (✦) between reflection and poem
- [ ] Shows poem text below divider
- [ ] Image displays if present
- [ ] Subtitle: "From what they felt to what it became." (EN)
- [ ] Subtitle: "जो उन्होंने महसूस किया, उससे जो बना, वो सब आपके लिए।" (HI)

### Hindi Rendering
- [ ] Hindi text renders cleanly (no font fallback issues)
- [ ] Text is properly aligned (LTR, not RTL)
- [ ] Devanagari characters display correctly on all devices
- [ ] Line breaks happen naturally (no weird wrapping)

### CTA & Footer
- [ ] CTA button appears at bottom: "Create your own quiet moment →" (EN)
- [ ] CTA button (HI): "अपना शांत पल बनाइए →"
- [ ] Button links to "/" (home page)
- [ ] Pig name displays: "held safe by [pig_name]" (EN)
- [ ] Pig name (HI): "[pig_name] द्वारा सुरक्षित"
- [ ] Button has hover effect (shadow grows)

---

## 🚨 Edge Cases

### Invalid momentId
- [ ] URL: `/share/invalid-id-12345`
- [ ] Shows graceful error: "This letter got lost in the city" (EN)
- [ ] Shows graceful error: "पल खो गया शहर में" (HI)
- [ ] Floating sad pig animation (🐷 bouncing)
- [ ] Subtitle: "This shared moment may have been removed or is no longer available"
- [ ] Subtitle (HI): "यह साझा किया गया पल हटा दिया गया हो सकता है या अब उपलब्ध नहीं है"
- [ ] CTA: "Create your own moment" links to home
- [ ] NO raw error messages or stack traces

### Invalid mode Parameter
- [ ] URL: `/share/[valid-id]?mode=invalid`
- [ ] Defaults to `mode=both`
- [ ] Page renders normally (doesn't crash)
- [ ] Console shows no errors

### Invalid lang Parameter  
- [ ] URL: `/share/[valid-id]?lang=invalid`
- [ ] Defaults to `lang=en`
- [ ] Page renders in English
- [ ] Console shows no errors

### Missing poem (mode=poem)
- [ ] If moment has no poem and user shared `mode=poem`
- [ ] Falls back to showing reflection instead
- [ ] Uses fallback message: "Sharing a quiet moment with you"
- [ ] No blank page or "undefined" text

### Missing mode/lang params
- [ ] URL: `/share/[valid-id]` (no query params)
- [ ] Defaults to `mode=both&lang=en`
- [ ] Works correctly

---

## 📊 QA Summary Checklist

**Pre-Deployment**
- [ ] All old WhatsApp share phrases removed from codebase (grep search)
- [ ] Hindi Unicode renders correctly on test Android device
- [ ] Hindi Unicode renders correctly on test iOS device
- [ ] OpenGraph preview tested with WhatsApp link preview
- [ ] Reveal page loads under 2 seconds on 3G network
- [ ] No console errors in production build
- [ ] Building windows never overflow on any screen size
- [ ] Dynamic building height works with 1, 4, 8, 12, 16+ moments

**Post-Deployment**
- [ ] Share actual moment from production to WhatsApp
- [ ] Verify link preview loads in WhatsApp chat
- [ ] Tap link in WhatsApp and verify reveal page works
- [ ] Test all 6 combinations (heart/poem/both × en/hi)
- [ ] Monitor error logs for any share-related failures
- [ ] Check analytics for reveal page visit rate

---

## 🎨 Optional Copy Variants (Future)

Not mandatory, just parking for later iteration:

**Heart (EN) alternatives:**
- "This has been quietly weighing on me…"
- "I've been carrying this around…"

**Both (EN) alternatives:**
- "This has been humming at the back of my mind…"
- "These words have been following me lately…"

**Poem (HI) alternatives:**
- "आज ये पंक्तियाँ मिलीं और लगा तुम्हें भी सुननी चाहिए"
- "यह कविता दिल से निकली, तुम्हारे लिए भी है"

Current templates are emotionally on-brand and work well ✅

---

## 🔧 Dev Commands

```powershell
# Run local dev server
npm run dev

# Check console for QA logs
# Look for: [QA WhatsApp Share] and [QA Windows]

# Test reveal page locally
# http://localhost:3000/share/[momentId]?mode=heart&lang=en
# http://localhost:3000/share/[momentId]?mode=poem&lang=hi
# http://localhost:3000/share/[momentId]?mode=both&lang=en

# Grep for old phrases (should return 0 results)
git grep -i "sharing a piece of my heart"
git grep -i "here's what's been on my mind"
git grep -i "and this is the poem that grew"
```

---

## ✅ Sign-Off

**QA Tester:** _______________  
**Date:** _______________  
**Build Version:** _______________  
**Notes:** _______________________________________________
