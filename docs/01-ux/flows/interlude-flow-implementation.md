# 🌸 Interlude Flow Implementation

**Created**: October 20, 2025  
**Status**: ✅ Complete

---

## Overview

The **Interlude Flow** creates a calm, intentional waiting experience while enrichment processes in the background. It follows the "Held Safe → Interlude → Ready" progression with cinematic visuals, poetic copy, and graceful timeout handling.

---

## Architecture

### Components

1. **`InterludeFlow.tsx`** - State machine orchestrator
   - Manages held_safe → interlude_active → complete_transition → progress_ready
   - Polls enrichment status via `useEnrichmentStatus` hook
   - Handles timing constraints (minimum 8s dwell, 90s soft timeout, 150s hard timeout)
   - Rotates copy every 10s
   - Shows skip button after 12s
   - Tracks telemetry (duration, skips, timeouts)

2. **`InterludeVisuals.tsx`** - Option 3 cinematic aesthetic
   - Sparkles drift upward and dissolve (12 particles with staggered appearance)
   - Gradient shift: pink → lavender over 12s (repeating)
   - Pig breathing pulse: 3s cycle with soft glow
   - Complete transition: focus ring animation
   - Atmospheric shimmer particles (30 subtle background dots)
   - Respects `prefers-reduced-motion`: disables drift, uses opacity/blur only

3. **`useEnrichmentStatus.ts`** - Enrichment polling hook
   - Polls `/api/reflect/[rid]` every 3.5s (±500ms jitter)
   - Checks for `final` field (enrichment complete)
   - Exponential backoff on errors (8-12s, up to 3x)
   - Tracks elapsed time
   - Triggers timeout callback at hard limit (150s)

4. **`/api/reflect/[rid]/route.ts`** - Single reflection fetch endpoint
   - GET endpoint to fetch reflection by ID
   - Used by interlude polling
   - Returns full reflection object (including enriched fields if present)

### Integration with Scene_Reflect

```typescript
// After saving reflection, get reflection ID
const reflectionId = await saveReflection({...});

// Start interlude flow
if (reflectionId) {
  setCurrentReflectionId(reflectionId);
  setTimeout(() => {
    setShowInterlude(true);
  }, 1500); // Small delay for heart animation
}

// Render interlude as full-screen overlay
if (showInterlude && currentReflectionId) {
  return (
    <InterludeFlow
      reflectionId={currentReflectionId}
      pigName={pigName}
      onComplete={handleInterludeComplete}
      onTimeout={handleInterludeTimeout}
      onSkip={handleInterludeSkip}
    />
  );
}
```

---

## State Machine

### Phase 1: held_safe (2.5s)
**Purpose**: Instant reassurance that data is saved

**UI**:
- Pig with static soft glow
- Copy: "{PigName} glows softly." + "Your moment has been held safe."
- Pink gradient background

**Timing**: Fixed 2.5s duration

**Exit**: Automatic transition to interlude_active

---

### Phase 2: interlude_active (variable)
**Purpose**: Cinematic waiting room with living, breathing atmosphere

**UI**:
- Sparkles drift upward → dissolve (single pass)
- Gradient shifts: pink → lavender (looping over 12s)
- Pig breathes: 3s pulse cycle with glow
- Copy rotates every 10s from pool:
  - "Drifting through your thoughts…"
  - "Letting your moment settle…"
  - "A quiet breath between things."
  - "Staying with the gentle part."
  - "We'll be ready soon."
- Atmospheric shimmer particles (30 subtle dots)
- Progress dots at bottom (pulsing)

**Timing**:
- **Minimum dwell**: 8s total (from submission start)
- **Soft timeout**: 90s → show reassurance copy
- **Hard timeout**: 150s → offer background completion
- **Absolute cap**: 3 minutes max

**Exit Conditions**:
- Enrichment ready + minimum dwell met → complete_transition
- User clicks "Skip interlude" → skip handler
- Hard timeout → timeout handler

---

### Phase 3: complete_transition (2s)
**Purpose**: Acknowledge enrichment is ready with soft celebratory flourish

**UI**:
- Sparkles clear
- Pig glow brightens once
- Soft focus ring expands around pig
- Copy: "Your moment is ready." or "Let's see what surfaced."

**Timing**: Fixed 2s duration

**Exit**: Automatic to progress_ready → onComplete callback

---

### Phase 4: progress_ready
**Purpose**: Flow complete, trigger navigation to progression view

**Action**: Calls `onComplete()` callback

---

## Copy Pools

### Held Safe
```typescript
"{PigName} glows softly."
"Your moment has been held safe."
```

