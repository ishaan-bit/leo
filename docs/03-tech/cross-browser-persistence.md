# Cross-Browser/Device Persistence Implementation
**Date**: October 18, 2025  
**Status**: ✅ Complete

## Problem Statement
User wants pig names to persist across **all browsers and devices** when scanning the same QR code, even **before sign-in**.

### Requirements:
- Same QR code → same pigId → same name everywhere
- Works on Chrome, Firefox, Edge, Safari
- Works on laptop, phone, tablet
- No sign-in required for basic persistence
- Each user gets a unique QR code with unique pigId

## Solution: Server-Side Storage

### Architecture:
```
QR Code (unique per user)
    ↓
Contains: pigId (e.g., "abc123xyz")
    ↓
User scans QR → Opens /p/abc123xyz
    ↓
Server checks: pig.storage.ts → pigs.json
    ↓
Returns name if exists, or naming prompt
```

### Implementation:

#### 1. **Server-Side Storage Layer**
**File**: `apps/web/src/domain/pig/pig.storage.ts`

**Storage Format** (`data/pigs.json`):
```json
{
  "testpig": {
    "name": "Rosie",
    "namedAt": "2025-10-18T12:34:56.789Z"
  },
  "abc123xyz": {
    "name": "Butterscotch",
    "namedAt": "2025-10-18T14:22:13.456Z"
  }
}
```

**Functions**:
- `getPigName(pigId)` - Retrieve name for pigId
- `savePigName(pigId, name)` - Save name with timestamp
- `isPigNamed(pigId)` - Check if already named
- `deletePigName(pigId)` - Admin/testing function

#### 2. **API Routes Updated**

**GET `/api/pig/[pigId]`**:
```typescript
// Before: Read from cookie (browser-specific)
const name = cookieStore.get(key(pigId))?.value || null;

// After: Read from server storage (global)
const name = getPigName(pigId);
```

**POST `/api/pig/name`**:
```typescript
// Before: Save to cookie (browser-specific)
cookieStore.set(key(pigId), name, { maxAge: oneYear });

// After: Save to server storage (global)
savePigName(pigId, name.trim());
```

#### 3. **Client-Side Simplified**

**Removed**:
- ❌ localStorage fallback code
- ❌ Cookie reading logic
- ❌ Belt & suspenders dual-persistence

**Result**:
- Single source of truth: **server storage**
- Simpler client code
- No sync issues

### Data Flow:

#### **First Time (Naming)**:
```
1. User scans QR: https://app.com/p/abc123xyz
2. GET /api/pig/abc123xyz → returns { named: false, name: null }
3. UI shows naming prompt
4. User enters "Butterscotch"
5. POST /api/pig/name → saves to server
6. Server writes to data/pigs.json
7. UI shows success
```

#### **Subsequent Scans** (Any Browser/Device):
```
1. User scans same QR: https://app.com/p/abc123xyz
2. GET /api/pig/abc123xyz → returns { named: true, name: "Butterscotch" }
3. UI shows: "So it's settled. I am Butterscotch..."
4. ✅ Works on Chrome, Firefox, Edge, Safari
5. ✅ Works on laptop, phone, tablet
```

### Benefits:

✅ **Cross-browser**: Name persists when switching browsers  
✅ **Cross-device**: Name persists from phone to laptop  
✅ **No sign-in required**: Works immediately via pigId in QR  
✅ **Simple**: Single source of truth on server  
✅ **Reliable**: No cookie/localStorage sync issues  
✅ **Scalable**: Easy to upgrade to real database later  

### Security Considerations:

**Current (File-Based)**:
- ⚠️ No authentication - anyone can name any pigId
- ⚠️ File locking not implemented (concurrent writes)
- ⚠️ No backup/recovery mechanism

**Recommendations for Production**:
1. Add rate limiting (prevent spam naming)
2. Upgrade to real database (PostgreSQL, MongoDB, Supabase)
3. Add authentication after initial naming
4. Implement proper locking/transactions
5. Add audit logs (who named what, when)

### Upgrade Path to Real Database:

When ready, replace `pig.storage.ts` with database calls:

```typescript
// PostgreSQL example
export async function getPigName(pigId: string): Promise<string | null> {
  const result = await db.query(
    'SELECT name FROM pigs WHERE pig_id = $1',
    [pigId]
  );
  return result.rows[0]?.name || null;
}

export async function savePigName(pigId: string, name: string): Promise<void> {
  await db.query(
    'INSERT INTO pigs (pig_id, name, named_at) VALUES ($1, $2, NOW()) 
     ON CONFLICT (pig_id) DO NOTHING',
    [pigId, name]
  );
}
```

### Testing:

**Test Scenarios**:
1. ✅ Name pig on Chrome → Check on Firefox → See same name
2. ✅ Name pig on phone → Check on laptop → See same name
3. ✅ Clear browser data → Rescan QR → Name persists
4. ✅ Different pigIds → Different names (no collision)
5. ✅ Try naming twice → Second attempt rejected

**Test Pig IDs**:
- `testpig` - For development testing
- `abc123xyz` - Example unique pigId
- Generate real ones with: `crypto.randomUUID()`

### QR Code Generation Strategy:

**Option 1: Pre-generate QR codes**:
```typescript
// Generate unique pigId
const pigId = crypto.randomUUID(); // e.g., "f47ac10b-58cc-4372-a567-0e02b2c3d479"

// Create QR code pointing to
const url = `https://your-app.com/p/${pigId}`;

// Generate QR code image
// User can scan this QR code forever
```

**Option 2: On-demand (after sign-up)**:
```typescript
// User signs up → get userId
const pigId = userId; // or generate separate pigId

// Return QR code to user
// They can print/save/share it
```

### File Structure:

```
apps/web/
├── src/
│   └── domain/
│       └── pig/
│           ├── pig.storage.ts  (NEW - server storage)
│           ├── pig.service.ts  (existing)
│           └── pig.types.ts    (existing)
├── app/
│   └── api/
│       └── pig/
│           ├── [pigId]/
│           │   └── route.ts    (UPDATED - uses storage)
│           └── name/
│               └── route.ts    (UPDATED - uses storage)
└── data/
    └── pigs.json              (NEW - data file)
```

### Deployment Notes:

**Vercel/Netlify (Serverless)**:
- ⚠️ File system is read-only in serverless functions
- ✅ Must use database (Vercel Postgres, Supabase, etc.)
- ✅ Environment variables for connection strings

**VPS/Docker (Traditional Server)**:
- ✅ File-based storage works fine
- ✅ Ensure `data/` directory is writable
- ✅ Add `data/pigs.json` to `.gitignore`
- ✅ Implement backup strategy

## Summary

✅ **Implemented**: Server-side storage with `pig.storage.ts`  
✅ **Result**: Names persist across all browsers/devices  
✅ **Simple**: File-based storage for now (easy to upgrade)  
✅ **Ready**: Works immediately for testing  
✅ **Scalable**: Clear upgrade path to real database  

**Next Steps**:
1. Test on multiple browsers/devices ✅
2. Generate unique QR codes per user
3. Upgrade to database for production
4. Add rate limiting & authentication
5. Implement backup/recovery
