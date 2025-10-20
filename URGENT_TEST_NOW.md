URGENT: TEST THIS RIGHT NOW
=========================

Your local dev server is running at: http://localhost:3000

## IMMEDIATE TEST STEPS:

1. Open **NEW INCOGNITO/PRIVATE WINDOW**
   - Chrome: Ctrl+Shift+N
   - Firefox: Ctrl+Shift+P
   - Edge: Ctrl+Shift+N

2. Navigate to: **http://localhost:3000/reflect/testpig**

3. Type ANY TEXT (at least 50 characters)

4. Click "Hold this moment" button

5. IMMEDIATELY you should see:

   ✅ **TOP CENTER**: White pill with "Guest" or your email
   ✅ **BOTTOM RIGHT**: Sound toggle button (speaker icon)
   ✅ **CENTER**: Pink pig (Fury)
   ✅ **AROUND PIG**: 3 expanding circular rings (radial waves)
   ✅ **FLOATING UP**: Small white dots drifting upward (dust motes)
   ✅ **PIG GLOWING**: Fury gets brighter/dimmer every 5 seconds
   ✅ **NO SKIP BUTTON**: Nowhere to click to skip

## IF YOU DON'T SEE WAVES/PARTICLES:

**Check Reduced Motion Setting:**

### Windows:
1. Settings → Accessibility → Visual effects
2. Make sure "Animation effects" is **ON**

### Mac:
1. System Preferences → Accessibility → Display  
2. **UNCHECK** "Reduce motion"

### Browser Override (temporary):
Open browser console (F12) and run:
```javascript
document.body.style.animation = 'test 1s';
```

Then refresh page.

## IF SOUND TOGGLE/AUTH NOT SHOWING:

Check browser console (F12) for React errors. Look for:
- "Cannot find module 'SoundToggle'"
- "Cannot find module 'AuthStateIndicator'"
- Any red error messages

## PROOF THE CODE IS CORRECT:

Run this in PowerShell:
```powershell
cd c:\Users\Kafka\Documents\Leo\apps\web\src\components\organisms
cat InterludeVisuals.tsx | Select-String -Pattern "dust motes|radial waves|film grain" | Measure-Object -Line
```

Should show: **Count : 3** (all 3 elements present)

```powershell
cd c:\Users\Kafka\Documents\Leo\apps\web\src\components\organisms  
cat InterludeFlow.tsx | Select-String -Pattern "SoundToggle|AuthStateIndicator" | Measure-Object -Line
```

Should show: **Count : 4** (import + render for both)

## VERCEL DEPLOYMENT:

May take 2-5 minutes to propagate globally.

Check deployment status:
https://vercel.com/your-team/your-project/deployments

Latest deployment should be commit: **edde34c**

## NUCLEAR OPTION (if localhost also broken):

```powershell
cd c:\Users\Kafka\Documents\Leo\apps\web
rm -r -fo .next
rm -r -fo node_modules\.cache
npm run dev
```

Then test again at http://localhost:3000/reflect/testpig

---

**CRITICAL**: Test on localhost FIRST before checking Vercel. This will tell us if it's a code issue or a deployment/cache issue.
