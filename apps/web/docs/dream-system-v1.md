# Dream System v1 - LLM-less Deterministic Dreams

Ship v1: 3–8 moment cinematic experience with Ghibli-style city visualization.

## Overview

The Dream system precomputes personalized "dreams" from a user's reflection history and plays them as a cinematic experience on sign-in. All behavior is deterministic (seeded) and requires zero LLM calls.

## Architecture

### Data Flow

```
Daily 06:00 IST Cron
  ↓
Inactivity Worker (/api/dream/worker)
  → Check eligibility (7d/21d gates)
  → Score candidates (recency, intensity, novelty, text)
  → Select 3-8 cores (diversity via primary/time buckets)
  → Generate beats timeline
  → Store pending_dream (TTL 14d)
  ↓
User Sign-in
  ↓
Dream Router (/api/dream/router)
  → 80% seeded chance → /dream?sid=xxx
  → 20% seeded chance → /reflect/new
  ↓
Dream Player (/dream)
  → Fetch pending_dream
  → Render Ghibli city with parallax
  → Play cinematic beats (takeoff → drift → moments → resolve)
  → On complete/skip → Update dream_state, route to /reflect/new
```

### Key Components

#### 1. Data Models (`src/domain/dream/dream.types.ts`)
- `DreamState`: User's dream history (lastDreamAt, lastDreamType, lastDreamMomentIds)
- `PendingDream`: Precomputed dream script (beats, opening, palette, audioKey, usedMomentIds)
- `DreamBeat`: Timeline event (takeoff, drift, moment, resolve)

#### 2. Seeded PRNG (`src/domain/dream/seeded-random.ts`)
- Deterministic random number generator (Mulberry32)
- Seed strings for all randomness:
  - Build sporadicity: `${userId}|${date}|${kind}`
  - K selection: `${userId}|${date}|${kind}|count`
  - Primary bucket order: `${userId}|${date}|${kind}|buckets`
  - Template pick: `${userId}|${scriptId}|${rid}`
  - Sign-in chance: `${userId}|${scriptId}|signin`
  - Camera parallax: `${scriptId}|${rid}|camera`
  - Hue drift: `${scriptId}|${rid}|huedrift`

#### 3. Scoring & Selection (`src/domain/dream/scoring.ts`)
- **Recency decay**: `exp(-daysSince/14)` — 50% weight
- **Intensity**: `max(valence, arousal)` — 25% weight
- **Novelty**: Not in last dream — 15% weight
- **Text richness**: `min(1, length/120)` — 10% weight
- **Diversity selection**: Primary bucketing, time bucket spacing, same-day caps

#### 4. Timeline Math (`src/domain/dream/timeline.ts`)
- Total duration: 18s
- Segments: Takeoff (2.0s) → Drift (2-3s) → Moments (K cores) → Resolve (3.5s)
- Slot duration per core: ≥2.2s guaranteed
- K selection: 3–8 based on candidate pool size

#### 5. Copy Synthesis (`src/domain/dream/dream.config.ts`)
- **Opening lines** (by absence):
  - 7-14d: "Leo waited by the quiet windows."
  - 15-30d: "After many sunsets, the city stirs."
  - 30d+: "The city had fallen asleep; your return wakes it."
- **Keyword extraction**: Stoplist, 3+ chars, max 2 keywords, 12 char limit
- **Templates** (3 variants per primary):
  - Joyful: "Calm breath returns after {kw}"
  - Peaceful: "Quiet tide settles around {kw}"
  - Sad: "Rain remembers {kw} with you"
  - Scared: "Shadows thin; {kw} finds footing"
  - Mad: "Heat fades; {kw} cools to amber"
  - Powerful: "{kw} hums; the city listens"

