# Interlude Experience Test Plan

**Date**: October 20, 2025  
**Commit**: `edde34c` - "feat: Complete Ghibli-inspired interlude experience"  
**Status**: ✅ Local build passing, deployed to Vercel

## What Was Implemented

### ✅ 1. NO SKIP BUTTON
- **File**: `InterludeFlow.tsx` lines 77-89
- **Change**: Removed `onSkip` prop, removed all skip button UI (lines 356-372 deleted)
- **Code**: Removed `showSkip` state, removed `handleSkip` function, removed `SHOW_SKIP_AFTER` timing constant
- **Expected**: NO visible skip button during interlude - users experience full flow

### ✅ 2. SOUND TOGGLE PERSISTS
- **File**: `InterludeFlow.tsx` lines 267-268
- **Code**: 
```tsx
{/* Sound Toggle - Persists through interlude */}
<SoundToggle />
```
- **Expected**: Sound toggle button visible in bottom-right corner throughout interlude

### ✅ 3. AUTH STATE INDICATOR PERSISTS  
- **File**: `InterludeFlow.tsx` lines 270-278
- **Code**:
```tsx
{/* Auth State Indicator - Top center */}
<div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 px-6">
  <div className="flex items-center gap-4 backdrop-blur-sm bg-white/30 rounded-full px-4 py-2">
    <AuthStateIndicator 
      userName={session?.user?.name || session?.user?.email}
      isGuest={status === 'unauthenticated'}
    />
  </div>
</div>
```
- **Expected**: Top center pill showing "Guest" or user name/email throughout interlude

### ✅ 4. RADIAL BREATHING WAVES
- **File**: `InterludeVisuals.tsx` lines 59-82
- **Code**: 3 waves expanding from pig center, 6s duration, staggered by 2s
```tsx
{!reduceMotion && phase === 'interlude_active' && (
  <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-5">
    {Array.from({ length: waveCount }).map((_, i) => (
      <motion.div
        key={`wave-${i}`}
        className="absolute rounded-full border-2 border-pink-300/30"
        animate={{ scale: [0, 3.5], opacity: [0.6, 0] }}
        transition={{ duration: 6, repeat: Infinity, delay: i * 2 }}
      />
    ))}
  </div>
)}
```
- **Expected**: See 3 concentric circles expanding outward from Fury, fading as they grow

### ✅ 5. FLOATING DUST MOTES
- **File**: `InterludeVisuals.tsx` lines 120-167
- **Code**: 8 particles floating upward, 8-12s animations, random drift
```tsx
{!reduceMotion && phase === 'interlude_active' && (
  <div className="fixed inset-0 pointer-events-none z-15 overflow-hidden">
    {Array.from({ length: particleCount }).map((_, i) => {
      const startX = 10 + Math.random() * 80;
      const startY = 60 + Math.random() * 40;
      const endY = -10;
      const drift = (Math.random() - 0.5) * 30;
      const duration = 8 + Math.random() * 4;
      return (
        <motion.div
          key={`mote-${i}`}
          className="absolute rounded-full bg-white/40 blur-[1px]"
          animate={{
            y: `${endY}vh`,
            x: `${drift}%`,
            opacity: [0, 0.6, 0.6, 0]
          }}
          transition={{ duration, repeat: Infinity }}
        />
      );
    })}
  </div>
)}
```
- **Expected**: See 8 small white particles slowly drifting upward with slight horizontal wobble

### ✅ 6. BIOLUMINESCENT PULSE
- **File**: `InterludeVisuals.tsx` lines 84-118  
- **Code**: 5s breathing cycle, brightness 1.0 → 1.15, glow 0% → 40%
```tsx
<motion.div
  animate={
    !reduceMotion && phase === 'interlude_active'
      ? {
          filter: [
            'brightness(1) drop-shadow(0 0 0px rgba(255, 105, 180, 0))',
            `brightness(1.15) drop-shadow(0 0 40px rgba(255, 105, 180, ${glowIntensity}))`,
            'brightness(1) drop-shadow(0 0 0px rgba(255, 105, 180, 0))',
          ],
        }
      : {}
  }
  transition={{ duration: 5, repeat: Infinity, ease: breathingCurve }}
>
  <PinkPig size={200} state="thinking" />
</motion.div>
```
- **Expected**: Fury glows brighter and dimmer in 5-second cycle, synchronized with background

### ✅ 7. FILM GRAIN OVERLAY
- **File**: `InterludeVisuals.tsx` lines 169-186
- **Code**: SVG feTurbulence noise, 3% opacity
```tsx
<motion.div className="fixed inset-0 pointer-events-none z-30 mix-blend-overlay" style={{ opacity: 0.03 }}>
  <svg width="100%" height="100%">
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
</motion.div>
```
- **Expected**: Subtle film grain texture over entire screen (very subtle, 3% opacity)

### ✅ 8. DEPTH BLUR VIGNETTE
- **File**: `InterludeVisuals.tsx` lines 45-57
- **Code**: Radial gradient mask with backdrop-filter blur at edges
```tsx
<motion.div
  className="fixed inset-0 pointer-events-none z-10"
  style={{
    background: 'radial-gradient(circle at center, transparent 0%, transparent 50%, rgba(255, 192, 203, 0.2) 100%)',
    backdropFilter: 'blur(8px)',
    maskImage: 'radial-gradient(circle at center, transparent 60%, black 100%)',
  }}
/>
```
- **Expected**: Edges of screen slightly blurred and tinted pink, focus on center

