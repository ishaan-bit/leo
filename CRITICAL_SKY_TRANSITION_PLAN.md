# CRITICAL Sky Transition Rewrite Plan

## Current Problem
- Sky jumps between gradients across transitions
- BreathingSequence has its own sky gradient system
- DialogueInterlude has discrete sky (black)
- Flickering and discrete cuts destroy immersion

## User Requirement (EXACT)
1. **CityInterlude Phase 4**: Pulsing buildings + Ghibli sky appears
2. **Primary Detection**: Everything stays same, non-primary buildings fade, primary centers, **Ghibli sky/hues remain**
3. **Breathing Begins**: Sky/hues/Ghibli effects **remain as is**, pig breathes with halo pulse
4. **Inhale/Exhale cycles**: Ghibli sky with **same hues stay**
5. **Dialogue 3 Tuples**: Start making sky darker **smoothly through the 3 tuples** (not discrete cuts), by end of tuple 3 sky is dark
6. **Pig keeps pulsing** then transition to Living City

## Solution Architecture

### CityInterlude Final State (Phase 4)
```css
background: linear-gradient(180deg, #3A2952 0%, #6B5B95 100%)
```
This is the **BASE GHIBLI SKY** that must persist.

### BreathingSequence
- **REMOVE all sky gradient changes**
- **LOCK to CityInterlude Phase 4 gradient**: `#3A2952 → #6B5B95`
- **Add subtle halo pulse** based on primary color (no sky change)
- Breathing animation affects ONLY pig scale, NOT sky
- Buildings fade/center with sky **unchanged**

### DialogueInterlude  
- **START with same gradient**: `#3A2952 → #6B5B95`
- **Track tuple progress**: 0→1→2→3
- **Smoothly lerp sky gradient** through tuples:
  - Tuple 0 (start): `#3A2952 → #6B5B95` (Ghibli sky)
  - Tuple 1 midpoint: `#2A2047 → #5B5A85` (slightly darker)
  - Tuple 2 midpoint: `#1A1734 → #3B3367` (darker)
  - Tuple 3 end: `#0A0714 → #1A1530` (deep night)
- **Use smooth easing**, NO discrete jumps
- **Pig continues pulsing** with breathing animation throughout

## Implementation Steps

### 1. BreathingSequence.tsx
- Remove `skyLightnessLevel` state entirely
- Remove `getSkyGradient()` function
- Lock background div to: `background: 'linear-gradient(180deg, #3A2952 0%, #6B5B95 100%)'`
- Add subtle radial halo pulse based on primary color (overlay, not background change)

### 2. DialogueInterlude.tsx
- Add `skyDarkenProgress` state (0 to 1, tracks across all 3 tuples)
- Create `getSkyGradient(progress)` that lerps from Ghibli (#3A2952/#6B5B95) to night (#0A0714/#1A1530)
- Update `skyDarkenProgress` smoothly based on: (currentTupleIndex + phase progress) / 3
- Apply gradient to background div with smooth transition

### 3. Testing Sequence
1. CityInterlude → Check phase 4 shows #3A2952/#6B5B95
2. → BreathingSequence → Verify SAME gradient (no flicker)
3. → DialogueInterlude → Verify starts with SAME gradient
4. → Progress through tuples → Verify SMOOTH darkening (no jumps)
5. → Living City transition → Final dark sky state

## Key Anti-Patterns to AVOID
❌ Discrete sky color switches
❌ Separate gradient systems per component
❌ Sky changes on breathing cycles
❌ Flickering on component transitions
❌ Jumping between violet and black

## Success Criteria
✅ ONE continuous sky gradient system
✅ Ghibli sky (#3A2952/#6B5B95) maintained from City → Breathing → Dialogue start
✅ Smooth darkening ONLY during dialogue tuples (not before)
✅ NO flickers, NO discrete cuts
✅ Pig breathing pulse adds halo, NOT sky changes
