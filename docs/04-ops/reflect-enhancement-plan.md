# Scene_Reflect Enhancement Implementation Plan

## ✅ Completed
1. **Time-based dynamic backgrounds** - Created `time-theme.ts` with 8 time periods (dawn, morning, noon, afternoon, dusk, evening, night, lateNight)
2. **Time-aware microcopy** - Contextual greetings that change based on time of day

## 🚧 Implementation Stages

### Stage 1: Core Visual Enhancements (Priority 1)
- [ ] Integrate time-theme system into Scene_Reflect
- [ ] Add smooth gradient transitions between time periods
- [ ] Update particle system to use time-based colors
- [ ] Add ambient glow around pig that changes with time

### Stage 2: Pig Animation System (Priority 1)
- [ ] Idle breathing animation (gentle up/down)
- [ ] Periodic blinking
- [ ] Eyes follow cursor position
- [ ] Exhale animation on submit with heart puff particle
- [ ] Ear flutter during voice input

### Stage 3: Notebook Input Styling (Priority 1)
- [ ] Transform textbox to journal aesthetic
- [ ] Add paper texture background
- [ ] Stitched/torn edge effects
- [ ] Soft pink ink effect for text
- [ ] Typing glow that reacts to speed
- [ ] Pen cursor icon

### Stage 4: Sound System (Priority 2)
- [ ] Persistent ambient audio across pages
- [ ] Typing SFX (pencil scratch)
- [ ] Submit whoosh/exhale sound
- [ ] Sound toggle button (top-left)
- [ ] Volume fade transitions

### Stage 5: Auth State UI (Priority 2)
- [ ] "Signed in as [name]" / "Guest mode" indicator (top-right)
- [ ] Sign-out feather icon button
- [ ] Smooth fade out animation on sign-out

### Stage 6: Dynamic Feedback (Priority 3)
- [ ] Textbox glow intensity based on typing speed
- [ ] Ripple animation on submit
- [ ] Background dim during voice input
- [ ] Completion celebration animation

## File Structure

```
src/
├── lib/
│   ├── time-theme.ts ✅ (Created)
│   ├── audio/
│   │   └── AdaptiveAmbientSystem.ts (Exists, needs enhancement)
│   └── pig-animations.ts (To create)
├── components/
│   ├── atoms/
│   │   ├── NotebookInput.tsx (Needs styling)
│   │   ├── VoiceOrb.tsx (Exists)
│   │   ├── SoundToggle.tsx (Exists, needs positioning)
│   │   └── AuthStateIndicator.tsx (To create)
│   ├── molecules/
│   │   └── PinkPig.tsx (Needs animation enhancement)
│   └── scenes/
│       └── Scene_Reflect.tsx (Main integration)
```

## Technical Notes

### Time System
- Uses browser's local time (no server calls)
- Smooth gradient transitions every 30 seconds
- Particle count/speed adapts to time of day
- Greetings randomized per session

### Animation Performance
- Use `will-change` for animations
- RequestAnimationFrame for smooth 60fps
- Reduce motion respect (`prefers-reduced-motion`)
- Lazy load heavy animations

### Sound Management
- Keep ambient loop persistent across routes
- Use AudioContext (already in use)
- Fade in/out transitions (200ms)
- Mute button persists to localStorage

## Next Steps

1. **Review this plan** - Does this match your vision?
2. **Stage 1** - Integrate time-theme system (15 min)
3. **Stage 2** - Enhance pig animations (30 min)
4. **Stage 3** - Style notebook input (20 min)
5. **Stage 4** - Sound system (15 min)
6. **Stage 5** - Auth UI (10 min)
7. **Stage 6** - Dynamic feedback (20 min)

**Total estimated time: ~2 hours for complete implementation**

Would you like me to proceed with Stage 1, or would you prefer to review/adjust the plan first?
