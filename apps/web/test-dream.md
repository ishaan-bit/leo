# Testing Dream Sequence

## Prerequisites
1. Next.js dev server running: `npm run dev` in `apps/web`
2. User logged in (have a session)
3. At least 3 completed reflections with post_enrichment

## Test Flow

### Step 1: Trigger Dream Generation (Cron Job)
The cron job runs daily at 06:00 IST, but you can trigger it manually:

```bash
# Get your CRON_SECRET from .env.local
curl -X POST "http://localhost:3000/api/dream/worker" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_HERE" \
  -H "Content-Type: application/json"
```

Or use this PowerShell command:
```powershell
$secret = "your-cron-secret"
$headers = @{
    "Authorization" = "Bearer $secret"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri "http://localhost:3000/api/dream/worker" -Method POST -Headers $headers
```

**Expected Response:**
```json
{
  "processed": 1,
  "success": ["user_xxx"],
  "failed": [],
  "skipped": []
}
```

This creates a `pending_dream` in Redis for each eligible user.

### Step 2: Check Dream Router
Visit the dream router endpoint to see if a dream is pending:

```bash
curl "http://localhost:3000/api/dream/router"
```

Or in browser: `http://localhost:3000/api/dream/router`

**Expected Responses:**

**If dream available (80% chance):**
```json
{
  "route": "/dream?sid=dream_1729855200_xyz",
  "reason": "dream_available",
  "scriptId": "dream_1729855200_xyz"
}
```

**If no dream:**
```json
{
  "route": "/reflect/new",
  "reason": "no_pending_dream"
}
```

### Step 3: Play the Dream
If you got a `scriptId`, open the dream player:

```
http://localhost:3000/dream?sid=dream_1729855200_xyz
```

**What to expect:**
- **Loading screen**: "The city awakens..." (2-3 seconds)
- **Cinematic sequence**: 
  - Takeoff: Camera zooms slightly, opening line appears
  - Drift: Ambient city breathing
  - Moments: Buildings light up one by one with poetic lines
  - Resolve: Focus on one building, fade out
- **Duration**: 20-60 seconds depending on number of moments (K=3-8)
- **Controls**: 
  - Skip button (bottom left)
  - Pause/play button (bottom right)
  - ESC key to skip
  - SPACE to pause

### Step 4: Complete Dream
When dream finishes (or you skip), it should:
1. Delete the `pending_dream` from Redis
2. Redirect to `/reflect/new`

## Manual Testing Without Cron

### Option A: Create Pending Dream Directly (Redis CLI)
```bash
# Connect to your Redis
redis-cli

# Set a pending dream manually
SET user:YOUR_USER_ID:pending_dream '{"scriptId":"dream_test_123","kind":"daily","usedMomentIds":["refl_1","refl_2","refl_3"],"expiresAt":"2025-10-25T00:00:00Z","createdAt":"2025-10-24T14:00:00Z"}'
```

### Option B: Fetch Dream Data Directly
Test if a dream script can be generated:

```bash
curl "http://localhost:3000/api/dream/fetch?sid=dream_test_123"
```

This will generate a dream on-the-fly using your available moments.

## Debug Tips

### Check Available Moments
Open browser console on `/reflect/new` and run:
```javascript
fetch('/api/reflect/history')
  .then(r => r.json())
  .then(data => {
    const enriched = data.reflections.filter(r => r.post_enrichment);
    console.log(`${enriched.length} enriched moments available`);
    console.log(enriched.map(r => ({
      id: r.reflection_id,
      primary: r.post_enrichment?.wheel?.primary,
      poems: r.post_enrichment?.poems?.length
    })));
  });
```

### Check Redis Keys
```bash
redis-cli

# List all dream-related keys
KEYS *dream*

# Check specific user's pending dream
GET user:YOUR_USER_ID:pending_dream

# Check dream script cache
KEYS dream_script:*
```

### Enable Debug Logs
In `apps/web/src/components/scenes/Scene_Dream.tsx`, all console logs are already in place:
- `[Dream Scene]` - Scene lifecycle
- `[Beat]` - Timeline beats
- Look for errors in browser console

## Expected Performance

### Dream Generation (Worker)
- **Time**: 200-500ms per user
- **CPU**: Minimal (deterministic selection, no LLM)
- **Memory**: <10MB per dream script

### Dream Playback
- **Load time**: <1s (data from Redis)
- **FPS**: 60fps smooth animations
- **Fallback**: 3s static postcard if `prefers-reduced-motion`

## Troubleshooting

### "No pending dream" 
- Cron hasn't run yet
- User doesn't have ≥3 enriched moments
- Dream expired (24-hour TTL)

### "Dream not found"
- Invalid scriptId
- Redis cache expired
- Script generation failed

### Playback issues
- Check browser console for errors
- Verify Framer Motion is loaded
- Check if TypeScript errors resolved (restart TS server)

### Performance issues
- Dream should be 60fps smooth
- If laggy, check CPU usage
- Reduce motion in OS settings for fallback mode

## Quick Test Command (All-in-One)

```powershell
# 1. Trigger dream generation
$secret = "your-cron-secret-here"
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/dream/worker" `
    -Method POST `
    -Headers @{"Authorization"="Bearer $secret"; "Content-Type"="application/json"}
Write-Host "Dream worker result: $($result | ConvertTo-Json)"

# 2. Check router
$route = Invoke-RestMethod -Uri "http://localhost:3000/api/dream/router"
Write-Host "Router says: $($route.route)"

# 3. Open dream in browser if available
if ($route.scriptId) {
    Start-Process "http://localhost:3000/dream?sid=$($route.scriptId)"
}
```
