# Dream Letters - Implementation Documentation

## Architecture Overview

The Dream Letters feature is implemented across several layers of the Leo application:

```
┌─────────────────────────────────────────────────────────────┐
│                     User Experience Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User signs in                                            │
│  2. Scene_Reflect checks for pending dream letters           │
│  3. If found, shows DreamLetterNudge component               │
│  4. User clicks Living City icon                             │
│  5. MomentsLibrary auto-opens dream letter moment            │
│  6. Expanded view displays dream letter with styling         │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Data Model

### Upstash Schema
The `dream_letter` field is added to the reflection object in Upstash:

```typescript
interface Reflection {
  // ... existing fields
  dream_letter?: {
    letter_text: string; // Multi-line text with '\n' for paragraphs
  };
}
```

### Client-Side Types
Mirrored in two places:

1. **`/apps/web/src/types/reflection.types.ts`**
   ```typescript
   export type Reflection = {
     // ... existing fields
     dream_letter?: {
       letter_text: string;
     };
   };
   ```

2. **`/apps/web/src/components/organisms/MomentsLibrary.tsx`**
   ```typescript
   interface Moment {
     // ... existing fields
     dream_letter?: {
       letter_text: string;
     };
   }
   ```

## Component Architecture

### 1. State Management (`dreamLetterStore.ts`)

**Purpose:** Session-scoped storage for pending dream letter notifications

```typescript
interface PendingDreamLetter {
  reflectionId: string;  // ID of reflection with dream letter
  pigName: string;       // User's pig name for display
  hasDreamLetter: boolean; // Flag to show/hide nudge
}
```

**Methods:**
- `setPendingDreamLetter(letter)` - Set pending state when dream letter detected
- `clearPendingDreamLetter()` - Clear state after auto-open
- `pendingDreamLetter` - Read current state

**Lifecycle:** Created on sign-in, cleared after auto-open or manual dismissal

### 2. Dream Letter Detection (`Scene_Reflect.tsx`)

**Location:** `useEffect` hook, line ~160

**Logic:**
1. Only runs for authenticated users (`status === 'authenticated'`)
2. Fetches moments via `/api/pig/{pigId}/moments`
3. Checks most recent moment for `dream_letter.letter_text`
4. If found, calls `setPendingDreamLetter()`

**Dependencies:** `[status, session?.user, pigId, pigName, setPendingDreamLetter]`

### 3. Nudge Component (`DreamLetterNudge.tsx`)

**Props:**
```typescript
interface DreamLetterNudgeProps {
  pigName: string;
  onDismiss: () => void;
}
```

**Styling:**
- Positioned left of Living City icon
- Floating card with glassmorphism effect
- Pulsing glow animation (2s loop)
- Dismissable close button
- Pointer triangle points to Living City icon

**Accessibility:**
- ARIA label on close button
- Keyboard navigation support
- Screen reader friendly

### 4. Auto-Open Logic (`MomentsLibrary.tsx`)

**Props Addition:**
```typescript
interface MomentsLibraryProps {
  // ... existing props
  autoOpenReflectionId?: string; // NEW
}
```

**Implementation:** Modified existing auto-open effect (line ~435)

**Priority Logic:**
1. If `autoOpenReflectionId` provided, find that moment
2. If found, open it
3. Else, fall back to newest moment
4. After opening, call `clearPendingDreamLetter()`

**Why this approach?** Reuses existing auto-open infrastructure, minimal changes

### 5. Expanded Moment View (`MomentsLibrary.tsx`)

**Location:** Line ~2786 (within modal render)

**Structure:**
```
Dream Letter Section
├─ Conditional: selectedMoment.dream_letter?.letter_text
│  ├─ TRUE: Show dream letter
│  │  ├─ Header: "Dream Letter from {pigName}"
│  │  ├─ Intro: "Last night, {pigName}..."
│  │  └─ Letter Body (paragraphs)
│  └─ FALSE: Show teaser
│     ├─ Lock icon (animated)
│     └─ "Come back tomorrow..." message
```

**Styling Details:**
- **Card:** Gradient background (`rgba(255,255,255,0.65)` → accent color)
- **Border:** Subtle accent color border with transparency
- **Shadow:** Dual-layer shadow for depth
- **Typography:** Cormorant Garamond serif, 16px, line-height 1.9
- **Max Width:** 580px for comfortable reading
- **Animation:** Staggered fade-in for paragraphs

## API Integration

### Endpoint: `/api/pig/[pigId]/moments`

**Changes:** Line ~183

**Before:**
```typescript
dreamLetterState: 'locked' as const,
```

**After:**
```typescript
dream_letter: data.dream_letter || undefined,
```

**Why?** Direct pass-through from Upstash data to client, no transformation needed

## State Flow Diagram

```
┌──────────────┐
│  User Signs  │
│      In      │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────┐
│  Scene_Reflect useEffect     │
│  Checks /api/pig/{id}/moments│
└──────┬───────────────────────┘
       │
       ▼
  ┌────────┐  Yes  ┌─────────────────────┐
  │Dream   ├───────►│setPendingDreamLetter│
  │Letter? │       │(in Zustand store)   │
  └────┬───┘       └─────────────────────┘
       │ No               │
       ▼                  ▼
  ┌─────────┐    ┌────────────────┐
  │No Nudge │    │Show Nudge      │
  └─────────┘    │(DreamLetterNudge)│
                 └────────┬─────────┘
                          │
              ┌───────────┴────────────┐
              │                        │
              ▼                        ▼
      ┌───────────────┐        ┌──────────────┐
      │User Dismisses │        │User Clicks   │
      │(close button) │        │Living City   │
      └───────┬───────┘        └──────┬───────┘
              │                       │
              ▼                       ▼
    ┌──────────────────┐    ┌─────────────────┐
    │clearPendingDream │    │MomentsLibrary   │
    │Letter()          │    │Auto-Opens Moment│
    └──────────────────┘    └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │Show Dream Letter│
                            │in Expanded View │
                            └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │clearPendingDream│
                            │Letter()         │
                            └─────────────────┘
