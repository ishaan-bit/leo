# Cinematic Redesign — Reflect Page
**Date:** October 18, 2025  
**Commit:** `3df3793`  
**Status:** ✅ Deployed to Vercel

---

## 🎯 Design Intent

Transform the reflect page from a "web form" into an **immersive RPG journal experience** with cinematic continuity across the entire flow (landing → naming → reflect).

### Core Principles
- **Liminal mood**: Poetic, calm but alive, modern minimal
- **Visual continuity**: Consistent sound toggle position, typography, pig presence
- **Emotional design**: Each element serves the narrative (feather for sign-out, binding holes on notebook, shadow ripples under pig)
- **Microinteractions**: Smooth fades, breathing animations, word-by-word dialogue reveals

---

## ✅ Completed Changes

### 1. **Sound Toggle Position Continuity**
**Problem:** Toggle drifted between scenes (top-left in reflect, top-right in naming)  
**Solution:**
- Removed inline toggle from Scene_Reflect.tsx
- Now uses global `<SoundToggle />` component (top-right, fixed across all scenes)
- Implemented smooth volume fade: 800ms fade-in, 300ms fade-out (not instant mute)
- Added safe-area-inset padding for mobile notch support

**Files:**
- `src/components/atoms/SoundToggle.tsx` — Updated with safe area padding
- `src/lib/sound.ts` — Changed from 3s/2s fades to 800ms/300ms smooth transitions
- `src/components/scenes/Scene_Reflect.tsx` — Removed duplicate inline toggle

---

### 2. **Centered Auth State Indicator**
**Problem:** "Signed in as [name]" was small, off-balance (top-right), disconnected from narrative  
**Solution:**
- Repositioned to **centered top** with `fixed top-8 left-1/2 -translate-x-1/2`
- Glass morphism aesthetic: `bg-white/40 backdrop-blur-md` with rounded pill shape
- Serif font (`DM Serif Text`) matching dialogue typography
- Soft slide-from-above entrance: `y: -20 → 0` with easeOutBack
- Feather sign-out button with hover glow and gentle rotation

**Files:**
- `src/components/atoms/AuthStateIndicator.tsx` — Redesigned with centered layout
- `src/components/scenes/Scene_Reflect.tsx` — Wrapper div for centered positioning

**Visual:**
```
              ┌─────────────────────────────┐
              │ Signed in as Kumar Ishaan 🪶│  ← Centered, floating pill
              └─────────────────────────────┘
```

---

### 3. **Enhanced Pig Character Presence**
**Problem:** Pig was small (160px), missing from view, lacked emotional anchor  
**Solution:**
- Increased size from **160px → 200px** (matches naming scene at 240px, scaled for reflect focus)
- Added **shadow ripple** beneath pig: `blur-2xl` gradient with pulsing opacity
- Intensified **ambient glow** during listening phase: opacity 0.45-0.75 (was 0.4-0.7)
- Connected pig state to typing: `state={scenePhase === 'listening' ? 'thinking' : 'idle'}`
- Pig now uses `onInputFocus` prop for cheek glow when user types

**Files:**
- `src/components/scenes/Scene_Reflect.tsx` — Pig size, glow animation, shadow ripple
- `src/components/molecules/PinkPig.tsx` — Already had typing reaction (cheek glow)

**Animation Timeline:**
- Idle: Gentle breathing (y: 0 → -8 → 0 over 6s)
- Listening: Lean-in (y: 0 → 5 → 0 over 1.5s, scale: 1 → 1.05 → 1)
- Typing: Cheek glow appears (pink-400/40 blur-xl on both sides)

---

### 4. **Notebook Journal Aesthetic**
**Problem:** Flat background, rigid box, looked like a web form  
**Solution:**
- **Background:** Changed from `#fdf8f0` → `#fdf5ed` (warmer cream tone)
- **Borders:** Stronger pink-300/80 (was pink-300/70), rounded-2xl (was rounded-lg)
- **Paper texture:** Enhanced grain with `baseFrequency: 1.2, numOctaves: 4, opacity: 0.08`
- **Stitched margin:** Left edge with 2px dashed border, gradient overlay, **6 binding holes**
- **Line spacing:** Increased from 28px → 32px, thicker rule lines (1.5px)
- **Shadows:** Multi-layer depth: `0 8px 32px`, `0 2px 8px`, plus inset highlights

**Files:**
- `src/components/atoms/NotebookInput.tsx` — Complete visual redesign

