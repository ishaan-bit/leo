# City Interlude Implementation Guide

## Overview
Complete implementation of **"THE CITY BEFORE THE SIGNAL"** - a 42-second ambient waiting experience that loops until Stage 1 enrichment completes.

## Architecture

### Component Hierarchy
```
Scene_Reflect.tsx
  └── CityInterlude.tsx  (NEW - replaces InterludeFlow.tsx)
       ├── AuthStateIndicator (top center)
       ├── SoundToggle (persistent)
       ├── Background gradient (phase-driven)
       ├── Stars (Beat 2+)
       ├── Ripples from Leo (Beat 2)
       ├── Dust motes (Beat 2+, physics change in Beat 4)
       ├── Leo character (center, breathing, ascending)
       ├── Six emotional towers (Phase 4)
       └── Copy display (phase-specific text)
```

## Timeline Breakdown

### Phase 1: The Holding (0-14s)
**Beat 1 (0-5s)**
- Copy: "Your moment has been held safe"
- Background: Warm blush (#FCE9EF) → petal pink (#F9D8E3)
- Leo: Center, gentle breathing (scale 0.99 ↔ 1.01)
- Minimal motion

**Beat 2 (5-14s)**
- Background: Cooling to mauve (#EACBE3 → #D7B3DB)
- Ripples: 3 expanding circles from Leo center
- Dust motes: 40 particles rising at 12px/s
- Stars: 30 stars fade in (opacity 0 → 0.05-0.1)

### Phase 2: The Breath Between Things (14-26s)
**Beat 3 (14-20s)**
- Copy: "A quiet breath between things"
- Background: Violet gradient (#D7B3DB → #C1A0E2)
- Leo: Inhale/exhale (scale 0.97 ↔ 1.03), slight rotation
- Particles: 60 motes, faster drift (18px/s)

**Beat 4 (20-26s)**
- Leo: Begins ascent (y: 0 → -30px over 6s)
- Motes: Pause mid-air briefly (gravity pause effect)
- Background: Held breath visual (no pulse for 1s)

### Phase 3: Time Holding Its Breath (26-34s)
**Beat 5 (26-32s)**
- Copy: "And time holding its breath"
- Background: Twilight (#C1A0E2 → #1A0F25)
- Leo: Rises to upper-third (y: -60px), scale 0.95
- Stars: Brighter (opacity 0.1 → 0.3)

### Phase 4: The Pulse of the City (34-42s → loop)
**Beat 6 (34-37s)**
- Six towers slide up (staggered 0.4s delays)
- Tower mapping:
  - **Vera** (Joyful) - Gold #FFD700, x: 15%, height: 180px
  - **Vanta** (Powerful) - Orange #FF6B35, x: 25%, height: 220px
  - **Haven** (Peaceful) - Blue #6A9FB5, x: 40%, height: 160px
  - **Ashmere** (Sad) - Gray #7D8597, x: 55%, height: 200px
  - **Vire** (Mad) - Red #C1121F, x: 70%, height: 190px
  - **Sable** (Scared) - Purple #5A189A, x: 85%, height: 170px
- Background: Midnight (#0C0818 → #1A0F25)

**Beat 7 (37-40s)**
- City breathing: Light wave travels across skyline (4s sine period)
- Window pulse: brightness 0.2 → 0.6 → 0.2 (synchronized per tower)
- Each tower offset by 0.4s for organic rhythm
- Leo's glow syncs with sine curve

**Beat 8 (40s+)**
- **Suspended breath / Ready state**
- City pulse continues indefinitely (4s sine wave)
- Shimmer rolls through sky every 10s
- **This loop persists until Stage 1 backend results arrive**

### When Stage 1 Completes
- Primary emotion identified (e.g., "Sad" → Ashmere tower)
- That tower stays bright (opacity 0.8), others dim (opacity 0.2)
- Wait for next pulse peak (2s)
- Call `onComplete(primaryEmotion)` to hand off to next scene

## Props Interface

```typescript
interface CityInterludeProps {
  reflectionId: string;     // For polling enrichment status
  pigName: string;          // Pig's name (for context)
  onComplete: (primaryEmotion: string) => void;  // Called when Stage 1 ready
  onTimeout?: () => void;   // Optional timeout handler
}
```

## Integration Points

### 1. Enrichment Polling
Uses `useEnrichmentStatus` hook:
```typescript
const { isReady, data: enrichmentData } = useEnrichmentStatus(reflectionId, {
  enabled: true,
  pollInterval: 3500,
  onTimeout: () => { if (onTimeout) onTimeout(); }
});
```

When `isReady && enrichmentData?.wheel?.primary`:
- Extract primary emotion
- Highlight corresponding tower
- Wait 2s, then call `onComplete(primaryEmotion)`

### 2. Scene_Reflect Integration
```typescript
// Updated callback signature
const handleInterludeComplete = (primaryEmotion: string) => {
  console.log('Primary emotion:', primaryEmotion);
  // TODO: Navigate to progression view with emotion context
};

// Render CityInterlude instead of InterludeFlow
if (showInterlude && currentReflectionId) {
  return (
    <CityInterlude
      reflectionId={currentReflectionId}
      pigName={pigName}
      onComplete={handleInterludeComplete}
      onTimeout={handleInterludeTimeout}
    />
  );
}
```

## Mobile Responsiveness

### Layout Adjustments
- **Auth indicator**: `pt-4 px-4` on mobile, `pt-6 px-6` on desktop
- **Leo size**: `w-32 h-32` on mobile, `w-40 h-40` on desktop
- **Copy text**: `text-xl` on mobile, `text-2xl` on tablet, `text-3xl` on desktop
- **Tower width**: Fixed 60px (scales with viewport)
- **Progress dots**: `w-1.5 h-1.5` on mobile, `w-2 h-2` on desktop

### Touch Optimization
- All interactive elements (auth, sound) have `min-height: 44px` for touch
- Backdrop blur on auth indicator for legibility
- Vignette less aggressive on small screens (opacity 0.04 vs 0.08)

## Accessibility

### Reduced Motion
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

When enabled:
- No ripples, particles, or city pulse
- Static background gradients (no breathing)
- Leo still breathing but slower
- Towers fade in without stagger

### Screen Readers
- Progress indicator: `role="status" aria-live="polite" aria-label="Processing your reflection"`
- All phase transitions logged to console for debugging
- Copy text remains visible throughout (not decorative)

## Audio Integration (TODO)

### Recommended Implementation
```typescript
// In CityInterlude.tsx
const audioSystem = getAdaptiveAmbientSystem();

useEffect(() => {
  // Phase 1: Heartbeat pad (56 bpm)
  if (currentPhase === 1) {
    audioSystem.playLayer('heartbeat', { volume: 0.3 });
  }
  
  // Phase 2: Add wind bells
  if (currentPhase === 2) {
    audioSystem.playLayer('wind_bells', { volume: 0.2 });
  }
  
  // Phase 4: City hum + deep pulse
  if (currentPhase === 4) {
    audioSystem.playLayer('city_hum', { volume: 0.4 });
    audioSystem.playLayer('deep_pulse', { period: 4000 }); // 4s sync with visual
  }
}, [currentPhase]);
```

### Audio Files Needed
- `heartbeat_56bpm.mp3` - Soft pad, 5s loop
- `wind_bells_ambient.mp3` - Faint chimes, 10s loop
- `city_hum_night.mp3` - Low-end drone, 30s loop
- `deep_pulse.mp3` - 4s period bass pulse

## Performance Optimization

### Particle System
- Limit particles: 40 in Phase 1, 60 in Phase 2+
- Use `will-change: transform` on Leo and towers
- `pointer-events-none` on all decorative layers
- Particles render with CSS transforms (GPU accelerated)

### City Pulse
- Uses `requestAnimationFrame` for 60fps sine wave
- Cleanup on unmount:
  ```typescript
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  ```

### Memory Management
- All timers cleared on unmount
- Enrichment polling stops when component unmounts
- No memory leaks from animation loops

## Testing Checklist

- [ ] Phase transitions occur at correct timestamps (0s, 5s, 14s, 20s, 26s, 34s, 37s, 40s)
- [ ] Copy fades in/out smoothly with correct timing
- [ ] Leo breathes and ascends correctly through phases
- [ ] Dust motes pause in Beat 4 (gravity pause)
- [ ] Six towers slide up with 0.4s stagger in Beat 6
- [ ] City pulse loops correctly at 4s period in Beat 7-8
- [ ] Primary emotion tower stays bright when Stage 1 completes
- [ ] `onComplete(primaryEmotion)` called with correct emotion string
- [ ] Auth indicator and sound toggle remain visible and functional
- [ ] Mobile layout adjusts correctly (portrait and landscape)
- [ ] Reduced motion disables animations properly
- [ ] Screen reader announces "Processing your reflection"

## Next Steps

### Immediate (Before Deploy)
1. **Replace Leo placeholder** with actual `<PinkPig>` component
   - Import from `../molecules/PinkPig`
   - Pass `state` prop based on phase
   - Size: `size={160}` on mobile, `size={200}` on desktop

2. **Test enrichment polling** with real backend
   - Verify `useEnrichmentStatus` returns `wheel.primary`
   - Ensure tower highlighting works with all 6 emotions
   - Test timeout behavior (90s soft, 150s hard)

3. **Add audio layers** (optional for v1)
   - Integrate with `AdaptiveAmbientSystem`
   - Ensure sound toggle mutes all audio
   - Test audio fade-in/out on phase transitions

### Future Enhancements
- **Particle depth layers**: 3 parallax layers for more depth
- **Tower glow interaction**: Subtle hover effects on towers
- **Constellation patterns**: Stars connect into emotional shapes
- **Leo micro-animations**: Ear twitches, tail wag in idle state
- **City detail pass**: Rooftop details, antenna lights, fog layers

## Files Modified

### New Files
- `apps/web/src/components/organisms/CityInterlude.tsx` (NEW)

### Modified Files
- `apps/web/src/components/scenes/Scene_Reflect.tsx`
  - Import: `CityInterlude` instead of `InterludeFlow`
  - Callback: `handleInterludeComplete(primaryEmotion: string)`
  - Render: `<CityInterlude>` with updated props

### Deprecated Files
- `apps/web/src/components/organisms/InterludeFlow.tsx` (can be deleted)
- `apps/web/src/components/organisms/InterludeVisuals.tsx` (can be deleted)

## Emotion → Tower Mapping Reference

| Willcox Primary | Tower Name | Color | Position | Height |
|----------------|------------|-------|----------|--------|
| Joyful | Vera | #FFD700 (gold) | 15% | 180px |
| Powerful | Vanta | #FF6B35 (orange) | 25% | 220px |
| Peaceful | Haven | #6A9FB5 (blue) | 40% | 160px |
| Sad | Ashmere | #7D8597 (gray) | 55% | 200px |
| Mad | Vire | #C1121F (red) | 70% | 190px |
| Scared | Sable | #5A189A (purple) | 85% | 170px |

## Color Palette Reference

### Phase 1 (Warm Blush)
- Start: `#FCE9EF`
- End: `#F9D8E3`
- Copy: `#7D2054` (wine)

### Phase 2 (Mauve Transition)
- Start: `#EACBE3`
- Mid: `#D7B3DB`
- End: `#C1A0E2`
- Copy: `#7D2054`

### Phase 3 (Twilight)
- Start: `#C1A0E2`
- End: `#1A0F25`
- Copy: `#E8D5F2` (light lavender)

### Phase 4 (Midnight)
- Start: `#0C0818`
- End: `#1A0F25`
- Window glow: `rgba(248, 216, 181, 0.3-0.6)` (warm white)
- Copy: `#E8D5F2`

---

**Status**: ✅ Implementation complete, ready for integration testing
**Owner**: Frontend team
**Priority**: High (blocking progression flow)
**Estimated integration time**: 1-2 hours (mostly testing + audio)
