# Pending Dream Letter Flow - Implementation Complete

## Overview
Implemented comprehensive pending dream letter system that notifies users when Leo has written them an epistolary dream letter, then guides them through viewing and dismissing it with elegant animations.

## Architecture

### Backend
- **API Endpoint**: `/api/dreams/pending`
  - `GET`: Check if user has pending dream letter (returns 200 with data or 404)
  - `DELETE`: Mark dream as read and remove from Redis
  - Auth: Uses `resolveIdentity()` from next-auth
  - Storage: Fetches from `user:{userId}:pending_dream` in Upstash Redis

### Frontend State Management
- **Context**: `PendingDreamProvider` in `apps/web/src/contexts/PendingDreamContext.tsx`
  - Global state for `pendingDream` (dream letter data)
  - Auto-checks on login (status === 'authenticated')
  - Prevents duplicate API calls with `hasChecked` flag
  - Exposes `clearPendingDream()` method for deletion

- **Root Integration**: Added `<PendingDreamProvider>` to `apps/web/app/layout.tsx`
  - Wraps entire app inside `<AuthProvider>`
  - Enables access from any component via `usePendingDream()` hook

### UI Flow

#### 1. Notification Popup (`Scene_Reflect.tsx`)
- **Location**: Top-left, near Living City button
- **Trigger**: Appears when `pendingDream !== null`
- **Design**: 
  - Dusk-themed gradient card (`#3A2952` → `#6B5B95`)
  - Animated sparkle indicator
  - Letter emoji 💌
  - Copy: "{pigName} has written you a letter"
  - Soft glow effects with blur

- **Visibility**: Hidden during breathing sequence or when Living City is open

#### 2. Auto-Attachment (`MomentsLibrary.tsx`)
- **Effect**: When `selectedMoment` is opened and `pendingDream` exists
  - Attaches `dream_letter` object to selected moment:
    ```typescript
    {
      letter_text: string,
      generated_at: string,
    }
    ```
  - Sets `dreamLetterState = 'available'`

#### 3. Auto-Scroll
- **Ref**: `dreamLetterRef` attached to dream letter section
- **Trigger**: 1.5s delay after moment expansion (waits for animation)
- **Behavior**: 
  ```typescript
  scrollIntoView({ behavior: 'smooth', block: 'center' })
  ```

#### 4. Dream Letter Display
- **Location**: Within expanded moment modal, below songs/dialogue
- **Design**:
  - Epistolary letter on parchment-style background
  - Cormorant Garamond serif font
  - Staggered paragraph fade-ins
  - Optional signature section
  - Paper texture overlay with subtle grain

#### 5. Whoosh Animation & Deletion
- **Button**: "I've read this 💌"
  - Only visible when `pendingDream` exists
  - Gradient background matching zone color
  - Fade-in delay: 2.0s after letter render

- **Animation**:
  ```typescript
  exit={{
    opacity: 0,
    y: -50,
    transition: { duration: 0.6, ease: [0.4, 0, 1, 1] }
  }}
  ```

- **Deletion Flow**:
  1. Update `dreamLetterState = 'read'`
  2. Wait 600ms for exit animation
  3. Call `clearPendingDream()` (DELETE /api/dreams/pending)
  4. Remove from global context
  5. Log completion

## Data Flow

### 1. Dream Generation (External Worker)
```
nightly_dream_generator/index.mjs
  ↓
Generate dream letter using Mistral AI
  ↓
Save to Redis: user:{userId}:pending_dream
  {
    letter_text: "Dear friend...",
    created_at: "2024-01-15T02:30:00Z",
    expiresAt: "2024-01-29T02:30:00Z" // 14-day TTL
  }
```

### 2. User Login
```
User authenticates
  ↓
PendingDreamContext detects auth change
  ↓
Calls GET /api/dreams/pending once
  ↓
Stores in pendingDream state
  ↓
Sets hasChecked = true (prevents re-fetch)
```

### 3. Notification Display
```
Scene_Reflect renders
  ↓
usePendingDream() hook checks context
  ↓
If pendingDream exists: show popup
  ↓
User clicks Living City button
  ↓
MomentsLibrary auto-opens newest moment
```

### 4. Dream Letter Reveal
```
Moment expands (selectedMoment set)
  ↓
Effect detects pendingDream + selectedMoment
  ↓
Attach dream_letter to moment
  ↓
Set dreamLetterState = 'available'
  ↓
Auto-scroll to dream letter section (1.5s delay)
  ↓
Render epistolary letter with staggered animations
```

### 5. Mark as Read
```
User clicks "I've read this 💌"
  ↓
Trigger exit animation (y: -50, opacity: 0)
  ↓
Wait 600ms
  ↓
Call DELETE /api/dreams/pending
  ↓
Clear pendingDream from context
  ↓
State update: dreamLetterState = 'read'
```

## File Changes