**Binding Holes Detail:**
```css
{[...Array(6)].map((_, i) => (
  <div key={i} 
    className="absolute left-3 w-2 h-2 rounded-full 
               bg-pink-200/40 border border-pink-300/50"
    style={{ top: `${15 + i * 15}%` }}
  />
))}
```

---

### 5. **Typography & Visual Hierarchy**
**Problem:** Text too small, inconsistent fonts, lacking intimacy  
**Solution:**
- **Dialogue size:** Increased from `text-xl md:text-2xl` → `text-2xl md:text-3xl`
- **Line height:** Tightened to `1.4` (was `leading-relaxed` ~1.6) for poetic intimacy
- **Font family:** Explicitly set `DM Serif Text` (matches naming scene)
- **Letter spacing:** `0.01em` for breathing room
- **Color:** Darker wine shade `#9C1F5F` (was pink-800, too light)
- **Word spacing:** `mr-[0.35em]` (was 0.3em) for better word-by-word animation

**Files:**
- `src/components/scenes/Scene_Reflect.tsx` — Dialogue typography update

**Before vs After:**
```
❌ text-xl md:text-2xl font-serif italic text-pink-800 leading-relaxed
✅ text-2xl md:text-3xl font-serif italic text-[#9C1F5F] leading-snug
   style={{ fontFamily: "'DM Serif Text', serif", lineHeight: '1.4' }}
```

---

### 6. **Time-Based Gradient Breathing** *(Already Implemented)*
- Background breathing animation: 8s cycle with radial gradient
- Time-aware colors: dawn (peach/rose), noon (blush/cream), dusk (lilac/mauve), night (indigo/violet)
- No additional changes needed — already working beautifully

**Files:**
- `src/lib/time-theme.ts` — 8 time periods with gradients
- `src/components/scenes/Scene_Reflect.tsx` — Breathing motion.div overlay

---

### 7. **Typing Microinteractions** *(Partially Complete)*
**Already Implemented:**
- ✅ Pig lean-in animation on typing (leanIn variant)
- ✅ Ripple expansion around box edges (ink ripple effects)
- ✅ Typing glow intensity tracking

**TODO (Future):**
- ⏳ Pen-scratch typing SFX (subtle paper scratch sound on keypress)
- ⏳ Heart-exhale particle effect on "Let it go" submit

**Files:**
- `src/components/atoms/NotebookInput.tsx` — Ripple effects already present
- `src/components/scenes/Scene_Reflect.tsx` — Lean-in animation implemented

---

## 🎨 Visual Summary

### Layout Hierarchy (Top to Bottom)
```
┌─────────────────────────────────────────────┐
│                                    [🔊]     │  ← Sound toggle (top-right)
│         [Signed in as Name 🪶]             │  ← Auth state (centered)
│                                             │
│                                             │
│                  🐷                         │  ← Pig (200px, centered, breathing)
│               (Leo with                     │
│            shadow ripple)                   │
│                                             │
│    "A fresh dawn — what first stirred      │  ← Dialogue (2xl-3xl, word-by-word)
│              in you?"                       │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │▪▪ ┊                                │   │  ← Notebook (binding holes, paper texture)
│  │▪▪ ┊  [Your reflection here...]      │   │
│  │▪▪ ┊                                │   │
│  │▪▪ ┊                                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│            [🎤 Voice Mode]                  │  ← Mode toggle
└─────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Component Architecture
```
Scene_Reflect.tsx (main orchestrator)
├── <SoundToggle /> — Global component (top-right)
├── <AuthStateIndicator /> — Centered wrapper div
├── <PinkPig size={200} state="thinking" /> — Character with animations
├── Dialogue <motion.div> — Word-by-word fade-in
└── <NotebookInput /> — Enhanced journal aesthetic
    ├── Paper texture overlay (SVG noise filter)
    ├── Binding margin with holes
    ├── Typing glow effect
    └── Ink ripple animations
