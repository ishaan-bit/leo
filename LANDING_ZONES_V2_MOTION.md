# Landing Zones v2: Living Atmospheres

**Complete Motion & Animation Variable Reference**

## 🎨 Design Philosophy

Landing Zones v2 transforms the static split-screen into a **breathing, living emotional atmosphere** that feels like a natural extension of the interlude experience. Each zone pulses independently, with motion intensity directly derived from arousal and valence values.

---

## ⚙️ Core Motion Variables

### Pulse Formula
```typescript
pulseStrength = 0.4 + (arousal * 0.6)
warmth = 0.5 + (valence * 0.5)
```

**Range Mapping:**
- `arousal: 0..1` → affects animation intensity, gradient speed, particle density
- `valence: -1..1` → affects color warmth (cool to warm), hue shift direction
- `pulseStrength: 0.4..1.0` → breathing depth multiplier
- `warmth: 0..1` → temperature bias (0=cool, 1=warm)

### Breathing Cycle
- **Duration:** 8 seconds (8000ms)
- **Wave:** Smooth sine wave (normalized 0..1)
- **Spring Physics:** Stiffness 50, Damping 20 (opacity); Stiffness 40, Damping 25 (scale)

---

## 📊 Animation Property Ranges

### Opacity
```
Min: 0.7
Max: 0.95
Modulation: smooth sine wave * pulseStrength
```

### Scale
```
Min: 0.98
Max: 1.02
Modulation: smooth sine wave * pulseStrength
```

### Hue Shift
```
Range: ±15 degrees
Direction: Based on warmth (valence)
  Positive valence → warmer hues (+)
  Negative valence → cooler hues (-)
```

### Gradient Drift Speed
```
Base: 20 seconds
Arousal Modulation: 20 - (arousal * 8)
  → Range: 12s (high arousal) to 20s (low arousal)
```

### Hover Amplification
```
Opacity: * 1.1 (capped at 1.0)
Scale: * 1.02
pulseStrength: * 1.2 (capped at 1.0)
```

---

## 🌊 Ambient Elements Motion

Each emotion has a unique environmental overlay with specific motion patterns:

| Emotion       | Element           | Motion Type      | Duration    | Opacity         |
|---------------|-------------------|------------------|-------------|-----------------|
| joy           | Pollen drift      | Vertical wave    | 8s + offset | 0.3-0.6 * pulse |
| sadness       | Mist layer        | Rise/fall        | 20s         | 0.2-0.4 * pulse |
| anger         | Ember sparks      | Upward fade      | 4s + offset | 0.8 * pulse → 0 |
| fear          | Leaf fall         | Spiral descent   | 12s + offset| 0-0.5 * pulse   |
| disgust       | Dust motes        | Circular swirl   | 10s + offset| 0.2-0.4 * pulse |
| surprise      | Light refractions | Horizontal sweep | 6s + offset | 0-0.8 * pulse   |
| trust         | Candle smoke      | Vertical drift   | 15s + offset| 0.4 * pulse → 0 |
| anticipation  | Wind streaks      | Linear streak    | 5s + offset | 0-0.7 * pulse   |

---

## 🎭 Zone Rhythm Differentiation

### Primary Zone (Top)
- `phaseOffset: 0`
- **Character:** Slower, deeper pulse
- **Role:** Anchors the bottle/primary emotion

### Secondary Zone (Bottom)
- `phaseOffset: 0.18` (18% of cycle = ~1.44s delay)
- **Character:** Faster, lighter pulse
- **Role:** Complementary realm

**Ambient Sync Mode:** When enabled, zones breathe in alternating rhythm. When disabled, both sync to same phase.

---

## 🎨 Global Gradient Overlay

**Purpose:** Smooth color transition between zones to prevent hard boundary.

```css
background: linear-gradient(to bottom,
  zone-A-bg (0% alpha) 0%,
  zone-A-fg (20% alpha) 40%,
  zone-B-fg (20% alpha) 60%,
  zone-B-bg (0% alpha) 100%
)
opacity: 0.3
z-index: 20 (above zones, below UI)
```

---

## 🔧 Performance Targets