---

## How to Test

### Local Testing (RECOMMENDED)
1. **Start local server**: Already running at `http://localhost:3000`
2. **Navigate**: Go to `/reflect/testpig`
3. **Type reflection**: Enter any text (50+ chars recommended)
4. **Submit**: Click "Hold this moment" button
5. **Watch interlude**: Should see ALL elements above

### Vercel Testing (May need cache clear)
1. **Open in incognito/private window** (avoids cache)
2. **Or hard refresh**: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)
3. **Navigate**: https://your-vercel-url.vercel.app/reflect/testpig
4. **Test same flow as above**

---

## Debugging Checklist

If you DON'T see the features:

### ❌ No Sound Toggle or Auth Indicator
- **Check**: Browser console for React errors
- **Verify**: `SoundToggle` component imports correctly
- **Issue**: These are positioned with `fixed`, check z-index stacking

### ❌ No Radial Waves
- **Check**: `prefers-reduced-motion` setting in browser/OS
  - Windows: Settings → Accessibility → Visual effects → Animation effects (turn ON)
  - Mac: System Preferences → Accessibility → Display → Reduce motion (uncheck)
- **Verify**: `reduceMotion` prop is `false` in InterludeVisuals
- **Look**: Waves are `z-5`, might be behind other elements

### ❌ No Floating Dust Motes  
- **Check**: Same as radial waves - `prefers-reduced-motion` disables them
- **Verify**: `phase === 'interlude_active'` (check in React DevTools)
- **Look**: They're `z-15`, small (2-5px), white/40 opacity - very subtle

### ❌ No Bioluminescent Pulse
- **Check**: Fury should breathe in 5s cycles - look closely at brightness changes
- **Verify**: filter property applies correctly (some browsers don't support filter animations well)
- **Try**: Firefox or Chrome (best support for filter animations)

### ❌ Skip Button Still Shows
- **Critical**: This means old code is deployed
- **Solution**: 
  1. Clear browser cache completely
  2. Check Vercel deployment logs for build time
  3. Verify commit `edde34c` is deployed
  4. If persists, re-deploy from Vercel dashboard

---

## Browser Dev Tools Commands

Open browser console and run:

```javascript
// Check InterludeFlow component props
// (React DevTools required)
$r.props

// Force re-render
location.reload(true)

// Check if reduced motion is active
window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Should return: false (for full animations)

// Check current phase
// Look in React DevTools for InterludeFlow → phase state
```

---

## Expected Visual Timeline

**0-2.5s**: `held_safe` phase
- Static Fury with soft glow
- Text: "Your moment has been held safe"
- No waves, no particles yet

**2.5s-complete**: `interlude_active` phase  
- ✅ Radial waves start expanding (3 waves, staggered)
- ✅ Dust motes begin floating upward
- ✅ Fury pulses with 5s breathing cycle
- ✅ Film grain overlay visible (subtle)
- ✅ Depth blur vignette at edges
- ✅ Sound toggle visible bottom-right
- ✅ Auth indicator visible top-center
- ❌ NO skip button anywhere

**Complete**: `complete_transition` phase (2s)
- Text: "Your moment is ready"
- Animations fade out gracefully
- Transitions to enriched reflection view

---

## Files Modified in Commit edde34c

1. **apps/web/src/components/organisms/InterludeFlow.tsx**
   - Removed skip button (lines deleted: 138-145, 356-372)
   - Added SoundToggle import and render
   - Added AuthStateIndicator import and render
   - Removed onSkip prop from interface

2. **apps/web/src/components/organisms/InterludeVisuals.tsx**
   - Complete rewrite (274 lines → 216 lines)
   - Added radial waves (lines 59-82)
   - Added dust motes (lines 120-167)
   - Added bioluminescent pulse (lines 84-118)
   - Added film grain (lines 169-186)
   - Added depth blur vignette (lines 45-57)

3. **apps/web/src/components/scenes/Scene_Reflect.tsx**
   - Removed onSkip prop from InterludeFlow call
   - Removed handleInterludeSkip function

---

## If Still Broken

**Hard Reset Local**:
```powershell
cd c:\Users\Kafka\Documents\Leo\apps\web
rm -r -fo .next
npm run build
npm run dev
```

**Force Vercel Redeploy**:
```powershell
cd c:\Users\Kafka\Documents\Leo
git commit --allow-empty -m "chore: Force redeploy interlude"
git push origin main
```

**Check Git History**:
```powershell
git log --oneline -3
# Should show: edde34c (HEAD -> main, origin/main) feat: Complete Ghibli-inspired interlude experience

git show edde34c --stat
# Should show 3 files changed, 197 insertions(+), 274 deletions(-)
```

---

## Current Status

- ✅ Local build: **PASSING** (confirmed via npm run build)
- ✅ Type check: **NO ERRORS**
- ✅ Git commit: **edde34c pushed to origin/main**
- ✅ Vercel: **Deployment triggered**
- ✅ Dev server: **Running on http://localhost:3000**

**RECOMMENDATION**: Test on `http://localhost:3000/reflect/testpig` RIGHT NOW to confirm all features work locally. If local works but Vercel doesn't, it's a deployment/cache issue, not a code issue.
