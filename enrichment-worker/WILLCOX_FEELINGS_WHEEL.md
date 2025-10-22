# Gloria Willcox Feelings Wheel - Complete Taxonomy

## Overview
The Gloria Willcox Feelings Wheel is a 3-level emotion taxonomy with:
- **6 Primary emotions** (core feelings)
- **36 Secondary emotions** (6 per primary)
- **216 Tertiary emotions** (6 per secondary)

Total: **258 distinct emotions**

---

## 1. Joyful
**Valence**: 0.8-0.9 (highly positive)  
**Arousal**: 0.5-0.65 (moderate energy)

### 1.1 optimistic
- hopeful
- inspired
- open
- encouraged
- confident
- motivated

### 1.2 proud
- successful
- confident
- accomplished
- worthy
- fulfilled
- valued

### 1.3 content
- pleased
- satisfied
- fulfilled
- happy
- comfortable
- peaceful

### 1.4 playful
- aroused
- energetic
- free
- amused
- spontaneous
- silly

### 1.5 interested
- curious
- engaged
- fascinated
- intrigued
- absorbed
- inquisitive

### 1.6 accepted
- respected
- valued
- included
- appreciated
- acknowledged
- welcomed

---

## 2. Powerful
**Valence**: 0.7-0.85 (positive)  
**Arousal**: 0.55-0.7 (moderate-high energy)

### 2.1 courageous
- daring
- bold
- brave
- fearless
- assertive
- strong

### 2.2 creative
- innovative
- imaginative
- inspired
- resourceful
- inventive
- original

### 2.3 confident
- secure
- capable
- competent
- assured
- certain
- self-reliant

### 2.4 loving
- affectionate
- warm
- compassionate
- tender
- caring
- devoted

### 2.5 valued
- appreciated
- respected
- important
- recognized
- significant
- esteemed

### 2.6 hopeful
- optimistic
- encouraged
- expectant
- positive
- trusting
- faithful

---

## 3. Peaceful
**Valence**: 0.75-0.85 (positive)  
**Arousal**: 0.3-0.5 (low energy, calm)

### 3.1 relaxed
- calm
- comfortable
- rested
- relieved
- serene
- tranquil

### 3.2 thoughtful
- reflective
- contemplative
- pensive
- considerate
- analytical
- meditative

### 3.3 intimate
- connected
- close
- vulnerable
- open
- trusting
- loved

### 3.4 thankful
- grateful
- appreciative
- blessed
- fortunate
- content
- satisfied

### 3.5 trusting
- secure
- safe
- confident
- assured
- comfortable
- relaxed

### 3.6 nurturing
- caring
- protective
- supportive
- maternal
- loving
- tender

---

## 4. Sad
**Valence**: 0.2-0.4 (negative)  
**Arousal**: 0.3-0.5 (low energy)

### 4.1 lonely
- isolated
- abandoned
- alone
- rejected
- empty
- disconnected

### 4.2 disappointed
- let down
- discouraged
- defeated
- unhappy
- dissatisfied
- unfulfilled

### 4.3 guilty
- regretful
- ashamed
- remorseful
- sorry
- responsible
- blameworthy

### 4.4 ashamed
- embarrassed
- humiliated
- mortified
- inferior
- inadequate
- unworthy

### 4.5 abandoned
- deserted
- left
- alone
- neglected
- forgotten
- unwanted

### 4.6 bored
- uninterested
- indifferent
- apathetic
- listless
- unstimulated
- flat

---

## 5. Mad
**Valence**: 0.2-0.4 (negative)  
**Arousal**: 0.6-0.8 (high energy)

### 5.1 hurt
- betrayed
- rejected
- wounded
- offended
- let down
- mistreated

### 5.2 hostile
- aggressive
- angry
- vengeful
- hateful
- bitter
- resentful

### 5.3 angry
- furious
- enraged
- outraged
- livid
- irate
- mad

