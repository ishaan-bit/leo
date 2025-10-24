# Dream System v1 - Deployment Checklist

**Date:** October 24, 2025  
**Status:** READY FOR PRODUCTION ✅

---

## Pre-Deployment Verification

### ✅ Code Quality
- [x] All TypeScript errors resolved
- [x] Import paths corrected
- [x] Default exports added to components
- [x] Redis API calls updated (zrange with byScore)
- [x] Smoke tests passed (PRNG determinism, timeline validation, K selection)
- [x] Acceptance criteria verified (see ACCEPTANCE_VERIFICATION.md)

### ✅ Critical Fixes Applied
- [x] Text card padding increased to 28-32px (spec compliance)
- [x] dream_play_start telemetry event added
- [x] Auth imports use @/lib/auth.config (correct path)

### ⚠️ Known Limitations (Acceptable for v1)
- Audio system not implemented (deferred to Phase 2)
- Facade variations for same-primary adjacency not implemented
- Manual QA testing recommended post-deploy

---

## Deployment Steps

### 1. Environment Variables Setup (Vercel Dashboard)

**Required:**
```bash
# Generate CRON_SECRET
CRON_SECRET=<run: openssl rand -base64 32>

# Already configured (verify present):
KV_URL=rediss://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=AUWy...
NEXTAUTH_SECRET=Rx7J...
NEXTAUTH_URL=https://noen.vercel.app (or your production URL)
GOOGLE_CLIENT_ID=909743...
GOOGLE_CLIENT_SECRET=GOCSPX...
```

**Setup Instructions:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add `CRON_SECRET`:
   - Name: `CRON_SECRET`
   - Value: (generate via `openssl rand -base64 32`)
   - Environments: Production, Preview, Development
3. Verify all other variables are present
4. Click "Save"

### 2. Deploy to Production

```powershell
# Push to main branch (triggers auto-deploy)
git push origin main

# Monitor deployment
# Go to: https://vercel.com/ishaan-bit/leo/deployments
# Wait for "Ready" status (~2-3 minutes)
```

### 3. Post-Deployment Verification

#### A. Build Success ✅
1. Check Vercel deployment logs for errors
2. Verify build completed with no type errors
3. Confirm all routes deployed:
   - `/api/dream/router`
   - `/api/dream/fetch`
   - `/api/dream/complete`
   - `/api/dream/worker`
   - `/dream`

#### B. Cron Job Registration ✅
1. Go to Vercel Dashboard → Project → Cron Jobs
2. Verify cron job appears:
   - **Path**: `/api/dream/worker`
   - **Schedule**: `0 0 * * *` (daily at 00:00 UTC = 06:00 IST)
   - **Status**: Active
3. Test manual trigger (optional):
   ```bash
   curl -X POST https://noen.vercel.app/api/dream/worker \
     -H "Authorization: Bearer <CRON_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"userIds": ["test_user_id"]}'
   ```

#### C. Smoke Test (Manual)

**Test User Journey:**
1. **Setup test user** (via Vercel KV CLI or dashboard):
   ```typescript
   // Set up test user with eligible dream state
   await redis.set('user:test123:dream_state', {
     lastDreamAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
     lastDreamType: null,
     lastDreamMomentIds: []
   });
   
   // Add test reflections (at least 3)
   await redis.zadd('user:test123:refl:idx', {
     score: Date.now() - 5 * 24 * 60 * 60 * 1000,
     member: 'refl_001'
   });
   // ... add more reflections
   ```

2. **Trigger worker** (simulate cron):
   ```bash
   curl -X POST https://noen.vercel.app/api/dream/worker \
     -H "Authorization: Bearer <CRON_SECRET>" \
     -H "Content-Type: application/json" \
     -d '{"userIds": ["test123"]}'
   ```

3. **Verify pending_dream created**:
   - Check Redis: `user:test123:pending_dream` exists
   - Should have all required fields (scriptId, kind, beats, etc.)

4. **Test sign-in router**:
   - Sign in as test user
   - Should route to `/dream?sid=...` (~80% chance) or `/reflect/new` (~20%)

5. **Test dream player** (if routed to /dream):
   - Scene loads with Ghibli city
   - Opening line appears
   - Buildings animate with breath-pulse
   - Text cards fade in/out for each moment
   - Progress bar updates
   - Keyboard controls work (Esc = skip, Space = pause)
   - On completion: routes to `/reflect/new`
   - Verify `dream_state` updated (lastDreamAt, lastDreamType)

6. **Test reduced motion**:
   - Enable `prefers-reduced-motion` in browser DevTools
   - Reload dream player
   - Should show 3s static postcard instead of full animation