### Frame Rate
- **Target:** 60fps on mobile
- **Method:** `requestAnimationFrame` for pulse loop
- **Optimization:** GPU-accelerated transforms (`transform`, `opacity`, `filter`)

### Paint Layers
- Background gradients: `will-change: background`
- Ambient elements: `pointer-events: none`
- Grain texture: `mix-blend-overlay` at low opacity (0.02-0.05)

### Reduced Motion
- Respects `prefers-reduced-motion: reduce`
- Falls back to static gradient with minimal fade

---

## 🎯 Interaction States

### Idle
- Standard pulse cycle
- Ambient elements at base opacity
- No hover amplification

### Hover
- Opacity +10% (capped at 1.0)
- Scale +2% (pulse.scale * 1.02)
- Pulse strength +20% (capped at 1.0)
- Glow overlay appears: `radial-gradient(circle at center, palette.glow + 20% alpha, transparent 60%)`

### Tap/Click
- Brief scale pulse: `whileTap={{ scale: 1.02 }}`
- Zone expands to fullscreen: `height: 100vh`
- Other zone fades out with blur
- Caption and oil label remain fixed for 0.5s

### Expanded
- Full viewport height
- Single zone breathing
- Tap again to collapse

---

## 📐 Typography Scale

### Region Name
```
Font: Cormorant Garamond (serif)
Size: 4xl (mobile) → 5xl (md) → 6xl (lg)
Weight: 300 (light)
Tracking: wide
Color: white
Shadow: 0 2px 20px rgba(0,0,0,0.3)
Animation: opacity wave (0.9-1.0) over 8s
```

### Oil Label
```
Font: Inter (sans)
Size: sm (mobile) → base (md)
Weight: 300 (light)
Tracking: widest (0.15em)
Transform: uppercase
Color: white/80
Delay: 0.5s fade-in
```

### Caption
```
Font: Inter (sans)
Size: base (mobile) → lg (md)
Weight: 300 (light)
Leading: relaxed (1.625)
Color: white/90
Shadow: 0 1px 10px rgba(0,0,0,0.2)
Max-width: 28rem (md)
Delay: 1s fade-in with 10px upward motion
```

---

## 🧪 Debug Overlay Controls

### Toggleable Display
- **Position:** Fixed bottom-left (mobile), bottom-right 320px (desktop)
- **Background:** black/80 with backdrop-blur-md
- **Content:**
  - Zone emotions and subTones
  - Arousal/valence values (2 decimal precision)
  - Symbol motion types
  - Sound layer and density
  - Ambient Sync Mode toggle

### Visibility
- Initially shown
- Close button (✕) to hide
- "Debug" button to restore when hidden

---

## 🚀 Usage Example

```typescript
import { buildZones } from '@/lib/landing-zone/rules';
import LandingZone from '@/components/molecules/LandingZone';

const enrichment = {
  primary: 'sadness',
  secondary: 'anger',
  valence: -0.3,
  arousal: 0.6,
  confidence: 0.75,
  invoked: ['fatigue', 'stress'],
  expressed: ['irritated'],
};

const [zoneA, zoneB] = buildZones(enrichment);

// Primary zone (top) with no phase offset
<LandingZone zone={zoneA} phaseOffset={0} />

// Secondary zone (bottom) with 18% offset for alternating rhythm
<LandingZone zone={zoneB} phaseOffset={0.18} />
```

---

## ✅ Acceptance Checklist

- [x] Top zone name matches bottle/primary region
- [x] Primary/secondary ambiance differentiated but harmonized
- [x] Motion intensity reacts to arousal/valence
- [x] Smooth transitions from interlude aesthetic
- [x] 60fps on mobile viewport
- [x] No layout shifts or flickers
- [x] Respects `prefers-reduced-motion`
- [x] Global gradient overlay prevents hard boundaries
- [x] Debug overlay shows real-time values
- [x] Ambient sync mode toggleable

---

## 🎬 Next Steps

1. **Audio Integration:** Continue ambient music from interlude page
2. **Gesture Support:** Add gyroscope parallax tilt on mobile
3. **Breathing Guide:** Optional halo synced to pulse cycle
4. **Reverb Shimmer:** WebAudio effects for high valence states
5. **Procedural Grain:** Arousal-modulated alpha for texture depth