#### 6. Building Mappings
- **Haven** (Joyful): Sunrise golds (#F7D774, #F7B27D)
- **Vera** (Peaceful): Sage/silver (#A8C3B1, #DDE7E2)
- **Lumen** (Sad): Blue-gray + lamplight (#8AA1B3, #F4E6C3)
- **Aster** (Scared): Twilight violet + stars (#7E6AA6, #D4C8E8)
- **Ember** (Mad): Muted amber → smoke (#C88454, #E8D8C8)
- **Crown** (Powerful): Deep teal + brass (#2D6D6D, #C2A869)

## API Routes

### POST `/api/dream/worker`
**Inactivity Worker** - Builds pending dreams for eligible users
- **Auth**: Bearer token (CRON_SECRET)
- **Schedule**: Daily 06:00 Asia/Kolkata (Vercel Cron)
- **Input**: `{ userIds: string[] }`
- **Output**: `{ results: { total, built, skipped, reasons } }`

### GET `/api/dream/router`
**Sign-in Router** - Decides dream vs reflect route
- **Auth**: NextAuth session
- **Logic**: Check pending_dream → 80% seeded chance → /dream or /reflect/new
- **Output**: `{ route: string, reason: string }`

### GET `/api/dream/fetch?sid=xxx`
**Fetch Dream** - Returns pending dream by script ID
- **Auth**: NextAuth session
- **Validation**: Script ID match, expiration check
- **Output**: `{ dream: PendingDream }`

### POST `/api/dream/complete`
**Complete Dream** - Updates state and cleans up
- **Auth**: NextAuth session
- **Input**: `{ scriptId, skipped?, skipTime? }`
- **Actions**:
  - Delete `user:{id}:pending_dream`
  - Update `user:{id}:dream_state`
  - Route to `/reflect/new`

## UI Components

### `/dream` Page
- Fetches pending dream via `sid` query param
- Manages playback state (playing, paused, currentTime)
- Keyboard controls: Esc (skip), Space (pause/resume)
- Calls `/api/dream/complete` on finish or skip

### DreamScene Component
- **Layers** (z-index 0→40):
  1. Skyline (far): Watercolor silhouettes, parallax x±3px, y±1px
  2. Buildings (mid): 6 zones, breath-pulse on active, glow intensity
  3. Windows (near): Grid of glowing windows, breathing opacity 85%→100%
  4. Film grain: 6-8% noise overlay
  5. Text cards: Glass-effect cards with fade/float animation
- **Reduced motion**: 3s postcard with opening line + moment count
- **Screen reader**: Announce opening + each line at appearance time

### DreamTextCard Component
- Glass effect: `backdrop-filter: blur(12px)`, white overlay 15%
- WCAG AA contrast: Auto-swap dark/light text based on primary color
- Animation: Fade-in 500ms (opacity 0→1, translateY +8→0), hold, fade-out 300ms
- Typography: Cormorant Garamond serif, line-height 1.8, letter-spacing 0.02em

### DreamControls Component
- **Skip button**: Always available from t=0
- **Pause/Play button**: Space key or click
- **Progress bar**: Linear fill 0→100%
- **Accessibility**: Focus rings, ARIA labels, keyboard hints

## Cinematic Motion Grammar

### Takeoff (t=0, 2.0s)
- Camera micro-zoom: 1.00 → 1.05 → 1.00
- Vertical drift: y +10px
- Opening line appears with fade/float

### Drift (t=2.0s, 2-3s)
- Ambient window breathing (opacity 85%→100%→85%, 6-8s cycle)
- Parallax oscillation on skyline

### Moment (per core, slot ≥2.2s)
- Active building breath-pulse: scale 1.00→1.04→1.00 (2.5s cycle)
- Glow intensity step up (box-shadow)
- One-liner appears: fade-in 500ms, hold (slot - 800ms), fade-out 300ms
- Seeded hue drift: ±3° per core for variety

### Resolve (t=D-3.5s, 3.5s)
- Camera subtly centers on first core's building
- All glows soften
- Audio fade-out 1000ms

## Determinism Guarantee

All randomness uses seeded PRNGs. Re-rendering the same `scriptId` produces:
- ✅ Identical K (core count)
- ✅ Identical core selection (same reflections)
- ✅ Identical template variants (same one-liners)
- ✅ Identical camera parallax phases
- ✅ Identical hue drifts
- ✅ Identical sign-in routing (80% chance)

## Performance Targets

- Dream payload: ≤20KB
- Initial UI payload: ≤150KB gzip
- 60fps animation (per-frame work <16ms)
- Film grain: 6-8% opacity (subtle, no black crush)

## Telemetry Events

- `dream_skipped_build`: { reason: ineligible|pending_exists|sporadic_no|no_data }
- `dream_built`: { sid, userId, kind, K, primaries_dist, time_buckets_dist }
- `dream_play_start`: { sid, K }
- `dream_skipped`: { sid, t }
- `dream_complete`: { sid, K, dwell_min, dwell_max }
- `dream_cleanup_expired`: { count }

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| 0 candidates | No build, log `no_data` |
| 1-2 candidates | Build with K=1-2, Drift=3.5s, slot ≥3.0s |
| All same primary | Allowed, vary facade/height, cap at 5 |
| All same date | Cap at 3 from that date unless needed for K |
| Missing valence/arousal | Use 0.5 in scoring |
| Expired pending dream | Clean up on fetch, route to /reflect/new |
| Reduced motion | Show 3s postcard, skip animations |

## Setup

### 1. Environment Variables
```bash
# .env.local
CRON_SECRET=your-cron-secret
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

### 2. Vercel Cron (Production)
The `vercel.json` cron is configured to run daily at 00:00 UTC (06:00 IST).

For manual trigger during development:
```bash
curl -X POST http://localhost:3000/api/dream/worker \
  -H "Authorization: Bearer dev-secret" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["user123", "user456"]}'
```

### 3. Database Schema
**Upstash Redis keys:**
- `user:{id}:dream_state` — JSON string, no TTL
- `user:{id}:pending_dream` — JSON string, TTL 14 days
- `user:{id}:locks:build_dream:{YYYY-MM-DD}` — Script ID, TTL 24h
- `user:{id}:refl:idx` — Sorted set (score = epoch ms)
- `refl:{rid}` — Reflection JSON document

## Testing

### Manual Dream Build
```typescript
// Test build for a user
const result = await buildDream({
  userId: 'test-user',
  reflections: [...], // Your test reflections
  dreamState: null, // First time
  date: '2025-10-24',
});

console.log(result); // PendingDream | null
```

### Validate Beat Timeline
```typescript
import { validateBeats } from '@/domain/dream/timeline';

const validation = validateBeats(dream.beats, K);
if (!validation.valid) {
  console.error(validation.errors);
}
```

### Test Seeded Randomness
```typescript
import { createSeededRandom } from '@/domain/dream/seeded-random';

const rng1 = createSeededRandom('user123|2025-10-24|weekly');
const rng2 = createSeededRandom('user123|2025-10-24|weekly');

console.log(rng1.next() === rng2.next()); // true (deterministic)
```

## Acceptance Checklist

- ✅ Inactivity worker builds pending_dream with 3-8 cores
- ✅ Sign-in router applies 80% seeded gate
- ✅ Dream player renders Ghibli city with parallax
- ✅ Cinematic beats (takeoff → drift → moments → resolve)
- ✅ Text cards show templated lines (no raw reflection text)
- ✅ Skip/pause controls with keyboard support
- ✅ Reduced motion fallback (3s postcard)
- ✅ Completion flow updates dream_state
- ✅ Deterministic replay (same sid → same output)
- ✅ Performance targets met (≤20KB payload, 60fps)

## Future Enhancements (Post-v1)

- Adaptive audio synthesis (modal beds per primary)
- Advanced camera movements (dolly, pan)
- Weather effects (rain for Sad, stars for Scared)
- Multi-language support for templates
- Analytics dashboard (dream engagement metrics)
