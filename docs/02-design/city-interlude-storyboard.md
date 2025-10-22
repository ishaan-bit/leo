# City Interlude - Visual Storyboard

## Phase 1: The Holding (0-14s)

### Beat 1 (0-5s) - "Your moment has been held safe"
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│                                                             │
│                                                             │
│                         ✨                                  │
│                      ◯  🐷  ◯                              │  ← Leo breathing
│                         ◯                                   │     gently
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│           "Your moment has been held safe."                │
│                                                             │
│                                                             │
│                        • • •                                │  ← Progress dots
└─────────────────────────────────────────────────────────────┘
Background: Warm blush (#FCE9EF → #F9D8E3)
Leo: Center, scale 0.99 ↔ 1.01 (5s breathing)
```

### Beat 2 (5-14s) - Transition breath
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│    ·         ·          ★         ·         ·               │  ← Stars fading in
│       ·            ·         ·         ★                    │
│                                                             │
│          ∘∘∘∘∘∘∘∘∘                                         │  ← Ripples
│        ∘         🐷        ∘                                │     expanding
│          ∘∘∘∘∘∘∘∘∘                                         │
│                                                             │
│    ·    ↑      ↑    ·    ↑      ↑    ·                    │  ← Dust motes
│  ·   ↑      ↑    ·    ↑      ↑    ·   ↑                   │     rising
│                                                             │
│                                                             │
│                        • • •                                │
└─────────────────────────────────────────────────────────────┘
Background: Cooling to mauve (#EACBE3 → #D7B3DB)
Ripples: 3 circles expanding from Leo
Motes: 40 particles, 12px/s upward
```

---

## Phase 2: The Breath Between Things (14-26s)

### Beat 3 (14-20s) - "A quiet breath between things"
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│  ·    ★       ★    ·    ★       ★    ·    ★       ★       │  ← More stars
│    ·      ★       ·        ★       ·        ★       ·      │
│                                                             │
│  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·       │  ← Faster motes
│    ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑        │     (18px/s)
│              🐷                                             │  ← Leo inhaling
│            ( ↑ )                                           │     scale 1.03
│                                                             │
│                                                             │
│                                                             │
│         "A quiet breath between things."                   │
│                                                             │
│                        • • •                                │
└─────────────────────────────────────────────────────────────┘
Background: Violet gradient (#D7B3DB → #C1A0E2)
Leo: Breathing cycle 0.97 ↔ 1.03 (4s)
Particles: 60 motes, sine wave drift
```

### Beat 4 (20-26s) - Pause before movement
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│  ·    ★       ★    ·    ★       ★    ·    ★       ★       │
│    ·      ★       ·        ★       ·        ★       ·      │
│                                                             │
│  ·   ⇡    ⇡  ·   ⇡    ⇡  ·   ⇡    ⇡  ·   ⇡    ⇡  ·       │  ← Motes pause
│    ⇡  ·  ⇡      ⇡  ·  ⇡      ⇡  ·  ⇡      ⇡  ·  ⇡        │     (gravity pause)
│         🐷                                                  │  ← Leo rising
│        ( ↑ )                                               │     y: -30px
│                                                             │
│                                                             │
│                                                             │
│                                                             │
│                        • • •                                │
└─────────────────────────────────────────────────────────────┘
Background: Held breath (frozen gradient)
Leo: Ascending y: 0 → -30px over 6s
Motes: Hover 2s, then drift down briefly
```

---

## Phase 3: Time Holding Its Breath (26-34s)

### Beat 5 (26-32s) - "And time holding its breath"
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│  ✦    ★       ★    ✦    ★       ★    ✦    ★       ★       │  ← Stars brighter
│    ✦      ★       ✦        ★       ✦        ★       ✦      │     (opacity 0.3)
│                                                             │
│         🐷                                                  │  ← Leo upper-third
│        ( · )                                               │     scale 0.95
│  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·       │     glow halo
│    ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑        │
│                                                             │
│                                                             │
│                                                             │
│        "And time holding its breath."                      │
│                                                             │
│                        • • •                                │
└─────────────────────────────────────────────────────────────┘
Background: Twilight (#C1A0E2 → #1A0F25)
Leo: Upper-third position (y: -60px)
Horizon line: Barely perceptible (+5% luminance)
```

---

## Phase 4: The Pulse of the City (34-42s → loop)

### Beat 6 (34-37s) - First lights
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│  ✦    ★       ★    ✦    ★       ★    ✦    ★       ★       │
│    ✦      ★       ✦        ★       ✦        ★       ✦      │
│                                                             │
│         🐷                                                  │  ← Leo steady hover
│        ( ~ )                                               │     gentle glow
│                                                             │
│  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·       │
│    ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑        │
│                                                             │
│ ───────────────────────────────────────────────────────────│  ← Horizon
│  ▓▓   ▓▓▓     ▓▓    ▓▓▓   ▓▓▓    ▓▓                      │  ← Six towers
│  ▓▓   ▓▓▓     ▓▓    ▓▓▓   ▓▓▓    ▓▓                      │     sliding up
│  ▓▓   ▓▓▓     ▓▓    ▓▓▓   ▓▓▓    ▓▓                      │
│  Vera Vanta Haven Ashmere Vire Sable                       │
└─────────────────────────────────────────────────────────────┘
Background: Midnight (#0C0818 → #1A0F25)
Towers: Slide up 20px, staggered 0.4s delays
Windows: 3-5% randomly flickering on (warm #F8D8B5)
```

### Beat 7 (37-40s) - City breathes
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│  ✦    ★       ★    ✦    ★       ★    ✦    ★       ★       │
│    ✦      ★       ✦        ★       ✦        ★       ✦      │
│                                                             │
│         🐷                                                  │  ← Leo synced glow
│        (✨)                                                │     with city pulse
│                                                             │
│  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·       │  ← Faster updraft
│    ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑        │     (18px/s)
│                                                             │
│ ───────────────────────────────────────────────────────────│
│  ▓█   ▓█▓     ▓█    ▓█▓   ▓█▓    ▓█                      │  ← Windows pulsing
│  █▓   █▓█     █▓    █▓█   █▓█    █▓                      │     0.2 → 0.6 → 0.2
│  ▓█   ▓█▓     ▓█    ▓█▓   ▓█▓    ▓█                      │     (4s sine wave)
│  Vera Vanta Haven Ashmere Vire Sable                       │
└─────────────────────────────────────────────────────────────┘
Light wave: Travels across skyline (sinusoidal pulse)
Each tower: Offset 0.4s for organic rhythm
Rooflines: Faint glint (neon opacity 0.15 → 0)
```

### Beat 8 (40s+) - Suspended breath / Ready State **LOOP**
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│  ✦    ★       ★    ✦    ★  ⌇  ★    ✦    ★       ★       │  ← Shimmer rolls
│    ✦      ★       ✦        ★       ✦        ★       ✦      │     every 10s
│                                                             │
│         🐷                                                  │  ← Leo equilibrium
│        ( ~ )                                               │     steady hover
│                                                             │
│  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·       │
│    ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑        │
│                                                             │
│ ───────────────────────────────────────────────────────────│
│  ▓█   ▓█▓     ▓█    ▓█▓   ▓█▓    ▓█                      │  ← City pulse
│  █▓   █▓█     █▓    █▓█   █▓█    █▓                      │     continues
│  ▓█   ▓█▓     ▓█    ▓█▓   ▓█▓    ▓█                      │     indefinitely
│  Vera Vanta Haven Ashmere Vire Sable                       │
│                                                             │
│                   ⟳ LOOP UNTIL STAGE 1 READY ⟳             │
└─────────────────────────────────────────────────────────────┘
City pulse: 4s period, continues indefinitely
Shimmer: Faint data aura every 10s
No fast motion: Total equilibrium
```

---

## When Stage 1 Completes

### Primary Emotion Identified (e.g., "Sad" → Ashmere)
```
┌─────────────────────────────────────────────────────────────┐
│  👤 User    🔇 Sound                    [Mobile/Desktop]    │
│  ────────────────────────────────────────────────────────── │
│  ✦    ★       ★    ✦    ★       ★    ✦    ★       ★       │
│    ✦      ★       ✦        ★       ✦        ★       ✦      │
│                                                             │
│         🐷                                                  │
│        ( ~ )                                               │
│                                                             │
│  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·   ↑    ↑  ·       │
│    ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑      ↑  ·  ↑        │
│                                                             │
│ ───────────────────────────────────────────────────────────│
│  ▓░   ▓░▓     ▓░   ▓███  ▓░▓    ▓░                        │  ← Ashmere stays
│  ░▓   ░▓░     ░▓   █▓█▓  ░▓░    ░▓                        │     bright (0.8)
│  ▓░   ▓░▓     ▓░   ▓███  ▓░▓    ▓░                        │     others dim
│  Vera Vanta Haven **Ashmere** Vire Sable                   │
│                      ↑                                      │
│              (Primary emotion tower)                       │
└─────────────────────────────────────────────────────────────┘
Highlighted tower: Opacity 0.8, others 0.2
Next pulse peak: Holds bright for 2s
Then: onComplete('sad') → Hand-off to next scene
```

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🐷 | Leo (PinkPig component) |
| ★ ✦ · | Stars (varying brightness) |
| ◯ ∘ | Ripples/breathing waves |
| ↑ ⇡ | Dust motes (rising, paused) |
| ▓ █ | Tower silhouette (dim, bright windows) |
| ░ | Dimmed tower (not primary) |
| ⌇ | Shimmer effect |
| ( ↑ ) | Leo inhaling |
| ( · ) | Leo neutral |
| ( ~ ) | Leo steady hover |
| (✨) | Leo glowing |

---

## Mobile vs Desktop Comparison

### Mobile (< 768px)
```
┌──────────────────────────┐
│  👤  🔇        [Mobile]  │
│  ──────────────────────  │
│                          │
│         🐷               │  ← 160px Leo
│        ( ~ )             │
│                          │
│  ▓▓ ▓▓▓ ▓▓ ▓▓▓ ▓▓▓ ▓▓   │  ← Towers fit
│  ▓▓ ▓▓▓ ▓▓ ▓▓▓ ▓▓▓ ▓▓   │     with spacing
│                          │
│  "A quiet breath..."     │  ← text-xl
│          • • •           │
└──────────────────────────┘
```

### Desktop (≥ 768px)
```
┌─────────────────────────────────────────────┐
│  👤 User    🔇 Sound        [Desktop]       │
│  ───────────────────────────────────────── │
│                                             │
│              🐷                             │  ← 200px Leo
│             ( ~ )                           │
│                                             │
│  ▓▓   ▓▓▓     ▓▓    ▓▓▓   ▓▓▓    ▓▓       │  ← Towers spacious
│  ▓▓   ▓▓▓     ▓▓    ▓▓▓   ▓▓▓    ▓▓       │
│                                             │
│     "A quiet breath between things."       │  ← text-2xl
│                  • • •                      │
└─────────────────────────────────────────────┘
```

---

## Color Gradient Timeline

```
Time:  0s      5s     14s     20s     26s     34s     40s+
       │       │       │       │       │       │       │
Phase: ├───1───┼───1───┼───2───┼───2───┼───3───┼───4───┤ loop
       │       │       │       │       │       │       │
Color: 🌸      🌸      🍇      🍇      🌃      🌃      🌃
       Blush   Mauve   Violet  Violet  Twilit  Midnit  Midnit
       
🌸 Blush:   #FCE9EF → #F9D8E3 → #EACBE3 → #D7B3DB
🍇 Violet:  #D7B3DB → #C1A0E2
🌃 Twilight: #C1A0E2 → #1A0F25
🌃 Midnight: #0C0818 → #1A0F25 (holds)
```

---

**Use this storyboard for**:
- Visualizing the full 42-second experience
- Understanding spatial relationships
- Debugging animation timing
- Communicating with stakeholders
- QA testing visual progression
