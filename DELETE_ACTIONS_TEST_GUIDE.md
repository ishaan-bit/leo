# Delete Actions Testing Guide

## Overview
This guide walks through testing the three delete actions in QuietDen Settings:
1. **Clear Reflections** - Deletes all reflections, keeps account
2. **Clear Dream Letters** - Removes dream letters, keeps reflections
3. **Delete All My Data** - Complete erasure and sign-out

---

## Pre-Testing Setup

### Create Test Data
1. Sign in or use guest mode
2. Create 3-5 reflections via `/reflect/new`
3. If testing dream letters:
   - Wait for nightly dream generation, OR
   - Manually insert test dream letter in Redis:
     ```bash
     redis-cli SET user:{userId}:pending_dream '{"letter_text":"Test dream","created_at":"2024-01-01T00:00:00Z","expiresAt":"2024-12-31T23:59:59Z"}'
     ```

### Verify Data Exists
- Check Living City has reflection windows
- Check `/api/pig/[pigId]/moments` returns data
- For signed-in: Check Redis keys `user:{userId}:refl:idx`, `user:{userId}:pending_dream`
- For guest: Check `guest:{uid}:reflections` and related keys

---

## Test Cases

### 1. Clear Reflections (Signed-In User)

**Steps:**
1. Open Settings → Data & Privacy
2. Click "Clear Reflections"
3. Verify confirmation dialog appears with message:
   > "This will erase all the reflections you've written so far. Your account and Pig will stay, but your windows will go dark. This cannot be undone."
4. Click "Cancel" → Dialog closes, no changes
5. Click "Clear Reflections" again
6. Click "Yes, delete"
7. Observe "Deleting..." spinner
8. Toast appears: "Done. It's like we never met these memories."
9. Page reloads
10. Living City should show empty state (no windows)

**Backend Verification:**
```bash
# Check Redis - these should be deleted
redis-cli KEYS "user:{userId}:refl:idx"      # Should not exist
redis-cli KEYS "refl:*"                       # Should be empty for this user
```

**Expected:**
- ✅ All reflections deleted
- ✅ Living City shows empty state
- ✅ User remains signed in
- ✅ Profile data intact

---

### 2. Clear Reflections (Guest User)

**Steps:**
1. Use guest mode (not signed in)
2. Create 2-3 reflections
3. Open Settings → Data & Privacy → "Clear Reflections"
4. Confirm deletion
5. Verify page reloads and Living City is empty

**Backend Verification:**
```bash
redis-cli KEYS "guest:{uid}:reflections"    # Should not exist
redis-cli KEYS "guest:{uid}:reflection:*"   # Should be empty
```

**Expected:**
- ✅ Guest reflections cleared from localStorage-bound namespace
- ✅ Living City resets
- ✅ No sign-out (guest remains guest)

---

### 3. Clear Dream Letters (Signed-In User)

**Steps:**
1. Ensure test dream letter exists in Redis
2. Open Settings → "Clear Dream Letters"
3. Confirm with message:
   > "This will remove all dream letters you've received so far, and cancel any that are still on their way. Your reflections will stay as they are."
4. Click "Yes, delete"
5. Toast: "Done. It's like we never met these memories."
6. Page reloads

**Backend Verification:**
```bash
redis-cli GET "user:{userId}:pending_dream"   # Should return (nil)
# Check reflections still have content but dream_letter field removed
redis-cli GET "refl:{rid}"
```

**Expected:**
- ✅ Pending dream letter deleted
- ✅ `dream_letter` fields removed from reflections
- ✅ Reflections text intact
- ✅ Living City reflections still visible

---

### 4. Clear Dream Letters (Guest User)

**Steps:**
1. In guest mode, attach a mock dream letter to a reflection
2. Open Settings → "Clear Dream Letters"
3. Confirm deletion
4. Verify dream letter removed but reflection text remains

**Expected:**
- ✅ Guest dream letters cleared
- ✅ Reflections remain intact

---

### 5. Delete All My Data (Signed-In User)

