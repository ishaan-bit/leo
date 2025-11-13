# Dream Letters Feature - Testing Guide

## Overview
This guide explains how to test the Dream Letters integration after the backend has populated the `dream_letter` field in Upstash reflections.

## Prerequisites
1. User must be **authenticated** (not in guest mode)
2. At least one reflection in Upstash with a populated `dream_letter` field
3. The dream_letter structure should be:
   ```json
   {
     "dream_letter": {
       "letter_text": "Dear Friend,\n\nIn the bustling city, ...\n\n— Gary"
     }
   }
   ```

## Test Scenarios

### Scenario 1: Sign-In with Pending Dream Letter
**Steps:**
1. Ensure the most recent reflection for a user has a `dream_letter` populated in Upstash
2. Sign in to the Leo app
3. Navigate to the Reflect page

**Expected Behavior:**
- A small floating notification appears near the Living City icon (top-left)
- Message reads: "Your Dream Letter from {PigName} is waiting"
- Notification has a subtle pulsing glow animation
- Close button (X) visible in top-right of notification

**Verify:**
- [ ] Notification appears within 2 seconds of landing on Reflect page
- [ ] PigName is correctly displayed
- [ ] Close button works and dismisses notification
- [ ] Notification does NOT reappear after dismissal

### Scenario 2: Auto-Open Dream Letter in Living City
**Setup:** Same as Scenario 1

**Steps:**
1. Sign in with pending dream letter (notification visible)
2. Click the Living City icon (skyline icon in top-left)

**Expected Behavior:**
- Living City opens with intro animation
- After ~2.5 seconds, the moment with the dream letter auto-expands
- Dream Letter section is visible in the expanded moment view

**Verify:**
- [ ] Living City transitions smoothly
- [ ] Correct moment opens (the one with dream_letter)
- [ ] Dream Letter section appears in expanded view
- [ ] Notification is cleared and doesn't reappear

### Scenario 3: Dream Letter Display in Expanded Moment
**Setup:** Open Living City and expand a moment with a dream_letter

**Expected Visual Elements:**
1. **Section Header:** "Dream Letter from {PigName}"
   - Serif font (Playfair Display/Georgia fallback)
   - ~15px, italic, centered
   
2. **Intro Line:** "Last night, {PigName} brought this back for you:"
   - Smaller serif font, muted color
   - Centered above letter body
   
3. **Letter Body:**
   - Paper-like card with subtle gradient background
   - Soft inner shadow for depth
   - Max width ~580px, centered
   - Line breaks preserved (each `\n` creates a new paragraph)
   - Serif font, 16px, comfortable line-height (1.9)
   
4. **Animation:**
   - Section fades in after tuples section
   - Paragraphs stagger in sequentially

**Verify:**
- [ ] All visual elements match design spec
- [ ] Line breaks in letter text are preserved
- [ ] Letter feels "epistolary" - like reading a physical letter
- [ ] Card has soft paper-like appearance
- [ ] Text is readable and well-spaced

### Scenario 4: No Dream Letter (Teaser State)
**Setup:** Expand a moment WITHOUT a dream_letter

**Expected Behavior:**
- Shows lock icon with pulsing animation
- Message: "When {PigName} sleeps tonight, they'll turn this moment and these companions into a dream letter."
- Sub-message: "Come back tomorrow morning to read what they wrote for you."

**Verify:**
- [ ] Lock icon visible and animated
- [ ] Teaser copy is friendly and informative
- [ ] PigName is correctly displayed

### Scenario 5: Guest Mode - No Notifications
**Setup:** Use the app in guest mode (not signed in)

**Steps:**
1. Create a reflection as a guest
2. Navigate to Reflect page
3. Open Living City

**Expected Behavior:**
- NO dream letter notification appears on Reflect page
- Living City opens normally
- Auto-open still works for newest moment (not dream letter)

**Verify:**
- [ ] No dream letter nudge visible for guest users
- [ ] No errors in console
- [ ] App functions normally

### Scenario 6: Multiple Reflections with Dream Letters
**Setup:** User has multiple reflections, some with dream_letters

**Expected Behavior:**
- Notification only triggers for the MOST RECENT reflection with a dream_letter
- Auto-open prioritizes that specific reflection

**Verify:**
- [ ] Correct reflection is auto-opened
- [ ] Only one notification shown (not multiple)

## Console Logging
Look for these debug logs to trace the flow:

```
💌 Checking for dream letters...
💌 Dream letter found! { reflectionId: 'xxx', pigName: 'xxx' }
💌 Auto-opening dream letter moment: xxx
```

## Edge Cases to Test

### Edge Case 1: Empty letter_text
```json
{ "dream_letter": { "letter_text": "" } }
```
**Expected:** Treated as no dream letter - shows teaser

### Edge Case 2: Missing dream_letter field
```json
{ /* no dream_letter field */ }
```
**Expected:** Treated as no dream letter - shows teaser

### Edge Case 3: Malformed dream_letter
```json
{ "dream_letter": null }
```
**Expected:** Treated as no dream letter - shows teaser

### Edge Case 4: Very long letter
**Expected:** Letter body scrolls, card maintains max-width

### Edge Case 5: Letter with special characters
```
"Dear Friend,\n\n© 2024 — Leo\n\n"Smart quotes" & symbols"
```
**Expected:** All characters render correctly

## Known Issues
- Build is currently blocked by pre-existing TypeScript errors in `/api/enrichment/callback/route.ts` (unrelated to Dream Letters)
- No impact on runtime functionality

## Debugging

### If notification doesn't appear:
1. Check browser console for "💌 Checking for dream letters..." log
2. Verify user is authenticated (check session state)
3. Inspect Upstash data - ensure most recent reflection has `dream_letter.letter_text`
4. Check `/api/pig/{pigId}/moments` response - should include `dream_letter` field

### If auto-open doesn't work:
1. Check console for "💌 Auto-opening dream letter moment: xxx"
2. Verify `autoOpenReflectionId` is passed to MomentsLibrary
3. Check if moment exists in moments array

### If letter doesn't display:
1. Inspect moment data - verify `dream_letter.letter_text` is present
2. Check for empty/null values
3. Verify conditional rendering logic (should check `selectedMoment.dream_letter?.letter_text`)

## Success Criteria
✅ All scenarios pass  
✅ No console errors  
✅ Animations smooth and performant  
✅ Typography and styling match design spec  
✅ Guest mode properly excluded  
✅ State management works (nudge clears after interaction)
