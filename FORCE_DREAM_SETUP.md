# Force Dream Feature Flag Setup
# Run this to enable force_dream for test users

## Setup Instructions

### Option 1: Use URL Parameter (Easiest - No Redis Setup Needed)
Simply add `?forceDream=1` to your sign-in callback URL:

```
https://leo-indol-theta.vercel.app/reflect/testpig?forceDream=1
```

Then sign in with Google. You'll be redirected through the dream-gate with force_dream enabled.

### Option 2: Set Redis Feature Flag (Persistent)

If you want the flag to persist across sign-ins without the URL parameter, set it in Redis:

```bash
# PowerShell commands
$userId = "YOUR_GOOGLE_USER_ID"  # Get this from Vercel logs after first sign-in
$redisUrl = "YOUR_UPSTASH_REDIS_URL"
$redisToken = "YOUR_UPSTASH_TOKEN"

# Set feature flag with 24h TTL
$headers = @{
    "Authorization" = "Bearer $redisToken"
    "Content-Type" = "application/json"
}

$body = @{
    force_dream = "on"
} | ConvertTo-Json

Invoke-RestMethod -Uri "$redisUrl/hset/user:$userId:feature_flags/force_dream/on" -Method POST -Headers $headers
Invoke-RestMethod -Uri "$redisUrl/expire/user:$userId:feature_flags/86400" -Method POST -Headers $headers
```

## What Happens When Enabled

1. **Sign-in Flow**:
   - After Google OAuth, redirects to `/api/auth/dream-gate?pigId=testpig&forceDream=1`
   - Dream-gate checks feature flag (Redis or URL param)
   - Bypasses all gates (eligibility, sporadic)

2. **Dream Building**:
   - Fetches your reflections from `user:{userId}:refl:idx`
   - Calls `buildDream` with `testMode: true`
   - Always builds a dream (no 7-day wait, no 65% chance)
   - Selects 3-8 moments from your pool

3. **Dream Playback**:
   - Redirects to `/dream?sid={scriptId}&testMode=1`
   - Shows yellow "TEST MODE: force_dream" badge in top-right
   - Logs all telemetry with `test: true` flag

4. **Console Logs** (check Vercel logs):
   ```
   [Dream Gate] force_dream: ENABLED
   [Dream Builder] TEST MODE: Bypassing all gates
   [Dream Gate] force_dream_build: { sid, K, candidate_count, primaries_used, ... }
   [Dream Gate] force_dream_router: { entering: true, pending_found, built_now, sid, ... }
   [telemetry] dream_play_start { scriptId, kind, K, test: true }
   ```

## Testing Checklist

- [ ] Sign in at `/reflect/testpig?forceDream=1`
- [ ] After Google OAuth, check URL is `/dream?sid=...&testMode=1`
- [ ] See yellow TEST MODE badge in top-right corner
- [ ] Dream plays with 3-8 buildings lighting up
- [ ] Poetic lines appear for each moment
- [ ] Skip button works (ESC key)
- [ ] After complete/skip, lands on Write Moment page

## Rollback (Remove Force Dream)

### Remove URL Parameter:
Just sign in without `?forceDream=1`

### Remove Redis Flag:
```bash
Invoke-RestMethod -Uri "$redisUrl/del/user:$userId:feature_flags" -Method POST -Headers $headers
```

## Debugging

If dream doesn't play:

1. **Check Vercel Logs** for:
   - `[Dream Gate] force_dream: ENABLED` or `disabled`
   - `[Dream Gate] Reflection IDs found: X` (should be > 0)
   - `[Dream Gate] buildDream result: Success` or `Failed`
   - `[Dream Gate] force_dream_build` with K, candidates, etc.

2. **Check Redis Data**:
   - `user:{userId}:refl:idx` should have 5 members (your reflections)
   - Each `refl:{rid}` should have `final.wheel.primary` field
   - Check `user:{userId}:feature_flags` has `force_dream: "on"`

3. **Common Issues**:
   - No reflections: `[Dream Gate] No reflections found`
   - Malformed data: `[Dream Gate] No reflection data found`
   - Build failed: Check if reflections have valid `final.wheel.primary`

## Success Criteria

✅ With `?forceDream=1`, every sign-in routes to dream (no sporadic skips)
✅ If no pending dream exists, one is built synchronously from your 5 reflections
✅ Dream shows 3-8 moment beats with readable poetic lines
✅ Buildings glow in sequence matching primary emotions
✅ TEST MODE badge visible during playback
✅ Telemetry logs show `test: true` flag
✅ On complete/skip, user lands on Write Moment page

## Current Status

**Deployed**: ✅ Commit `de6020d` pushed to main
**Vercel**: ⏳ Deploying (~2-3 minutes)

**Test URL**: 
```
https://leo-indol-theta.vercel.app/reflect/testpig?forceDream=1
```

Sign in with your Google account and you should immediately see the dream sequence!