### New Files
1. `apps/web/src/app/api/dreams/pending/route.ts` - API endpoints (GET/DELETE)
2. `apps/web/src/contexts/PendingDreamContext.tsx` - Global state management

### Modified Files
1. `apps/web/app/layout.tsx` - Added PendingDreamProvider
2. `apps/web/src/components/scenes/Scene_Reflect.tsx` - Added notification popup + context hook
3. `apps/web/src/components/organisms/MomentsLibrary.tsx`:
   - Added `usePendingDream()` hook
   - Added `dreamLetterRef` for scrolling
   - Added effect to attach dream + auto-scroll
   - Added "Mark as Read" button with whoosh animation
   - Updated prop interface (added `autoOpenMomentId` - currently unused but available for future)

## Design Patterns

### Minimal Polling
- ✅ **One-time check**: Only fetches on login, not continuous polling
- ✅ **Flag-based**: `hasChecked` prevents duplicate API calls
- ✅ **Event-driven**: Uses React Context + useEffect with auth dependency

### Graceful Degradation
- ✅ **API errors**: Marks as checked even on error (prevents retry loops)
- ✅ **Expired dreams**: Backend checks `expiresAt` and auto-deletes
- ✅ **Missing data**: Falls back gracefully if dream letter missing

### Animation Timing
- 1.2s: Notification popup fade-in
- 1.5s: Auto-scroll delay (waits for moment expansion)
- 2.0s: "Mark as Read" button appears
- 0.6s: Whoosh exit animation duration

## Testing Checklist

### Backend
- [ ] GET /api/dreams/pending returns 200 when dream exists
- [ ] GET /api/dreams/pending returns 404 when no dream
- [ ] GET /api/dreams/pending returns 401 when not authenticated
- [ ] DELETE /api/dreams/pending removes from Redis
- [ ] DELETE /api/dreams/pending returns 204 on success

### State Management
- [ ] Context auto-checks on login
- [ ] Context doesn't re-check on re-render
- [ ] clearPendingDream() removes from state + backend

### UI Flow
- [ ] Notification appears when pending dream exists
- [ ] Notification hidden during breathing/library transitions
- [ ] Auto-scroll works on moment expansion
- [ ] Dream letter renders with correct styling
- [ ] "Mark as Read" button appears after delay

### Animation
- [ ] Whoosh exit animation plays smoothly
- [ ] State updates after animation completes
- [ ] No flickering or layout shifts

## Future Enhancements

### Specific Reflection Targeting
Currently, the pending dream is attached to whichever moment the user opens. Future iterations could:
- Store `reflectionId` in pending_dream during generation
- Pass `autoOpenMomentId` to MomentsLibrary to open specific reflection
- Modify nightly_dream_generator to associate dream with newest reflection

### Multiple Dream Letters
- Queue system for multiple pending dreams
- Badge counter on notification popup
- History of past dream letters

### Localization
- Translate dream letter content to Hindi
- Store translations in pending_dream object
- Use existing `language` state in MomentsLibrary

## Error Handling

### Network Failures
- API errors logged to console
- State marked as checked to prevent retry loops
- User experience: no dream notification (graceful fail)

### Missing Dream Data
- Checks for `dream_letter?.letter_text` before rendering
- Falls back to "locked" state if data incomplete

### Authentication Edge Cases
- Guest users: no pending dream check (requires auth)
- Session expiry: re-check on next login
- Merge scenarios: handled by identity resolution

## Performance Considerations

### Redis TTL
- 14-day expiration prevents stale data accumulation
- Backend double-checks expiry on GET request

### Frontend Optimization
- Context value memoized (React Context best practices)
- Auto-scroll only triggers once per expansion
- Animation delays prevent UI jank

### Bundle Size
- No new dependencies added
- Uses existing Framer Motion, next-auth, @upstash/redis

## Accessibility

### Keyboard Navigation
- "Mark as Read" button is focusable
- Standard button interaction patterns

### Screen Readers
- Semantic HTML structure (button, div, p tags)
- Clear button label: "I've read this 💌"

### Motion
- Animations use Framer Motion's accessibility-aware system
- Users with reduced motion preferences handled by browser

## Deployment Notes

### Environment Variables
- Requires `KV_REST_API_URL` and `KV_REST_API_TOKEN` (already configured)
- Uses existing next-auth session management

### Database Schema
- Redis key pattern: `user:{userId}:pending_dream`
- No migrations needed (key-value store)

### Monitoring
- Console logs for debugging:
  - `[PendingDream]` prefix for context operations
  - `[MomentsLibrary] 💌` for dream attachment
  - `[API]` for backend operations

## Success Criteria
✅ Minimal polling (one-time check on login)
✅ Popup notification with dusk aesthetic
✅ Auto-navigation to Living City (existing auto-open logic)
✅ Auto-scroll to dream letter section
✅ Whoosh deletion animation
✅ Clean state management with React Context
✅ No TypeScript errors
✅ Follows existing codebase patterns