**Steps:**
1. Open Settings → "Delete All My Data"
2. Confirmation dialog appears:
   > "This will erase your reflections, dream letters, and profile from QuietDen. Your Pig will forget everything you ever shared here. This cannot be undone."
3. Notice "Type DELETE to confirm" input field
4. Try clicking "Yes, delete" without typing → Button disabled
5. Type "DELETE" (case-sensitive)
6. Click "Yes, delete"
7. Spinner appears: "Deleting..."
8. Toast: "Your traces here have been erased. If you ever return, your city will start fresh."
9. After 2 seconds → signed out + redirected to `/start`

**Backend Verification:**
```bash
redis-cli KEYS "user:{userId}:*"           # All should be deleted
redis-cli KEYS "refl:*"                     # User's reflections deleted
redis-cli GET "user:{userId}:profile"      # Should return (nil)
redis-cli GET "user:{userId}:pending_dream" # Should return (nil)
```

**Expected:**
- ✅ All user data erased
- ✅ User signed out
- ✅ Redirect to `/start`
- ✅ Re-signing in shows fresh account

---

### 6. Delete All My Data (Guest User)

**Steps:**
1. In guest mode with reflections
2. Open Settings → "Delete All My Data"
3. Type "DELETE" to confirm
4. Click "Yes, delete"
5. Toast appears
6. Redirect to `/start` (no sign-out needed, already guest)

**Backend Verification:**
```bash
redis-cli KEYS "guest:{uid}:*"             # All guest data deleted
redis-cli GET "sid:{sid}:profile"          # Should return (nil)
```

**Expected:**
- ✅ All guest data cleared
- ✅ Redirect to landing
- ✅ Fresh session on next visit

---

## Edge Cases to Test

### Error Handling
1. **Network failure simulation:**
   - Disconnect network mid-deletion
   - Verify error toast: "Something went wrong while deleting. Please try again in a bit."
   - Settings modal stays open for retry

2. **Partial deletion:**
   - Mock API to return 500 after deleting some reflections
   - Verify error handling doesn't leave UI stuck

3. **Race condition:**
   - Open Settings → start deletion
   - Close browser tab immediately
   - Verify backend completes deletion (idempotent)

### UI/UX Edge Cases
1. **Rapid clicks:**
   - Click "Clear Reflections" → immediately click again before dialog opens
   - Verify only one dialog opens

2. **ESC key during confirmation:**
   - Open confirmation dialog
   - Press ESC
   - Verify dialog closes, no deletion

3. **Loading state lockout:**
   - Start deletion
   - While spinner shows, try clicking Cancel or outside
   - Verify dialog cannot be dismissed until complete

---

## Rollback Plan

If testing reveals issues in production:

```bash
# Restore from Redis backup (if available)
redis-cli --rdb /path/to/backup.rdb

# Or manually recreate test user profile
redis-cli SET "user:{userId}:profile" '{"pig_name":"TestPig","created_at":"2024-01-01T00:00:00Z"}'
```

---

## Success Criteria

✅ All three delete actions work for signed-in users
✅ All three delete actions work for guest users  
✅ Confirmation dialogs prevent accidental deletion
✅ Loading states and toasts provide clear feedback
✅ Data is actually deleted from Redis (verified manually)
✅ Living City updates correctly after deletion
✅ Sign-out + redirect works for "Delete All My Data"
✅ Error handling shows helpful messages

---

## Notes

- Guest data uses namespaced keys (`guest:{uid}:*`)
- Auth data uses `user:{userId}:*` keys
- Dream letters are separate from reflections (can clear independently)
- Type-to-confirm required only for "Delete All My Data" (extra safety)
- All deletions are **irreversible** - no undo, no recycle bin

---

## Post-Testing Checklist

- [ ] Verified all deletions in Redis/database
- [ ] Tested both auth and guest modes
- [ ] Confirmed Living City updates
- [ ] Error handling works as expected
- [ ] Toast messages are user-friendly
- [ ] No console errors in browser
- [ ] Mobile responsive (test on phone)
- [ ] Accessibility (keyboard navigation, screen readers)

---

**Last Updated:** 2024-11-16
**Implementation:** Complete ✅
**Status:** Ready for QA
