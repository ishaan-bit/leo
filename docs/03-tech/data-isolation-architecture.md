# Data Isolation Architecture

## Overview
Leo uses **pig-scoped data isolation**, not user-scoped isolation. This is by design, as Leo is a physical product with QR-coded pigs.

## How It Works

### Physical Product Model
```
Physical Pig #1 (QR: pig_001)
  └─> Multiple users can scan this pig
      ├─> User A scans → sees pig_001's moments
      ├─> User B scans → sees pig_001's moments
      └─> Same pig = same moments (intentional sharing)

Physical Pig #2 (QR: pig_002)
  └─> Different users scan this different pig
      ├─> User A scans → sees pig_002's moments
      └─> User C scans → sees pig_002's moments
```

### Data Storage Structure
```
Upstash Redis:
├─ pig:{pigId}                    # Pig metadata (name, created, scan count)
├─ pig_reflections:{pigId}        # Sorted set of reflection IDs for this pig
├─ reflection:{rid}               # Individual reflection data
└─ pig:session:{sessionId}        # Session → Pig mapping
```

### Flow
1. **User scans QR code** → QR contains unique `pigId` (e.g., `pig_abc123`)
2. **URL: `/p/{pigId}`** → Naming ritual page
3. **User names pig** → Stored in `pig:{pigId}`
4. **User reflects** → Moments stored in `pig_reflections:{pigId}`
5. **URL: `/reflect/{pigId}`** → Living City shows all moments for THIS pig

## NOT A DATA BREACH

### Expected Behavior ✅
- **Same pig, different users**: Both see same moments (sharing one physical pig)
- **Different pigs, same user**: User sees different moments (user owns multiple pigs)
- **Different pigs, different users**: Complete isolation (each user has own pig)

### Testing Correctly
```bash
# ❌ WRONG - Testing with same pig ID
Browser 1: /p/testpig (guest)   → sees moments from testpig
Browser 2: /p/testpig (Google)  → sees moments from testpig
# Same pig = same moments = CORRECT BEHAVIOR

# ✅ RIGHT - Testing with different pig IDs
Browser 1: /p/testpig_alice     → sees Alice's pig moments
Browser 2: /p/testpig_bob       → sees Bob's pig moments
# Different pigs = different moments = ISOLATED
```

## User vs Pig Ownership

### Guest Users
- Get anonymous session ID (`guest_uuid`)
- Session ID → Pig ID mapping stored in `pig:session:{sessionId}`
- If guest scans Pig A, then Pig B, they can switch between both
- **No user-to-pig exclusive ownership**

### Authenticated Users
- Same behavior as guests
- Google account ID → Pig ID mapping
- Can scan/own multiple pigs
- **No user-to-pig exclusive ownership**

### Future: Claiming Ownership (Optional Enhancement)
If you want exclusive pig ownership:
```
pig:{pigId} {
  name: "Rosie",
  owner: "user_google_123",  // First user to name claims ownership
  shared_with: [],           // Optional: allow sharing
  private: true              // Only owner sees moments
}
```

But current design is **intentionally shared** - physical toy model.

## Testing Guide

### Visit Test Pigs Page
```
https://localhost:3000/test-pigs.html
```

This provides:
- **testpig_alice** - Alice's isolated pig
- **testpig_bob** - Bob's isolated pig
- **testpig_guest** - Guest mode testing
- **testpig_google** - Google auth testing
- **testpig_shared** - Multi-user sharing test
- **testpig_demo** - Clean demo data

### Test Scenarios

#### Scenario 1: Test Data Isolation
```
1. Browser 1 → /p/testpig_alice → Name "Rosie" → Reflect "Happy memory"
2. Browser 2 → /p/testpig_bob → Name "Max" → Reflect "Sad memory"
3. Check: Browser 1 Living City shows only "Happy memory"
4. Check: Browser 2 Living City shows only "Sad memory"
✅ ISOLATED
```

#### Scenario 2: Test Pig Sharing (Family Use Case)
```
1. Dad's phone → /p/testpig_shared → Name "Family Pig" → Reflect "Dad's thought"
2. Mom's phone → /p/testpig_shared → Sees "Family Pig" → Reflect "Mom's thought"
3. Check: Both phones show BOTH moments in Living City
✅ SHARED CORRECTLY (same physical pig)
```

#### Scenario 3: Test User Multi-Pig Ownership
```
1. Browser 1 (Alice signed in) → /p/testpig_001 → Name "First Pig"
2. Browser 1 (Alice signed in) → /p/testpig_002 → Name "Second Pig"
3. Check: Alice can access both pigs, each has separate moments
✅ MULTI-PIG OWNERSHIP
```

## API Verification

### Check Pig Moments
```bash
GET /api/pig/{pigId}/moments
```
Returns all reflections for specific pig ID.

### Check What You're Seeing
```javascript
// In browser console on Living City page:
console.log(window.location.pathname); 
// Should show: /reflect/{pigId}
// This pigId determines what moments you see
```

## Common Confusion

### "I see the same moments in guest and Google auth!"
✅ **Expected** if you're using `/p/testpig` for both tests.
- You're testing with the **same physical pig**
- Use `/p/testpig_guest` for guest, `/p/testpig_google` for Google

### "Multiple users shouldn't see same data!"
⚠️ **Depends on use case**
- Same pig (family sharing) = SHOULD see same data
- Different pigs (different users) = should NOT see same data
- Current architecture supports BOTH use cases

### "Is this a privacy issue?"
✅ **No** - if users share a physical pig, they share its moments.
- Real-world analogy: Sharing a diary vs owning separate diaries
- If privacy is needed, each user needs their own pig (own QR code)

## Production Deployment

### QR Code Generation
```typescript
// Generate unique pig IDs for each physical toy
const pigId = `pig_${nanoid(12)}`; // e.g., pig_7Kx9mN4pQwZ1

// Encode in QR code:
const qrUrl = `https://leo.app/p/${pigId}`;
```

### Database Seeding
```bash
# Pre-create pig records for manufactured toys
npx tsx scripts/seed-pigs.ts --count 1000
```

### Monitoring Isolation
```sql
-- Check if pig has moments from multiple sessions
SELECT pig_id, COUNT(DISTINCT session_id) as session_count
FROM reflections
GROUP BY pig_id
HAVING session_count > 1;
```

## Summary

✅ **Data isolation is working correctly**  
✅ **Scoped by pigId, not userId (by design)**  
✅ **Use different test pigs to test isolation**  
✅ **Same pig = shared moments (intended for families)**  
✅ **Different pigs = isolated moments**

**This is not a bug, it's the product architecture!**