### Interlude (rotates every 10s)
```typescript
"Drifting through your thoughts…"
"Letting your moment settle…"
"A quiet breath between things."
"Staying with the gentle part."
"We'll be ready soon."
```

### Reassurance (soft timeout at 90s)
```typescript
"Taking a moment longer than usual…"
"Almost there, staying with it…"
"A little more time to reflect…"
```

### Complete
```typescript
"Your moment is ready."
"Let's see what surfaced."
```

### Timeout (hard timeout at 150s)
```typescript
"We'll finish in the background."
"You can return later."
```

---

## Timing Rules

| Event | Duration | Trigger |
|-------|----------|---------|
| Held Safe | 2.5s | Fixed |
| Interlude (minimum) | 8s total | From submission |
| Copy rotation | Every 10s | While in interlude |
| Skip button appears | After 12s | Cumulative from submission |
| Soft timeout | 90s | Show reassurance |
| Hard timeout | 150s | Offer background completion |
| Absolute cap | 3 minutes | Force exit |
| Complete transition | 2s | Fixed |

### Minimum Dwell Enforcement
Even if enrichment finishes "instantly" (e.g., < 1s), the interlude will still run for at least 8s total. This prevents jarring jumps and maintains the ritual feel.

```typescript
// Wait for minimum dwell if not met yet
if (!minimumDwellMetRef.current) {
  const remainingTime = TIMING.MINIMUM_TOTAL_DWELL - (Date.now() - startTimeRef.current);
  if (remainingTime > 0) {
    setTimeout(() => {
      transitionToComplete();
    }, remainingTime);
    return;
  }
}
```

---

## Enrichment Polling

### Strategy
- **Base interval**: 3.5s (3500ms)
- **Jitter**: ±500ms to avoid thundering herd
- **Exponential backoff on errors**: 8-12s, up to 3x multiplier
- **Checks for**: `final` field in reflection object
- **Returns**: `isReady`, `isLoading`, `error`, `elapsedTime`, `reflection`

### Error Handling
1. **Network error**: Backoff to 8-12s, retry with exponential increase
2. **404 Not Found**: Continue polling (reflection may not be saved yet)
3. **500 Server Error**: Backoff and retry
4. **Hard timeout (150s)**: Stop polling, call `onTimeout` callback

### Example Hook Usage
```typescript
const { isReady, isLoading, error, elapsedTime } = useEnrichmentStatus(
  reflectionId,
  {
    enabled: phase === 'interlude_active',
    pollInterval: 3500,
    onTimeout: handleTimeout,
  }
);
```

---

## Accessibility

### Reduced Motion
**Detected via**: `window.matchMedia('(prefers-reduced-motion: reduce)').matches`

**Effects**:
- Sparkles: Fade in/out only (no upward drift)
- Pig: No scale animation (glow only)
- Gradient: Opacity transitions only (no hue shift)
- Shimmer particles: Opacity pulse only (no movement)
- **Timing unchanged** - ritual remains consistent

### Reduced Transparency
Not currently implemented, but can be added:
```typescript
const prefersReducedTransparency = window.matchMedia('(prefers-reduced-transparency: reduce)').matches;
// Use solid backgrounds instead of backdrop-blur
```

### Keyboard & Screen Reader
- **Skip button**: Focusable, labeled `aria-label="Skip interlude"`
- **Progress indicator**: `role="status"` with `aria-live="polite"` and `aria-label="Processing your reflection"`
- All sensory cues have text alternatives

---

## Telemetry

### Events Tracked
```typescript
// Interlude started
logTelemetry('interlude_started', {
  reflectionId,
  timestamp,
  reduceMotion: boolean,
});

// Interlude completed
logTelemetry('interlude_completed', {
  reflectionId,
  duration: number, // Total time in ms
  enrichmentTime: number, // Backend enrichment time
  skipped: false,
});

// Interlude skipped
logTelemetry('interlude_skipped', {
  reflectionId,
  duration: number,
  enrichmentTime: number,
});

// Interlude timeout
logTelemetry('interlude_timeout', {
  reflectionId,
  duration: 150000,
});
```

### Metrics to Monitor
- **Median enrichment time**: p50 duration from submission to ready
- **p95 enrichment time**: Track slow enrichments
- **Skip rate**: % of users clicking "Skip interlude"
- **Timeout rate**: % of enrichments exceeding 150s
- **Average interlude dwell**: How long users actually wait
- **Reduce-motion usage**: % of users with accessibility setting

---

## Visual Specs

### Sparkles
- **Count**: 12
- **Size**: 2-6px (randomized)
- **Start position**: 20-80% height, random x
- **Animation**: Drift up 150px over 3-5s, fade in/out
- **Stagger**: 0.15s delay between each
- **Color**: `bg-pink-300/60` with `backdrop-blur-sm`