```

## Design Decisions

### 1. Why Zustand over Context API?
- **Performance:** No unnecessary re-renders
- **Simplicity:** Clean API, minimal boilerplate
- **Already in use:** Project already uses Zustand (see package.json)

### 2. Why session-scoped state?
- **Intentional ephemerality:** Dream letters are a "surprise" - once dismissed, they don't nag
- **Simplicity:** No need for localStorage persistence
- **Fresh start:** Each sign-in checks for new dream letters

### 3. Why auto-open?
- **User experience:** Reduces friction - user clicks icon, letter appears
- **Expectation:** Notification sets expectation that something is waiting
- **Delight:** Cinematic reveal enhances emotional impact

### 4. Why prioritize dream letter over newest moment?
- **Intentionality:** Dream letters are time-sensitive, special
- **Notification consistency:** If we notify, we should deliver
- **User trust:** Breaking this would confuse users

## Edge Cases Handled

### Empty/Missing Dream Letters
```typescript
selectedMoment.dream_letter?.letter_text ? (
  // Show letter
) : (
  // Show teaser
)
```
Uses optional chaining and falsy check to handle:
- `dream_letter` missing
- `dream_letter.letter_text` empty string
- `dream_letter.letter_text` null/undefined

### Guest Mode
```typescript
{!showBreathing && !showMomentsLibrary && 
 pendingDreamLetter?.hasDreamLetter && 
 status === 'authenticated' && (
  <DreamLetterNudge ... />
)}
```
Explicit check for `status === 'authenticated'` prevents guest nudges

### Multiple Dream Letters
Detection only looks at **most recent** reflection:
```typescript
const mostRecentMoment = data.moments[0]; // Already sorted by timestamp
```

### Auto-Open Failure
Fallback logic in `MomentsLibrary.tsx`:
```typescript
if (!momentToOpen) {
  // Find newest moment instead
  momentToOpen = moments.reduce(...);
}
```

## Performance Considerations

### 1. Minimal Re-Renders
- Zustand store only updates on state change
- Components only re-render when their slice changes

### 2. Animation Optimization
- Uses `framer-motion` with hardware-accelerated properties
- Staggered delays prevent layout thrashing

### 3. API Efficiency
- Single fetch on mount, reuses existing `/api/pig/{id}/moments` endpoint
- No additional network requests

## Accessibility

### Keyboard Navigation
- Close button focusable with keyboard
- ARIA labels on interactive elements

### Screen Readers
- Semantic HTML structure
- Role attributes on modal content
- Live region updates for state changes

## Future Enhancements

### Potential Improvements
1. **Read tracking:** Mark dream letters as "read" to prevent re-showing
2. **Archive view:** Collection of all past dream letters
3. **Sharing:** Share dream letters as images or text
4. **Multi-language:** Translate dream letters based on user preference
5. **Analytics:** Track open rate, dwell time, etc.

### Backend Requirements
None of the above require frontend changes beyond what's implemented.

## Debugging Tips

### Enable Console Logs
Look for:
- `💌 Checking for dream letters...`
- `💌 Dream letter found!`
- `💌 Auto-opening dream letter moment:`

### Inspect Zustand Store
Use React DevTools:
1. Install React DevTools extension
2. Open DevTools → Components tab
3. Search for component using `useDreamLetterStore`
4. View hook state

### Network Tab
Check `/api/pig/{pigId}/moments` response:
```json
{
  "moments": [
    {
      "id": "...",
      "dream_letter": {
        "letter_text": "..."
      }
    }
  ]
}
```

## Maintenance Notes

### When Backend Schema Changes
Update types in:
1. `/apps/web/src/types/reflection.types.ts`
2. `/apps/web/src/components/organisms/MomentsLibrary.tsx` (Moment interface)

### When Adding New Fields to Dream Letters
Modify:
1. Type definitions (add new field)
2. API pass-through (line ~183 in moments route)
3. Expanded moment view (render new field)

### When Changing Styling
Main styles are in:
- `DreamLetterNudge.tsx` (notification)
- `MomentsLibrary.tsx` line ~2786 (expanded view)

Use existing `atmosphere` theme variables for consistency.
