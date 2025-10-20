# 🌸 Landing Zones Sandbox

**Demo Page**: `/sandbox/landing-zones`  
**Branch**: `feature/landing-zones-sandbox`  
**Status**: ✅ Complete & Isolated

## What This Is

A **fully functional demo** of the "Emotional Landing Zones" split-screen page per the complete spec. Users paste enrichment JSON and see:
- Two vertical panes (Top = Zone A primary, Bottom = Zone B secondary)
- Emotion-driven region names, oil labels, palettes, symbols, captions
- Animated symbols (pulse/drift/ripple/sway/bloom)
- SubTone caption selection (soothe/steady/lift/focus)
- Arousal modulation of sound density + symbol motion
- Confidence-based caption softening
- Telemetry logging to console

## File Structure

```
apps/web/
├── app/sandbox/landing-zones/
│   └── page.tsx                    # Main demo page
├── src/
│   ├── content/
│   │   └── regions.ts              # Emotion→Region/Oil/Palette/Sound mappings
│   ├── lib/landing-zone/
│   │   └── rules.ts                # SubTone picker, caption builder, zone builder
│   └── components/atoms/
│       └── SymbolRenderer.tsx      # SVG symbols (orb/spire/vine/dune/wave/ember/veil/ray)
```

## How to Run

```powershell
cd c:\Users\Kafka\Documents\Leo\apps\web
npm run dev
```

Navigate to: **http://localhost:3000/sandbox/landing-zones**

## How to Use

1. **Paste JSON**: The demo loads with sample enrichment JSON pre-filled
2. **Click "Load Split Screen"**: Parses JSON and builds zones
3. **View split-screen**: Two panes with distinct emotions, regions, oils, captions
4. **Tap a pane**: Logs choice to console, animates expansion, shows alert with selection
5. **Check console**: See `landing_zone_impression` and `landing_zone_chosen` events

### Expected JSON Format

```json
{
  "rid": "refl_...",
  "final": {
    "invoked": "['fatigue', 'irritation', 'low_progress']",  // or array
    "expressed": "[]",                                        // or array  
    "wheel": {
      "primary": "sadness",
      "secondary": "anticipation"
    },
    "valence": 0.5,
    "arousal": 0.5,
    "confidence": 0.75
  }
}
```

**Note**: `invoked` and `expressed` can be Python-style stringified arrays (`"['anxiety']"`) or actual arrays. The parser handles both.

## Mappings Reference

### Regions
| Emotion | Region | Symbol |
|---------|--------|--------|
| joy | The Valley of Renewal | vine |
| sadness | The Lake of Quiet | wave |
| anger | The Ember Forge | ember |
| fear | The Veil of Pines | veil |
| disgust | The Salt Flats | dune |
| surprise | The Rayfields | ray |
| trust | The Hearthplain | orb |
| anticipation | The Windward Steps | spire |

### Oil Labels
| Emotion | Oil |
|---------|-----|
| joy | Citrus + Neroli |
| sadness | Sandal + Rain |
| anger | Cedar + Vetiver |
| fear | Pine + Frankincense |
| disgust | Sage + Salt |
| surprise | Ginger + Bergamot |
| trust | Rosemary + Lavender |
| anticipation | Peppermint + Juniper |

### SubTone Caption Rules

**Selection Priority**:
1. `invoked` contains `anxiety/stress/overwhelm` → **soothe**
2. `invoked` contains `fatigue/apathy` → **lift**
3. `expressed` contains `irritated/tense/angry` OR `invoked` contains `anger/irritation` → **steady**
4. `invoked` contains `anticipation/uncertain` → **focus**
5. Tie-break: `arousal > 0.5` → **steady**, else → **lift**

**Caption Templates**:
- **soothe**: "Set the noise down." / "Hold the softer edge."
- **steady**: "Stand inside your strength." / "Let the heat have shape."
- **lift**: "Let light reach you." / "Rise, gently."
- **focus**: "Face what calls you." / "Name the next step."

**Confidence <0.5**: Prepends "Perhaps…" (e.g., "Perhaps set the noise down.")

### Arousal Modulation

