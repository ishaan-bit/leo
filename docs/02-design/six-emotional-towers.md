# Six Emotional Towers - Quick Reference

## Tower Specifications

### Vera (Joyful)
**Willcox Primary**: Joyful  
**Color**: `#FFD700` (Gold)  
**Position**: 15% from left  
**Height**: 180px  
**Valence**: 0.8-0.9 (highly positive)  
**Arousal**: 0.5-0.65 (moderate energy)  

**Secondaries**: optimistic, proud, content, playful, interested, accepted  
**Aesthetic**: Warm, bright, optimistic glow  
**Audio tone**: 440 Hz (A4)

---

### Vanta (Powerful)
**Willcox Primary**: Powerful  
**Color**: `#FF6B35` (Orange)  
**Position**: 25% from left  
**Height**: 220px (tallest)  
**Valence**: 0.7-0.85 (positive)  
**Arousal**: 0.55-0.7 (moderate-high energy)  

**Secondaries**: courageous, creative, confident, loving, valued, hopeful  
**Aesthetic**: Bold, assertive, commanding presence  
**Audio tone**: 523 Hz (C5)

---

### Haven (Peaceful)
**Willcox Primary**: Peaceful  
**Color**: `#6A9FB5` (Soft Blue)  
**Position**: 40% from left  
**Height**: 160px (shortest)  
**Valence**: 0.75-0.85 (positive)  
**Arousal**: 0.3-0.5 (low energy, calm)  

**Secondaries**: relaxed, thoughtful, intimate, thankful, trusting, nurturing  
**Aesthetic**: Serene, calm, gentle glow  
**Audio tone**: 349 Hz (F4)

---

### Ashmere (Sad)
**Willcox Primary**: Sad  
**Color**: `#7D8597` (Cool Gray)  
**Position**: 55% from left  
**Height**: 200px  
**Valence**: 0.2-0.4 (negative)  
**Arousal**: 0.3-0.5 (low energy)  

**Secondaries**: lonely, disappointed, guilty, ashamed, abandoned, bored  
**Aesthetic**: Somber, reflective, muted  
**Audio tone**: 293 Hz (D4)

---

### Vire (Mad)
**Willcox Primary**: Mad  
**Color**: `#C1121F` (Deep Red)  
**Position**: 70% from left  
**Height**: 190px  
**Valence**: 0.2-0.4 (negative)  
**Arousal**: 0.6-0.8 (high energy)  

**Secondaries**: hurt, hostile, angry, selfish, hateful, critical  
**Aesthetic**: Intense, sharp, pulsing red  
**Audio tone**: 587 Hz (D5)

---

### Sable (Scared)
**Willcox Primary**: Scared  
**Color**: `#5A189A` (Deep Purple)  
**Position**: 85% from left  
**Height**: 170px  
**Valence**: 0.2-0.45 (negative)  
**Arousal**: 0.65-0.8 (high energy)  