#### D. Data Integrity Checks
1. **Verify TTLs**:
   ```bash
   # Check pending_dream has ~14d TTL
   redis-cli TTL user:test123:pending_dream
   # Should return ~1209600 (14 days in seconds)
   
   # Check idempotent lock has 24h TTL
   redis-cli TTL user:test123:locks:build_dream:2025-10-24
   # Should return ~86400 (24 hours)
   ```

2. **Verify dream_state structure**:
   ```bash
   redis-cli GET user:test123:dream_state
   # Should have: lastDreamAt, lastDreamType, lastDreamMomentIds
   ```

3. **Check telemetry logs** (Vercel function logs):
   - Look for `[telemetry] dream_built`
   - Look for `[telemetry] dream_play_start`
   - Look for `[telemetry] dream_complete` or `dream_skipped`

---

## Monitoring & Maintenance

### Daily Health Checks
1. **Cron execution**: Check Vercel cron logs for daily 00:00 UTC runs
2. **Build success rate**: Monitor `dream_built` vs `dream_skipped_build` events
3. **Error rate**: Watch for 500 errors on dream routes
4. **Redis storage**: Monitor key count and memory usage

### Weekly Metrics (Post-v1)
- **Eligible build rate**: Should be ~65% ±5%
- **Play-on-signin rate**: Should be ~80% ±5%
- **Completion rate**: Target ≥75% (excluding Skip)
- **K distribution**: Verify spread across 3-8 cores

### Alerts to Set Up (Optional)
- Cron job failures (Vercel notifications)
- Dream API 5xx error rate > 5%
- Redis storage > 80% capacity
- Build time > 5s (performance regression)

---

## Rollback Plan

If critical issues found post-deploy:

### Option 1: Quick Disable (Non-destructive)
```bash
# Disable cron job via Vercel dashboard
# Routes will return "no pending dream" → fallback to /reflect/new
```

### Option 2: Revert Deployment
```powershell
# Find last good deployment SHA
git log --oneline

# Revert to previous commit
git revert HEAD
git push origin main

# Or force push previous commit (use with caution)
git reset --hard <previous-sha>
git push -f origin main
```

### Option 3: Feature Flag (Future)
Add environment variable:
```bash
DREAM_SYSTEM_ENABLED=false
```
Update router to check this flag.

---

## Phase 2 Enhancements (Post-v1)

### Audio System
- [ ] Implement modal synthesis per primary
- [ ] Fade-in/fade-out envelope
- [ ] Midpoint swell for K≥6
- [ ] Reduced-motion single chord

### Visual Polish
- [ ] Facade variations for same-primary adjacency
- [ ] Advanced camera movements
- [ ] Particle effects (optional)

### Telemetry & Analytics
- [ ] Structured event pipeline (vs console.log)
- [ ] Dashboard for build/play/completion rates
- [ ] Performance monitoring (frame time tracking)

### Testing Infrastructure
- [ ] Automated seed determinism tests
- [ ] Visual regression tests
- [ ] Performance benchmarks (CI/CD)
- [ ] E2E tests for full user journey

---

## Success Criteria (First Week)

- ✅ Zero 500 errors on dream routes
- ✅ Cron job executes daily at 06:00 IST
- ✅ At least 10 successful dream builds
- ✅ At least 5 complete dream playbacks
- ✅ No Redis TTL issues (expired keys cleaned up)
- ✅ Build rate within 60-70% range
- ✅ Play rate within 75-85% range

---

## Contact & Support

**Technical Owner**: Ishaan (GitHub: @ishaan-bit)  
**Repository**: https://github.com/ishaan-bit/leo  
**Deployment**: Vercel (https://vercel.com/ishaan-bit/leo)  
**Database**: Upstash Redis (ultimate-pika-17842)

**Debug Tools**:
- Vercel Logs: https://vercel.com/ishaan-bit/leo/logs
- Redis Console: https://console.upstash.com/redis/ultimate-pika-17842
- Chrome DevTools: Performance tab for frame timing

---

## Final Checklist

Before pushing to production:

- [x] All acceptance criteria verified (see ACCEPTANCE_VERIFICATION.md)
- [x] Critical fixes applied (padding, telemetry)
- [x] CRON_SECRET generated and ready to add to Vercel
- [x] Smoke test plan documented
- [x] Rollback plan documented
- [ ] CRON_SECRET added to Vercel environment variables
- [ ] Push to main and monitor deployment
- [ ] Verify cron job registered
- [ ] Run manual smoke test
- [ ] Monitor for 24 hours

**Status:** READY TO DEPLOY 🚀