### Gradient Shift
- **Start**: `from-pink-50 to-rose-100`
- **Mid**: `from-purple-50 to-violet-100`
- **End**: `from-purple-100 to-violet-200`
- **Duration**: 12s loop, easeInOut
- **Breathing overlay**: Radial gradient pulses over 8s

### Pig Breathing
- **Scale**: 1 → 1.05 → 1 (5% amplitude)
- **Glow**: `drop-shadow(0 0 20px rgba(251, 207, 232, 0.4))` → `40px 0.6` → back
- **Duration**: 3s loop, easeInOut

### Focus Ring (Complete)
- **Size**: 80px × 80px (320px diameter)
- **Opacity**: 0 → 0.4 → 0
- **Scale**: 0.8 → 1.3 → 1.5
- **Duration**: 2s, easeOut
- **Border**: 4px solid `border-pink-300/40`
- **Shadow**: `0 0 60px rgba(251, 207, 232, 0.6)`

---

## Failure Modes & Fallbacks

### Ultra-Fast Enrichment (<1s)
**Behavior**: Still show Held Safe (2.5s) + Interlude (minimum 5.5s more) = 8s total
**Reason**: Maintain ritual, avoid feeling "instant" (breaks immersion)

### Slow Enrichment (90-150s)
**Behavior**: Show reassurance copy at 90s: "Taking a moment longer than usual…"
**Reason**: Acknowledge the wait without causing anxiety

### Hard Timeout (150s+)
**Behavior**: Show "We'll finish in the background" → allow user to continue
**Reason**: Don't block the user indefinitely; enrichment continues async

### Backend Failure
**Behavior**: Treat as timeout at 150s, offer background completion
**Reason**: Graceful degradation; user can still proceed

### User Navigates Away
**Behavior**: Enrichment continues; on return, jump straight to result if ready
**Reason**: Non-blocking, respectful of agency

---

## Integration Checklist

- [x] `InterludeFlow` component with state machine
- [x] `InterludeVisuals` with Option 3 aesthetic
- [x] `useEnrichmentStatus` polling hook
- [x] `/api/reflect/[rid]` GET endpoint
- [x] Scene_Reflect integration (replaces old showCompletion)
- [x] Timing constraints (8s min, 150s hard timeout)
- [x] Copy rotation system (10s intervals)
- [x] Skip button (appears after 12s)
- [x] Telemetry tracking
- [x] Accessibility (reduce-motion, keyboard, screen reader)

---

## Future Enhancements

### Optional Sensory Modules (from spec)
- **Aroma diffuser** (BLE): Micro-pulse every 30-45s during interlude
- **Audio bed**: Ultra-low volume ambient hum, fade in over 2s
- **Completion chime**: ≤300ms soft tone (no melodic leaps)

### Adaptive Copy
Once enrichment signals are reliable, rotate copy based on detected emotion/arousal:
- High arousal: "Taking a breath with you…"
- Low mood: "Staying gentle with this moment…"
- Risk signals: Immediate transition, no interlude (safety first)

### Progress Feedback
Show approximate time remaining after soft timeout:
- "Usually takes about a minute…"
- "Almost there, just a few more seconds…"

---

## Technical Notes

### Why Not WebSockets?
- **Simplicity**: Polling is easier to implement and debug
- **Vercel serverless**: WebSockets require persistent connections (not ideal for serverless)
- **Acceptable latency**: 3-4s poll interval is fine for 30-60s enrichment times

### Why Minimum 8s Dwell?
- Prevents jarring instant transitions (breaks immersion)
- Allows sparkles/glow animation to complete
- Gives user time to breathe and reset
- Reinforces that enrichment is thoughtful, not mechanical

### Why Hard Timeout at 150s?
- Intel Core Ultra 7 CPU mode: median 20-40s, p95 ~60s
- 150s is 2.5 minutes: enough time for 99% of enrichments
- Avoids blocking user indefinitely
- Aligns with spec: "cap interlude at 3 minutes absolute"

---

## Summary

The Interlude Flow creates a **calm, intentional waiting experience** that:
- ✅ Reassures safety immediately (Held Safe)
- ✅ Transforms waiting into a ritual (cinematic visuals, poetic copy)
- ✅ Respects accessibility (reduce-motion, keyboard, screen reader)
- ✅ Handles failures gracefully (timeouts, errors, skips)
- ✅ Tracks telemetry for optimization
- ✅ Maintains emotional continuity (never breaks immersion)

**Emotional contract**: "We're holding your moment with care, and you can trust us to be ready when you are."

🌸 **Live the pause, don't just endure it.**
