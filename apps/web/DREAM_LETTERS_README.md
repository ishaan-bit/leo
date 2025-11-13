# Dream Letters Feature

## Quick Start

Dream Letters are epistolary messages generated from a user's previous reflections. When a dream letter is ready, users are gently notified and can view it in a cinematic, letter-like display within the Living City.

## For Users

When you sign in and a dream letter is waiting:
1. You'll see a small notification near the Living City icon: "Your Dream Letter from [PigName] is waiting"
2. Click the Living City icon to view your moments
3. The moment with your dream letter will automatically open
4. Read your personalized letter in a beautiful, paper-like format

## For Developers

### File Structure
```
apps/web/
├── src/
│   ├── stores/
│   │   └── dreamLetterStore.ts           # Zustand store for state
│   ├── components/
│   │   ├── atoms/
│   │   │   └── DreamLetterNudge.tsx      # Notification component
│   │   ├── scenes/
│   │   │   └── Scene_Reflect.tsx         # Detection & nudge logic
│   │   └── organisms/
│   │       └── MomentsLibrary.tsx        # Auto-open & display
│   └── types/
│       └── reflection.types.ts           # Type definitions
├── app/
│   └── api/
│       └── pig/[pigId]/moments/
│           └── route.ts                  # API endpoint
├── DREAM_LETTERS_TESTING.md             # Testing guide
└── DREAM_LETTERS_IMPLEMENTATION.md      # Architecture docs
```

### Quick Integration Checklist

**Backend Requirements:**
- [ ] Populate `dream_letter.letter_text` field in Upstash reflections
- [ ] Ensure letter text uses `\n` for paragraph breaks

**Frontend Status:**
- [x] Type definitions updated
- [x] API integration complete
- [x] State management implemented
- [x] UI components created
- [x] Auto-open logic working
- [x] Styling matches design spec

### Example Data Structure

```json
{
  "rid": "rid_abc123",
  "timestamp": "2024-01-15T10:30:00Z",
  "normalized_text": "Today was challenging...",
  "final": {
    "invoked": "anxious",
    "expressed": "calm"
  },
  "dream_letter": {
    "letter_text": "Dear Friend,\n\nI watched you navigate the busy streets today. The way you steadied your breath when the crowd pressed in – that was courage.\n\n— Leo"
  }
}
```

### Key Features

✨ **Smart Detection** - Automatically checks for dream letters on sign-in  
🔔 **Gentle Nudge** - Non-intrusive notification near Living City icon  
🎬 **Cinematic Auto-Open** - Smooth transition to the letter  
📜 **Epistolary Design** - Paper-like card with preserved formatting  
🔒 **Guest Mode Protection** - Only authenticated users see notifications  
🧹 **Clean State Management** - Session-scoped, auto-clears after viewing

### Testing

See `DREAM_LETTERS_TESTING.md` for:
- Detailed test scenarios
- Expected behaviors
- Edge cases
- Debugging tips

### Architecture

See `DREAM_LETTERS_IMPLEMENTATION.md` for:
- Complete architecture overview
- Data flow diagrams
- Component breakdown
- Design decisions
- Maintenance notes

## Security

✅ **CodeQL Scan:** 0 alerts  
✅ **No vulnerabilities introduced**  
✅ **Guest mode properly scoped**  
✅ **Optional chaining prevents null errors**

## Performance

- **Single API call** on sign-in
- **Zero additional network requests**
- **Zustand store** prevents unnecessary re-renders
- **Hardware-accelerated animations** via Framer Motion

## Support

**Questions?** Check the docs:
- Testing: `DREAM_LETTERS_TESTING.md`
- Architecture: `DREAM_LETTERS_IMPLEMENTATION.md`

**Issues?** Look for console logs:
- `💌 Checking for dream letters...`
- `💌 Dream letter found!`
- `💌 Auto-opening dream letter moment: xxx`
