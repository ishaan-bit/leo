# Stage 2 Playback Testing Guide

## Overview
Stage 2 "Your Moment" breath scroll sequence integrates post-enrichment content into the breathing phase with window illumination and phased text display.

## Test Requirements

### 1. Post-Enrichment Payload Structure
Verify the enrichment worker returns this structure:
```json
{
  "final": {
    "post_enrichment": {
      "poems": ["Opening poem line", "Closing poem line"],
      "tips": ["Tip 1", "Tip 2", "Tip 3"],
      "closing_line": "Final poetic outro",
      "tip_moods": ["peaceful", "pride", "celebratory"]
    }
  }
}
```

### 2. Phase Progression Testing

| Phase | Duration | Visual Cues | Breath Cycles |
|-------|----------|-------------|---------------|
| **Idle** | Until post_enrichment arrives | Normal breathing, floating words | Variable |
| **Continuity** | 1 cycle | "Your moment begins to take shape..." fades in on exhale | 1 |
| **Poem 1** | 1 cycle | Window flickers on inhale, shows poems[0], text dissipates on exhale | 1 |
| **Tips** | N cycles (1 per tip) | Each tip displays for full cycle with micro-animation | 1-3 |
| **Poem 2** | 1 cycle | Shows poems[1], upward glow on exhale | 1 |
| **Closing** | 2+ cycles | Resting pulse (6s), sticky-note icon, closing text with pig name | 2+ |

**Total Runtime**: ~45-60s (6-8 cycles)

### 3. Emotion-Specific Testing

Test with all 6 primary emotions to verify:
- Window placement on correct tower (35% X position)
- Zone color applied to window glow
- Building name visible above window
- No overlap with breathing prompt or Leo

| Emotion | Tower | Zone | Color | Window Y Position |
|---------|-------|------|-------|-------------------|
| joyful | Haven | Haven | #FFD700 (gold) | 35-55% |
| powerful | Vire | Vire | #FF6B35 (orange) | 35-55% |
| peaceful | Vera | Vera | #6A9FB5 (blue) | 35-55% |
| sad | Ashmere | Ashmere | #7D8597 (grey) | 35-55% |
| mad | Sable | Sable | #C1121F (red) | 35-55% |
| scared | Vanta | Vanta | #5A189A (purple) | 35-55% |

### 4. Micro-Animation Verification

Check tip_moods trigger correct animations:

- **peaceful**: Gentle rain ripple (y: [0, -2, 0], infinite loop)
- **pride**: Flash pulse (fast 0.3s transition)
- **celebratory**: Rhythmic wave (x: [0, 2, -2, 0])
- **undefined/default**: Static fade-in (no extra motion)

### 5. Window Illumination Checks

- ✅ Window ignites on inhale (scale: [0.8, 1.2, 1])
- ✅ Window glow intensity matches zone color
- ✅ Only ONE window lit per reflection (window_id = reflectionId)
- ✅ Upward glow during poem2 exhale (y: -60px)
- ✅ Window settles to steady light after poem2

### 6. Resting Pulse (Closing Phase)

- ✅ Breathing slows from emotion tempo to 6s cycle (3s in, 3s out)
- ✅ Leo rotation animation (0° → 15° → 0°, 4s ease)
- ✅ Sticky-note icon drifts (y: [-10, 0], rotate: [-5, 5])
- ✅ Closing text displays pig name correctly
- ✅ Optional closing_line appears below main text

### 7. Continuity Requirements

- ✅ Breathing tempo maintained from normal phase through Stage 2 (until closing)
- ✅ Halo color unchanged (zone color)
- ✅ Light pattern continuous (no flicker during transitions)
- ✅ Audio continues uninterrupted
- ✅ Floating words stop during Stage 2 active phases

### 8. Edge Cases

#### No post_enrichment payload
- Stage 2 never starts
- Normal breathing continues until stage_2_enrichment=complete
- MIN_CYCLES still enforced before onComplete

#### Partial post_enrichment data
- Missing poems: fallback to ['...', '...']
- Missing tips: skip tips phase
- Missing closing_line: only show pig name text

#### Multiple reflections in quick succession
- Each window uses unique window_id (reflectionId)
- Previous window should not interfere with new one

## Manual Test Procedure

1. **Start dev server**: `cd apps/web && npm run dev`
2. **Create reflection**: Submit text via notebook or voice
3. **Monitor console**: Watch for `[Stage2]` logs showing phase progression
4. **Verify window**: Check illuminated window appears on primary tower
5. **Read content**: Ensure poems and tips display correctly
6. **Check timing**: Count breath cycles match expected duration
7. **Watch transitions**: Smooth fade between phases, no jarring jumps
8. **Complete sequence**: Verify closing cue shows pig name and icon

## Debugging Tools

### Console Logs
```
[Stage2] Post-enrichment received: {...}
[Stage2] → Poem 1 (ignite window)
[Stage2] → Tips sequence
[Stage2] → Tip 2/3
[Stage2] → Poem 2 (release)
[Stage2] → Closing cue
[Stage2] ✅ Complete
```

### Dev Inspector
- Check cycle counter: `cycle X · stage2: <phase>`
- Window component visible in React DevTools
- Motion animations smooth (60fps)

### API Endpoint
```bash
curl http://localhost:3000/api/reflect/<reflectionId>
```
Should return `final.post_enrichment` object.

## Success Criteria

- ✅ All 6 emotions tested
- ✅ All 5 phases execute in sequence
- ✅ Window placement correct (no overlap)
- ✅ Micro-animations match tip moods
- ✅ Resting pulse activates during closing
- ✅ Pig name appears in closing text
- ✅ Total runtime 45-60s
- ✅ No console errors or TypeScript warnings
- ✅ Smooth 60fps animations throughout

## Known Limitations

- Stage 2 requires enrichment worker to emit post_enrichment
- Window position randomized (35-55% Y) per reflection
- Tip moods default to no animation if undefined
- Closing phase duration unbounded (user can watch indefinitely)