**High arousal (≥0.75)**:
- Sound density +1 (capped at 2)
- Symbol motion → `pulse`

**Low arousal (≤0.25)**:
- Sound density -1 (min 0)
- Symbol motion → `drift`

## State Machine

```
input → intro (0.8s) → idle → choosing (tap) → expanding (1.5s) → handoff
```

- **input**: JSON paste form
- **intro**: Fade-in transition
- **idle**: Two panes ready for selection
- **choosing**: Selected pane scales 1.02x, logs telemetry
- **expanding**: Selected pane fills screen, non-selected fades out
- **handoff**: Alert shows selection (in production, routes to next frame)

## Telemetry

Logged to **console** and **localStorage** only (no network):

### `landing_zone_impression`
```javascript
{
  rid: string,
  primary: EmotionKey,
  secondary: EmotionKey,
  timestamp: string (ISO)
}
```

### `landing_zone_chosen`
```javascript
{
  event: 'landing_zone_chosen',
  chosen_zone: "A" | "B",
  chosen_emotion: EmotionKey,
  dwell_ms: number,  // time from idle to tap
  timestamp: string (ISO)
}
```

## QA Checklist

- ✅ All 8 emotions render distinct regions/oils/palettes/symbols
- ✅ Captions follow subTone + confidence rules
- ✅ Arousal modulates sound density + symbol motion (visible in debug overlay)
- ✅ Keyboard navigation works (Tab + Enter)
- ✅ ARIA labels include full region name + emotion + oil
- ✅ 60fps animations on mid-tier devices
- ✅ Telemetry matches spec types
- ✅ Zero production side effects (isolated sandbox)

## Debug Overlay

Bottom-right corner shows:
- Current view state
- Zone A/B emotions + subTones
- Sound layer/tempo/density for both zones

## Accessibility

- **Keyboard**: Tab between panes, Enter to select
- **Screen reader**: Full ARIA labels announce choices
- **Reduced motion**: Disable via browser/OS settings (symbols still visible, animations dampened)
- **Focus states**: 4px white ring on keyboard focus

## Example Walkthrough

**Given enrichment**:
```json
{
  "final": {
    "invoked": "['anxiety', 'fatigue']",
    "wheel": { "primary": "fear", "secondary": "sadness" },
    "arousal": 0.9,
    "confidence": 0.45
  }
}
```

**Computed**:
- SubTone: **soothe** (anxiety present)
- **Zone A (Fear)**:
  - Region: "The Veil of Pines"
  - Oil: "Pine + Frankincense"
  - Caption: "Perhaps… set the noise down." (confidence < 0.5)
  - Sound: wind/slow/density=2 (arousal modulated +1)
  - Symbol: veil+pulse (arousal high)
- **Zone B (Sadness)**:
  - Region: "The Lake of Quiet"
  - Oil: "Sandal + Rain"
  - Caption: "Perhaps… hold the softer edge." (alt caption, confidence < 0.5)
  - Sound: wind/slow/density=1 (arousal modulated +1)
  - Symbol: wave+pulse (arousal high)

## Next Steps (Production Integration)

When ready to wire into real `/reflect` flow:

1. **Extract components**: Move `LandingZoneDemo.tsx` logic into reusable `<LandingZone>` component
2. **Add route**: `/region` or inline slot after interlude completes
3. **Persist choice**: Save `session.landingZone.chosen` to Supabase
4. **Network telemetry**: POST to `/api/choice` instead of console.log
5. **Haptics**: Wire to iOS/Android haptic APIs
6. **Audio**: Integrate with `AdaptiveAmbientSystem` using `zone.sound`
7. **Next frame**: Pass `chosen` object to Region Reveal/Kit component

## Known Limitations

- No actual audio playback (only sound design specs logged)
- No haptics (web limitation, shows as no-op)
- Alert dialog for handoff (in production, would route)
- No auth integration (sandbox is public)
- No network persistence (console + localStorage only)

## License

Part of Leo project. Internal use only.

---

**Last Updated**: October 20, 2025  
**Spec Version**: Complete Spec (Oct 20, 2025)  
**Branch**: `feature/landing-zones-sandbox`