**Secondaries**: rejected, confused, helpless, anxious, insecure, submissive  
**Aesthetic**: Tense, deep, mysterious  
**Audio tone**: 369 Hz (F#4)

---

## Tower Positioning (Desktop View)

```
Screen width: 100%
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Vera   Vanta          Haven         Ashmere        Vire    Sable │
│   15%    25%            40%            55%           70%      85%   │
│   180px  220px          160px          200px         190px    170px │
│   Gold   Orange         Blue           Gray          Red      Purple│
└─────────────────────────────────────────────────────────────────────┘
```

## Visual Design Specs

### Tower Structure
- **Width**: 60px fixed
- **Border**: 1px solid `{color}60` (40% opacity)
- **Background**: Linear gradient `{color}40` → `{color}20` (top to bottom)
- **Shadow**: `0 0 20px {color}20` (default), `{color}80` when highlighted

### Window Grid
- **Layout**: 3 columns × N rows (depends on tower height)
- **Spacing**: 4px gap between windows
- **Padding**: 8px from tower edges
- **Size**: Auto-fit based on tower dimensions

### Window Animation (City Pulse)
- **Period**: 4 seconds
- **Brightness**: `0.2 → 0.6 → 0.2` (sine wave)
- **Color**: `rgba(248, 216, 181, 0.3-0.6)` (warm white)
- **Delay**: Tower index × 0.4s (staggered)

### Highlight State (Primary Emotion)
- **Opacity**: 0.8 (vs 0.2-0.6 for others)
- **Shadow**: `0 0 20px {color}80`
- **Name label**: Appears above tower
  - Font: Serif italic
  - Size: 12px
  - Color: Tower color
  - Position: -32px above tower

## Code Snippets

### Tower Data Structure
```typescript
const TOWERS = [
  { id: 'joyful', name: 'Vera', color: '#FFD700', x: 15, height: 180 },
  { id: 'powerful', name: 'Vanta', color: '#FF6B35', x: 25, height: 220 },
  { id: 'peaceful', name: 'Haven', color: '#6A9FB5', x: 40, height: 160 },
  { id: 'sad', name: 'Ashmere', color: '#7D8597', x: 55, height: 200 },
  { id: 'mad', name: 'Vire', color: '#C1121F', x: 70, height: 190 },
  { id: 'scared', name: 'Sable', color: '#5A189A', x: 85, height: 170 },
];
```

### City Pulse Calculation
```typescript
const getCityPulseBrightness = () => {
  if (!cityPulseActive) return 0.2;
  const t = (Date.now() - startTimeRef.current - 34000) / 4000; // 4s period
  return 0.2 + 0.4 * Math.sin(t * Math.PI * 2); // 0.2 → 0.6 → 0.2
};
```

### Tower Entrance Animation
```typescript
<motion.div
  initial={{ y: 20, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{
    duration: 1,
    delay: idx * 0.4, // Stagger by 0.4s
    ease: [0.4, 0, 0.2, 1],
  }}
>
  {/* Tower content */}
</motion.div>
```

## Emotional Mapping Examples

### User writes: "I finally finished that project I've been working on for months"
**Primary**: Powerful (Vanta tower)  
**Why**: Accomplishment, efficacy, successful completion

### User writes: "Just sitting with my tea, watching the rain"
**Primary**: Peaceful (Haven tower)  
**Why**: Calm, present moment, contentment

### User writes: "Why does no one understand what I'm trying to say?"
**Primary**: Mad (Vire tower)  
**Why**: Frustration, feeling unheard, irritation

### User writes: "I miss how things used to be"
**Primary**: Sad (Ashmere tower)  
**Why**: Loss, nostalgia, longing for the past

### User writes: "What if I'm not ready for this?"
**Primary**: Scared (Sable tower)  
**Why**: Doubt, anxiety, fear of inadequacy

### User writes: "Today felt... good. Really good."
**Primary**: Joyful (Vera tower)  
**Why**: Positive affect, contentment, uplift

## Design Intent

### Visual Metaphor
The six towers represent distinct emotional "zones" in Leo's inner world - a city of feelings where each district has its own character, color, and pulse. When a user's reflection arrives, the analysis identifies which district resonates most strongly with their current state.

### Cinematic Inspiration
- **Blade Runner**: Neon-lit cityscape, breathing with life
- **Spirited Away**: Liminal spaces, magical realism
- **Disco Elysium**: Poetic UI, emotional intelligence made visible
- **Studio Ghibli**: Gentle motion, breathing environments

### Interaction Philosophy
**No clicking, no hovering** - the towers are purely observational. The city pulses with its own rhythm, and when Stage 1 completes, it "recognizes" the user's emotion by highlighting the corresponding tower. This is a **reveal**, not a selection.

---

## Testing Matrix

| Emotion | Tower | Expected Behavior | Visual Check |
|---------|-------|-------------------|--------------|
| Joyful | Vera | Gold glow, warm windows | Bright, welcoming |
| Powerful | Vanta | Orange pulse, tallest | Commanding presence |
| Peaceful | Haven | Soft blue, shortest | Calm, serene |
| Sad | Ashmere | Gray muted, reflective | Somber, restrained |
| Mad | Vire | Red sharp, intense | Pulsing, energetic |
| Scared | Sable | Purple deep, tense | Mysterious, uneasy |

---

**Use this reference when**:
- Designing next scene (zooming into tower)
- Building emotion wheel UI
- Creating tower-specific content
- Testing enrichment pipeline
- Explaining emotional mapping to stakeholders
