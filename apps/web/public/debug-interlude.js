// DEBUG SCRIPT - Run this in browser console (F12) during interlude
// Copy-paste this entire script and press Enter

console.clear();
console.log('%c🔍 INTERLUDE DEBUG REPORT', 'font-size: 20px; font-weight: bold; color: #ec4899;');
console.log('='.repeat(50));

// 1. Check Reduced Motion
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
console.log(`\n1️⃣ Reduced Motion: ${reducedMotion ? '❌ ENABLED (waves/motes hidden!)' : '✅ DISABLED (animations should show)'}`);

// 2. Check for React components
setTimeout(() => {
  const soundToggle = document.querySelector('[class*="SoundToggle"]') || document.querySelector('button[aria-label*="sound"]') || document.querySelector('button[aria-label*="Sound"]');
  const authIndicator = document.querySelectorAll('[class*="auth"]').length > 0 || document.querySelector('[class*="Auth"]');
  const pig = document.querySelector('[class*="PinkPig"]') || document.querySelectorAll('svg').length > 0;
  
  console.log(`\n2️⃣ Component Detection:`);
  console.log(`   Sound Toggle: ${soundToggle ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`   Auth Indicator: ${authIndicator ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`   Pink Pig: ${pig ? '✅ FOUND' : '❌ NOT FOUND'}`);
  
  if (soundToggle) {
    console.log(`   Sound Toggle location:`, soundToggle.getBoundingClientRect());
  }
}, 500);

// 3. Check for animated elements
setTimeout(() => {
  const allElements = document.querySelectorAll('*');
  const animatingElements = Array.from(allElements).filter(el => {
    const style = window.getComputedStyle(el);
    return style.animation !== 'none' || style.transform !== 'none';
  });
  
  console.log(`\n3️⃣ Animated Elements: ${animatingElements.length} found`);
  
  // Check for specific interlude elements
  const waves = Array.from(allElements).filter(el => {
    const classes = el.className || '';
    return classes.includes('rounded-full') && classes.includes('border');
  });
  
  const motes = Array.from(allElements).filter(el => {
    const classes = el.className || '';
    return classes.includes('rounded-full') && classes.includes('blur');
  });
  
  console.log(`   Radial Waves: ${waves.length > 0 ? `✅ ${waves.length} found` : '❌ NOT FOUND'}`);
  console.log(`   Dust Motes: ${motes.length > 0 ? `✅ ${motes.length} found` : '❌ NOT FOUND'}`);
  
  if (waves.length === 0 && !reducedMotion) {
    console.log(`   ⚠️  Waves missing but reduced motion is OFF - check phase state!`);
  }
}, 1000);

// 4. Check for InterludeVisuals phase
setTimeout(() => {
  console.log(`\n4️⃣ React DevTools Check:`);
  console.log(`   Open React DevTools and search for "InterludeVisuals"`);
  console.log(`   Check the 'phase' prop - should be 'interlude_active'`);
  console.log(`   Check the 'reduceMotion' prop - should be false`);
}, 1500);

// 5. Check z-index layering
setTimeout(() => {
  const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
    return window.getComputedStyle(el).position === 'fixed';
  }).map(el => ({
    element: el.tagName,
    zIndex: window.getComputedStyle(el).zIndex,
    classes: el.className
  }));
  
  console.log(`\n5️⃣ Fixed Position Elements (z-index layering):`);
  fixedElements.forEach(item => {
    console.log(`   ${item.element} - z-index: ${item.zIndex}`);
  });
}, 2000);

// 6. Check for skip button
setTimeout(() => {
  const skipButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.toLowerCase().includes('skip')
  );
  
  console.log(`\n6️⃣ Skip Button: ${skipButton ? '❌ FOUND (BUG!)' : '✅ NOT FOUND (correct)'}`);
  if (skipButton) {
    console.log(`   ⚠️  Skip button still exists - old code is loaded!`);
    console.log(`   Button:`, skipButton);
  }
}, 2500);

// 7. Final summary
setTimeout(() => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`%c📋 DIAGNOSIS`, 'font-size: 16px; font-weight: bold; color: #ec4899;');
  console.log(`\nIf waves/motes are missing:`);
  console.log(`  • Reduced motion enabled → ${reducedMotion ? 'YES - disable in OS settings' : 'NO'}`);
  console.log(`  • Phase not 'interlude_active' → Check React DevTools`);
  console.log(`  • Elements hidden by z-index → Check layer order above`);
  console.log(`\nIf sound toggle/auth missing:`);
  console.log(`  • Old bundle cached → Hard refresh (Ctrl+Shift+R)`);
  console.log(`  • Wrong deployment → Check Vercel commit hash`);
  console.log(`\nIf skip button shows:`);
  console.log(`  • OLD CODE LOADED → Force refresh or clear .next cache`);
  console.log(`\n✅ Expected commit: edde34c`);
  console.log(`Run: git log --oneline -1`);
}, 3000);
