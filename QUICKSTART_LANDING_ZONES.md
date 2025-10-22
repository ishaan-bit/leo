# 🚀 Quick Start - Landing Zones Sandbox

## Step 1: Open the Demo

Dev server is already running! Navigate to:

**http://localhost:3000/sandbox/landing-zones**

## Step 2: Paste Your JSON

The sample enrichment JSON you provided is already pre-loaded:

```json
{
  "rid": "refl_1760945609962_tdf2x1l5r",
  "final": {
    "invoked": "['fatigue', 'irritation', 'low_progress']",
    "expressed": "[]",
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

## Step 3: Load Split Screen

Click **"Load Split Screen"** button

## Step 4: See the Magic ✨

You'll see two vertical panes:

**Top Pane (Zone A - Sadness)**:
- 🌊 Region: "The Lake of Quiet"
- 🧴 Oil: "Sandal + Rain"
- 💭 Caption: "Let light reach you." (lift subTone from fatigue)
- 🎵 Sound: wind/slow/density=1
- 🔮 Symbol: wave (rippling motion)

**Bottom Pane (Zone B - Anticipation)**:
- 🗻 Region: "The Windward Steps"
- 🧴 Oil: "Peppermint + Juniper"
- 💭 Caption: "Rise, gently." (alternative lift caption)
- 🎵 Sound: shimmer/steady/density=1
- 🔮 Symbol: spire (drifting motion)

## Step 5: Choose a Zone

- **Tap/Click** either pane
- See expansion animation
- Check browser console for telemetry:
  ```javascript
  [landing_zone_impression] { rid, primary, secondary, timestamp }
  [landing_zone_chosen] { chosen_zone, chosen_emotion, dwell_ms, ... }
  ```

## Step 6: Try Different Emotions

Edit the JSON and test all 8 emotions:

### High Arousal + Anger
```json
{
  "final": {
    "invoked": "['irritation', 'stress']",
    "wheel": { "primary": "anger", "secondary": "fear" },
    "arousal": 0.9,
    "confidence": 0.8
  }
}
```
**Result**: "Stand inside your strength." (steady subTone), ember+pulse, wood/steady/density=2

### Low Arousal + Anxiety
```json
{
  "final": {
    "invoked": "['anxiety', 'overwhelm']",
    "wheel": { "primary": "fear", "secondary": "trust" },
    "arousal": 0.2,
    "confidence": 0.4
  }
}
```
**Result**: "Perhaps… set the noise down." (soothe + confidence softener), veil+drift, wind/slow/density=0

### Joy + Anticipation
```json
{
  "final": {
    "invoked": "['excitement', 'anticipation']",
    "wheel": { "primary": "joy", "secondary": "anticipation" },
    "arousal": 0.75,
    "confidence": 0.9
  }
}
```
**Result**: "Face what calls you." (focus subTone), vine+pulse, pads/mid/density=2

## Debug Overlay (Bottom-Right)

Watch the debug overlay to see computed values:
- View state progression
- SubTones picked for each zone
- Sound layer/tempo/density modulation
- Symbol motion changes based on arousal

## Keyboard Navigation

- **Tab**: Move between top/bottom panes
- **Enter**: Select focused pane
- **Shift+Tab**: Reverse direction

## What to Look For

✅ **Mappings work**: Each emotion shows unique region/oil/palette
✅ **SubTone logic**: Captions match invoked/expressed patterns
✅ **Arousal modulation**: High arousal → density+1, pulse motion
✅ **Confidence softening**: <0.5 adds "Perhaps…" prefix
✅ **Alt captions**: Zone B gets alternative phrasing to avoid duplication
✅ **Animations**: Smooth 60fps transitions, symbol motion varies
✅ **Telemetry**: Console logs match spec types

## Next: Test Full Cycle

Try this enrichment for complete walkthrough:

```json
{
  "rid": "test_complete_cycle",
  "final": {
    "invoked": "['anxiety', 'fatigue', 'low_progress']",
    "expressed": "['tense']",
    "wheel": {
      "primary": "fear",
      "secondary": "sadness"
    },
    "valence": 0.2,
    "arousal": 0.9,
    "confidence": 0.75
  }
}
```

**Expected Behavior**:
1. SubTone: **soothe** (anxiety wins priority)
2. Zone A (Fear): "Set the noise down." with Pine+Frankincense, veil+pulse (high arousal)
3. Zone B (Sadness): "Hold the softer edge." with Sandal+Rain, wave+pulse
4. Both have wind layers with density=2 (arousal modulated from base 0 and 1)
5. Tapping either logs choice with correct dwell time

---

**🎉 That's it!** You now have a fully functional Landing Zones demo that implements the complete spec. Paste any enrichment JSON and see emotion-driven split-screens instantly.

**Branch**: `feature/landing-zones-sandbox`  
**No production impact**: Completely isolated in `/sandbox` route