### 5.4 selfish
- inconsiderate
- thoughtless
- self-centered
- uncaring
- insensitive
- entitled

### 5.5 hateful
- disgusted
- contemptuous
- disdainful
- scornful
- repulsed
- revolted

### 5.6 critical
- judgmental
- disapproving
- cynical
- harsh
- demanding
- fault-finding

---

## 6. Scared
**Valence**: 0.2-0.45 (negative)  
**Arousal**: 0.65-0.8 (high energy)

### 6.1 rejected
- inadequate
- unworthy
- unlovable
- excluded
- unwanted
- inferior

### 6.2 confused
- uncertain
- unclear
- lost
- baffled
- puzzled
- perplexed

### 6.3 helpless
- powerless
- trapped
- stuck
- overwhelmed
- incapable
- vulnerable

### 6.4 anxious
- worried
- nervous
- tense
- fearful
- uneasy
- apprehensive

### 6.5 insecure
- inadequate
- inferior
- unconfident
- uncertain
- vulnerable
- doubtful

### 6.6 submissive
- weak
- powerless
- passive
- compliant
- obedient
- worthless

---

## Valence & Arousal Map

| Primary | Valence Range | Arousal Range | Quadrant |
|---------|---------------|---------------|----------|
| Joyful | 0.8 - 0.9 | 0.5 - 0.65 | High pleasure, moderate activation |
| Powerful | 0.7 - 0.85 | 0.55 - 0.7 | High pleasure, high activation |
| Peaceful | 0.75 - 0.85 | 0.3 - 0.5 | High pleasure, low activation |
| Sad | 0.2 - 0.4 | 0.3 - 0.5 | Low pleasure, low activation |
| Mad | 0.2 - 0.4 | 0.6 - 0.8 | Low pleasure, high activation |
| Scared | 0.2 - 0.45 | 0.65 - 0.8 | Low pleasure, high activation |

---

## Usage in Frontend

### Wheel Output Schema
```json
{
  "wheel": {
    "primary": "Sad",
    "secondary": "ashamed",
    "tertiary": "humiliated"
  }
}
```

### Color Palette Suggestions
- **Joyful**: Warm yellows, golds (#FFD700, #FDB813)
- **Powerful**: Bold oranges, reds (#FF6B35, #D62828)
- **Peaceful**: Soft blues, greens (#6A9FB5, #90C3C8)
- **Sad**: Cool grays, muted blues (#7D8597, #A4B0BE)
- **Mad**: Deep reds, burgundy (#C1121F, #780000)
- **Scared**: Purples, deep blues (#5A189A, #3C096C)

### UI Patterns
1. **Radial visualization**: Show primary at center, secondary in middle ring, tertiary in outer ring
2. **Breadcrumb trail**: `Sad → ashamed → humiliated`
3. **Expandable tree**: Click primary to reveal secondaries, click secondary to reveal tertiaries
4. **Heat map**: Map valence (x-axis) vs arousal (y-axis) with color-coded regions

---

## Data Structure (JSON)

```json
{
  "Joyful": {
    "valence": [0.8, 0.9],
    "arousal": [0.5, 0.65],
    "secondaries": {
      "optimistic": ["hopeful", "inspired", "open", "encouraged", "confident", "motivated"],
      "proud": ["successful", "confident", "accomplished", "worthy", "fulfilled", "valued"],
      "content": ["pleased", "satisfied", "fulfilled", "happy", "comfortable", "peaceful"],
      "playful": ["aroused", "energetic", "free", "amused", "spontaneous", "silly"],
      "interested": ["curious", "engaged", "fascinated", "intrigued", "absorbed", "inquisitive"],
      "accepted": ["respected", "valued", "included", "appreciated", "acknowledged", "welcomed"]
    }
  }
}
```

---

## References
- Based on Gloria Willcox's Feelings Wheel (psychotherapy tool)
- Aligned with Russell's Circumplex Model of Affect (valence × arousal)
- Used in Leo's hybrid emotion enrichment pipeline
