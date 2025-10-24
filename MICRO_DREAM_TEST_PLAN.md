# Micro-Dream Testing Plan

## ✅ What Was Fixed

### Fatal Bug: No Trigger Mechanism
**Problem**: Micro-dream agent was never called from the web app  
**Solution**: Added trigger in reflection save flow + API endpoint

### Cross-Device Bug: Session Tracking
**Problem**: Tracking by `sid` broke cross-device (new browser = reset counter)  
**Solution**: Changed to `owner_id` tracking:
- Guest: `owner_id = "guest:sess_xxx"` 
- Signed in: `owner_id = "user:google_123"`
- Same user across devices = same counter ✅

## 🔧 Architecture

```
User creates moment
    ↓
POST /api/reflect (saves reflection)
    ↓
Triggers (fire-and-forget):
    1. Railway enrichment worker
    2. POST /api/micro-dream/check
        ↓
        Calls Railway Python agent
        ↓
        Increments signin_count:{owner_id}
        ↓
        Checks if should display (pattern: #4, 5, 7, 10, 12, 15...)
        ↓
        Returns { shouldDisplay, microDream, signinCount, nextDisplayAt }
```

## 🧪 Test Scenario

### Current State (Before Testing)
- You have **3 moments** in Upstash under `owner_id`
- `signin_count:{owner_id}` = **1** (from previous test)
- Micro-dream already generated and stored

### Expected Behavior After Creating 3rd Moment
1. ✅ Reflection saves to `reflection:refl_xxx`
2. ✅ Triggers `/api/micro-dream/check` with `ownerId`
3. ✅ Python agent fetches reflections filtered by `owner_id`
4. ⚠️ Agent increments `signin_count:{owner_id}` to **2**
5. ❌ **Should NOT display** (pattern requires signin #4 for first display)

### Test Steps
1. **Delete 1 moment** in Upstash (so you have 2 moments)
2. **Wait for deployment** (Vercel usually 1-2 minutes)
3. **Create new moment** in the app (will be 3rd moment)
4. **Check console logs** in browser DevTools:
   ```
   🌙 Triggering micro-dream check for owner: user:google_xxx
   ```
5. **Check Upstash keys**:
   ```bash
   # Should see:
   signin_count:user:google_xxx = 2  (or 3, 4... depending on count)
   micro_dream:user:google_xxx = {...}  (if generated)
   ```

### Display Pattern (First Time)
- Signin #1-3: No display (gathering moments)
- **Signin #4**: ✅ **FIRST MICRO-DREAM DISPLAYS**
- Signin #5: ✅ Display (+1 gap)
- Signin #6: ❌ No display
- Signin #7: ✅ Display (+2 gap)
- Signin #10: ✅ Display (+3 gap)
- Signin #12: ✅ Display (+2 gap)
- Pattern continues: [+1, +2, +3, +2, +3, +2, +3...]

## 🔍 Debugging Commands

### Check Current Owner ID
```bash
# In browser console (after sign-in):
fetch('/api/auth/session').then(r => r.json()).then(console.log)
```

### Check Upstash State
```python
# In terminal (Leo directory):
python -c "
import os
from dotenv import load_dotenv
load_dotenv('.env.local')
from micro_dream_agent import UpstashClient

upstash = UpstashClient(
    os.getenv('UPSTASH_REDIS_REST_URL'),
    os.getenv('UPSTASH_REDIS_REST_TOKEN')
)

# Replace with your owner_id
owner_id = 'user:google_123456789'  # or 'guest:sess_xxx'

signin_count = upstash.get(f'signin_count:{owner_id}')
micro_dream = upstash.get(f'micro_dream:{owner_id}')
gap_cursor = upstash.get(f'dream_gap_cursor:{owner_id}')

print(f'Signin count: {signin_count}')
print(f'Micro-dream exists: {bool(micro_dream)}')
print(f'Gap cursor: {gap_cursor}')

# Check reflections
reflections = upstash.keys('reflection:*')
print(f'Total reflections: {len(reflections)}')

# Filter by owner_id
import json
count = 0
for key in reflections:
    val = upstash.get(key)
    if val:
        data = json.loads(val)
        if data.get('owner_id') == owner_id:
            count += 1
print(f'Reflections for {owner_id}: {count}')
"
```

### Test Agent Directly
```bash
# Set environment and run agent
OWNER_ID="user:google_123" SKIP_OLLAMA=1 python micro_dream_agent.py
```

## 📊 Success Criteria

1. ✅ Reflection saves successfully
2. ✅ Console shows "Triggering micro-dream check"
3. ✅ `signin_count:{owner_id}` increments in Upstash
4. ✅ Agent fetches only reflections for that `owner_id`
5. ✅ Display logic follows pattern (#4, 5, 7, 10...)
6. ✅ Cross-device: Same user on phone + desktop = same counter

## 🐛 Common Issues

### Issue: "Agent unavailable"
- Railway service might be asleep (cold start ~10s)
- Check `BEHAVIORAL_API_URL` in Vercel env vars
- Verify Railway deployment is running

### Issue: Display triggers too early
- Check `signin_count:{owner_id}` value
- Pattern should start at #4, not #1

### Issue: Wrong reflections returned
- Verify `owner_id` matches between reflection and agent
- Check if guest vs user mismatch
- Use debug script above to inspect data

## 🎯 Next Steps After Testing

1. **Create UI component** to display micro-dream
2. **Add animation** for fade sequence
3. **Handle display state** (show once per signin)
4. **Add dismiss/close** functionality
5. **Track metrics** (display rate, engagement)

---

## Quick Test Checklist

- [ ] Deployment complete (check Vercel dashboard)
- [ ] Deleted 1 moment (have 2 moments in Upstash)
- [ ] Created 3rd moment via app
- [ ] Checked browser console for trigger log
- [ ] Verified `signin_count:{owner_id}` incremented
- [ ] Confirmed pattern logic (should display at signin #4)
- [ ] Tested cross-device (optional)