```

### Animation Timing
| Element | Duration | Easing | Notes |
|---------|----------|--------|-------|
| Auth state entrance | 0.8s | easeOutBack | Slide from y: -20 |
| Dialogue word fade | 0.35s | easeOut | 80ms stagger delay |
| Pig breathing | 6s | easeInOut | Infinite loop |
| Pig lean-in | 1.5s | easeInOut | When typing |
| Ambient glow | 3.5s | easeInOut | Slower for mystery |
| Shadow ripple | 4s | easeInOut | Beneath pig |
| Sound fade-in | 0.8s | — | Howler.js volume |
| Sound fade-out | 0.3s | — | Quick mute |

---

## 🚀 Deployment

**Commit:** `3df3793`  
**Branch:** `main`  
**Vercel:** https://leo-indol-theta.vercel.app  
**Local HTTPS:** https://localhost:3000

### Files Changed (5 total)
1. `src/components/scenes/Scene_Reflect.tsx` — Removed inline toggle, centered auth, enhanced pig
2. `src/components/atoms/SoundToggle.tsx` — Added safe-area padding
3. `src/components/atoms/AuthStateIndicator.tsx` — Centered design with glass morphism
4. `src/components/atoms/NotebookInput.tsx` — Journal aesthetic with binding holes
5. `src/lib/sound.ts` — Smooth volume fades

**Stats:** `114 insertions(+), 65 deletions(-)`

---

## 🧪 Testing Checklist

- [ ] Navigate from naming scene → reflect scene
  - [ ] Sound toggle stays top-right (no position jump)
  - [ ] Auth state appears centered with smooth animation
  - [ ] Pig size feels consistent (200px vs 240px is subtle)
- [ ] Reflect page interactions
  - [ ] Pig breathes gently when idle
  - [ ] Pig leans in when user starts typing
  - [ ] Dialogue fades in word-by-word on page load
  - [ ] Notebook shows binding holes and paper texture
  - [ ] Typography matches naming scene (DM Serif Text)
- [ ] Sound system
  - [ ] Toggle plays/stops ambient.mp3
  - [ ] Volume fades smoothly (800ms in, 300ms out)
  - [ ] No harsh cuts or audio pops
- [ ] Responsive design
  - [ ] Mobile: auth state doesn't overlap notch (safe-area-inset)
  - [ ] Tablet: pig stays centered
  - [ ] Desktop: notebook max-width 2xl looks balanced

---

## 🎯 Next Steps (Future Enhancements)

### Typing SFX
```typescript
// Add to NotebookInput.tsx handleChange
const playPenScratch = () => {
  const audio = new Audio('/audio/pen-scratch.mp3');
  audio.volume = 0.1;
  audio.playbackRate = 0.9 + Math.random() * 0.2; // Vary pitch
  audio.play();
};
```

### Heart-Exhale Submit Effect
```typescript
// In Scene_Reflect.tsx handleTextSubmit
const triggerHeartExhale = () => {
  setShowHeartAnimation(true);
  const puffs = generateHeartPuff(8); // 8 hearts instead of 12
  setHeartPuffs(puffs);
  setTimeout(() => setShowHeartAnimation(false), 2000);
};
```

### Responsive Pig Size
```typescript
// Scale pig based on viewport
const pigSize = typeof window !== 'undefined' 
  ? window.innerWidth < 768 ? 160 : 200
  : 200;
```

---

## 📝 Design Decisions

### Why centered auth state?
- Top-right felt disconnected, like generic app UI
- Center creates symmetry with pig above, notebook below
- Pill shape echoes the rounded notebook and sound toggle

### Why 200px pig (not 240px like naming)?
- Naming scene: pig is the hero (largest element)
- Reflect scene: notebook is the hero, pig is supportive presence
- 200px balances visibility without dominating the journal

### Why binding holes?
- Adds tangible, handcrafted feel (vs. generic digital box)
- Reinforces "personal journal" metaphor
- Visual callback to analog notebooks with wire/ring binding

### Why word-by-word fade?
- Creates "whispered thought" feeling
- Slows down reading pace for contemplation
- Prevents dialogue from feeling like a sudden info dump

---

## 🎨 Color Palette (Reflect Scene)

| Element | Color | Usage |
|---------|-------|-------|
| Dialogue text | `#9C1F5F` | Wine shade (darker than pink-800) |
| Notebook background | `#fdf5ed` | Warm cream (not pure white) |
| Notebook border | `pink-300/80` | Stronger than previous 70% |
| Binding holes | `pink-200/40` | Subtle, not distracting |
| Auth state bg | `white/40` | Glass morphism |
| Sound toggle bg | `white/50` active, `white/35` inactive | Consistent with auth |

---

## 🪶 Poetic Touches

1. **Feather icon** for sign-out — "letting go" metaphor
2. **Shadow ripple** beneath pig — grounds character in space
3. **Binding holes** — handcrafted journal aesthetic
4. **Serif typography** — timeless, contemplative
5. **Word-by-word reveal** — thoughts forming slowly
6. **Breathing gradient** — living, responsive environment
7. **Cheek glow on typing** — Leo reacts to your presence

---

**End of Redesign Doc**  
For questions or refinements, see: `docs/01-ux/` or Copilot instructions
