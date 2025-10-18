# QR Scan → Naming Ritual Flow (Experience Spec)

## 🌸 Overview
This document defines the emotional, functional, and sensory blueprint for the first ritual interaction when a user scans her pig's unique QR code.  
It is the heart of the Leo onboarding journey — a poetic, liminal moment of naming and emotional bonding.

---

## 🌀 1. Entry Sequence (The First Scan)
**Trigger:** User scans QR → opens `/p/{pigId}` over HTTPS.  
**Goal:** Create instant sense of calm wonder and gentle intimacy.

**Sequence:**
1. Fade in a soft gradient background (pink–lavender haze).  
2. Pig (floating, slow bobbing animation, 4s sine ease-in-out).  
3. Speech bubble fades in after 1.5s:  
   > "They say pigs can't fly. Yet here I am — waiting for someone to believe I could.  
   > I don't have a name yet. Would you lend me one?"

**Technical:**  
- Use Framer Motion for opacity + Y oscillation.  
- Delay bubble by 1.5s to allow ambient reveal.  

---

## 🔊 2. Audio (Ambient Layer)
**Prompt:** A "Tap to enable sound" hint fades in subtly after 2s.  
**Behavior:**
- On tap → initialize Howler.js → fade in ambient.mp3 (4s fade).  
- Loop softly, -12 dB gain.  
- Pause/resume toggle via sound icon in corner.  
- Respect system motion/sound preferences (no autoplay).  

---

## 🪶 3. Naming Interaction
**Form Copy:**  
> "What shall I be called?"  

**Validation:**  
- Empty: show "I need something to remember."  
- Already named: "Ah… someone's already named me."  
- Submit (POST `/api/pig/name`): optimistic animation.

**Animation:**  
1. Pig pauses bobbing → eyes close → sparkle particles rise.  
2. 0.8s delay → pig smiles → gentle confetti pulse.  
3. Speech bubble updates:  
   > "So it's settled. I am **{Name}**.  
   > I'll remember that… wherever you find me again."

---

## 🌤️ 4. Post-Naming Screen
Two buttons fade in below bubble (0.5s stagger):
- **Continue as Guest** → local session.  
- **Continue with Google** → link to `/auth`.  

Below buttons:  
> "Re-scan this QR anytime to find me again."

**State Handling:**  
- On re-scan of already named pig → skip naming form.  
- Show:  
  > "I remember you. I'm **{Name}** — you named me once."  

---

## ♿ 5. Accessibility & Edge Cases
- All audio optional.  
- All text high-contrast (#2D0A0A on #FFF0F5).  
- Supports reduced motion (bypass float animations).  
- Handle missing pigId → 404 poetic fallback:  
  > "I'm sorry — I can't find who I'm supposed to be."  

---

## 🪞 6. Emotional Tone Keywords
*Liminal, tender, introspective, alive, believable, pink mist, weightless trust.*

---

## ✅ 7. Definition of Done
- Smooth entry animation  
- Poetic copy exactly as above  
- Music opt-in working  
- One-time naming locked per pig  
- Rescan flow confirmed  
- Accessible + responsive

---
