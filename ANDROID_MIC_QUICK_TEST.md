# 🎤 Android Microphone Quick Test Guide

## 🚀 Test Now (After Vercel deploys in ~2 min)

**Test URL:** `https://[your-vercel-domain]/test/voice`

---

## ✅ Quick Test (30 seconds)

1. **Open test page on your Android phone**
2. **Grant microphone permission** (tap "Allow")
3. **Press and HOLD the pink orb**
4. **Speak for 3-5 seconds** (say anything)
5. **Release the orb**
6. **Check for success message** ("[Voice input recorded]" should appear)

---

## 🔍 If It Doesn't Work

### Check Browser Console (3 steps):

1. Chrome menu → **More tools** → **Developer tools** → **Console tab**
2. Look for `[VoiceOrb] Audio blob created:`
3. Check the **size** value:

   - ✅ **size > 0 bytes** = WORKING! (even if small)
   - ❌ **size = 0 bytes** = Problem (see below)

### Common Fixes:

| Issue | Fix |
|-------|-----|
| **Permission blocked** | Chrome settings → Site settings → Microphone → Allow |
| **Track muted warning** | Android Settings → Apps → Chrome → Permissions → Microphone |
| **No data chunks** | Tap orb again (AudioContext may need resume) |
| **Diagnostics show ❌** | Update Chrome to latest version |

---

## 📊 What Changed (Technical)

**Old:** Web Speech API (unreliable on Android)  
**New:** MediaRecorder with:
- AudioContext.resume() for mobile
- Track verification (enabled, muted, readyState)
- MIME type detection (webm, ogg, 3gpp)
- Timeslice for reliable chunks

**Why it works now:**
- Doesn't depend on cloud transcription
- Explicitly resumes suspended AudioContext on mobile
- Verifies audio tracks are actually active before recording
- Uses Android-compatible audio formats

---

## 📱 Expected Console Output (Success)

```
[VoiceOrb] Diagnostics: [
  "✅ getUserMedia supported",
  "✅ MediaRecorder supported",
  "✅ Supported mimes: audio/webm;codecs=opus",
  "✅ AudioContext supported"
]
[VoiceOrb] Track state: { enabled: true, muted: false, readyState: "live" }
[VoiceOrb] AudioContext state: running
[VoiceOrb] Data chunk received: 1024 bytes
[VoiceOrb] Audio blob created: { size: 8192, type: "audio/webm;codecs=opus" }
```

---

## 🎯 What to Report Back

**If it works:**
- ✅ "Working! Blob size: XXXX bytes"

**If it fails:**
- ❌ Screenshot of diagnostic checkmarks (green/red)
- ❌ Console log (copy all `[VoiceOrb]` lines)
- ❌ Android version + Chrome version

---

**Full details:** See `ANDROID_CHROME_MIC_FIX.md`
