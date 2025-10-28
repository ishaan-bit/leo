# Emotion Calibration & Song Fallback Updates - Implementation Summary

## Status: PARTIALLY IMPLEMENTED ✅

### ✅ Completed
1. **Urban India Calibration Module Created**
   - File: `enrichment-worker/src/modules/urban_india_calibration.py`
   - Implements all valence/arousal recalibration rules
   - Willcox Wheel override logic (Sad→Lonely→Isolated)
   - Language detection refinement (en vs mixed)
   - Congruence recomputation

### ⏳ Pending Integration

#### 1. Integrate Calibrator into Hybrid Scorer
**File**: `enrichment-worker/src/modules/hybrid_scorer.py`

Add after line ~100 (in `__init__` method):
```python
# Import urban India calibrator
from .urban_india_calibration import get_calibrator
self.calibrator = get_calibrator()
```

Add in `enrich()` method (after initial V/A scoring, before wheel classification):
```python
# Apply urban India calibration
calibrated_v, calibrated_a, cal_meta = self.calibrator.calibrate_valence_arousal(
    text=text,
    initial_valence=initial_valence,
    initial_arousal=initial_arousal
)

# Use calibrated values going forward
valence = calibrated_v
arousal = calibrated_a

# Log calibration metadata
if cal_meta['adjustments']:
    print(f"[Urban Calibration] {', '.join(cal_meta['adjustments'])}")
```

Add after wheel classification:
```python
# Apply wheel override for urban context
overridden_wheel, override_meta = self.calibrator.override_wheel(
    text=text,
    valence=valence,
    initial_wheel=wheel_result
)

if override_meta['override_applied']:
    print(f"[Wheel Override] {override_meta['reason']}")
    wheel_result = overridden_wheel

# Recompute congruence after overrides
congruence = self.calibrator.recompute_congruence(
    wheel=wheel_result,
    valence=valence,
    arousal=arousal
)
```

#### 2. Update Song Worker Fallbacks
**File**: `song-worker/main.py`

Replace fallback logic (lines ~463-503) with curated artist selections:

**English Fallbacks** (Pink Floyd, BB King, Chet Baker, Simon & Garfunkel):
```python
# Sad/Low Valence fallbacks
if valence < -0.2:
    if arousal > 0.5:
        parsed['en'] = {
            "title": "Comfortably Numb",
            "artist": "Pink Floyd",
            "year": 1979,
            "why": "Emotionally numb but seeking comfort"
        }
    else:
        parsed['en'] = {
            "title": "The Sound of Silence",
            "artist": "Simon & Garfunkel",
            "year": 1964,
            "why": "Introspective solitude and reflection"
        }
# Happy/High Valence fallbacks
elif valence > 0.3:
    if arousal > 0.6:
        parsed['en'] = {
            "title": "Bridge Over Troubled Water",
            "artist": "Simon & Garfunkel",
            "year": 1970,
            "why": "Uplifting and supportive energy"
        }
    else:
        parsed['en'] = {
            "title": "My Funny Valentine",
            "artist": "Chet Baker",
            "year": 1954,
            "why": "Warm, tender, and comforting"
        }
# Neutral/Mixed fallbacks
else:
    if arousal > 0.6:
        parsed['en'] = {
            "title": "The Thrill Is Gone",
            "artist": "B.B. King",
            "year": 1969,
            "why": "Soulful intensity and emotional depth"
        }
    else:
        parsed['en'] = {
            "title": "Wish You Were Here",
            "artist": "Pink Floyd",
            "year": 1975,
            "why": "Reflective longing and nostalgia"
        }
```

**Hindi Fallbacks** (Mohd Rafi, Mehdi Hassan, Jagjit Singh, Kishore Kumar):
```python
# Sad/Low Valence fallbacks
if valence < -0.2:
    if arousal > 0.5:
        parsed['hi'] = {
            "title": "Chalo Ek Baar Phir Se",
            "artist": "Mahendra Kapoor",
            "year": 1972,
            "why": "Hopeful sadness with yearning"
        }
    else:
        parsed['hi'] = {
            "title": "Aaj Jaane Ki Zid Na Karo",
            "artist": "Farida Khanum",
            "year": 1980,  # Classic ghazal
            "why": "Melancholic longing and intimacy"
        }
# Happy/High Valence fallbacks
elif valence > 0.3:
    if arousal > 0.6:
        parsed['hi'] = {
            "title": "O Haseena Zulfon Wali",
            "artist": "Mohammed Rafi",
            "year": 1966,
            "why": "Energetic romantic joy"
        }
    else:
        parsed['hi'] = {
            "title": "Hothon Se Chhoo Lo Tum",
            "artist": "Jagjit Singh",
            "year": 1982,
            "why": "Tender romantic warmth"
        }
# Neutral/Mixed fallbacks
else:
    if arousal > 0.6:
        parsed['hi'] = {
            "title": "Yeh Jo Mohabbat Hai",
            "artist": "Kishore Kumar",
            "year": 1972,
            "why": "Playful romantic intensity"
        }
    else:
        parsed['hi'] = {
            "title": "Ranjish Hi Sahi",
            "artist": "Mehdi Hassan",
            "year": 1978,
            "why": "Reflective melancholic ghazal"
        }
```

#### 3. Update Enrichment Style Guardrails
**File**: `enrichment-worker/src/prompts/stage2_prompt.py`

Add to system prompt (around line 21):
```python
STYLE GUARDRAILS (Urban India Ritual Tech):
- Tone: Grounded, observant, urban-cool. NO therapy clichés ("self-care", "journaling prompt", "mindfulness practice")
- Micro-rituals: Practical within 2 minutes, indoors-friendly, sensory-first (smell coffee, feel fabric, listen to rain)
- DISALLOW:
  * Voyeuristic prompts (listening to strangers' phone calls)
  * Public performativity (leaving notes for strangers, talking to shopkeepers about feelings)
  * Location assumptions (lakes, forests, ashrams, temples)
- PREFER:
  * Indoor sensory actions (lighting incense, touching cold water, dimming lights)
  * Private reflection (writing one word, humming a tune, closing eyes for 30 seconds)
  * Evening-compatible (no "morning routines" unless explicitly morning context)
```

#### 4. Willingness to Express Adjustment
**File**: `enrichment-worker/src/modules/hybrid_scorer.py`

Update willingness calculation (search for `willingness_to_express`):
```python
# Set to 0.3–0.5 for coherent, first-person reflective text length >120 chars
if len(text) > 120 and self._is_coherent_first_person(text):
    willingness_score = 0.3 + (min(len(text), 300) / 300) * 0.2  # 0.3-0.5 range
else:
    willingness_score = 0.2  # Low for short/incoherent text
```

Add helper method:
```python
def _is_coherent_first_person(self, text: str) -> bool:
    """Check if text is coherent first-person reflection"""
    first_person_markers = {'i', 'my', 'me', 'myself', 'mine'}
    tokens = set(text.lower().split())
    has_first_person = len(tokens & first_person_markers) > 0
    has_verbs = len([w for w in tokens if w.endswith(('ed', 'ing', 'es'))]) > 0
    return has_first_person and has_verbs
```

---

## Next Steps
1. **Integrate calibrator** into `hybrid_scorer.py` (10 min)
2. **Update song fallbacks** in `song-worker/main.py` (5 min)
3. **Update enrichment prompt** guardrails (5 min)
4. **Test with sample lonely reflection** to verify:
   - V/A calibration triggers correctly
   - Wheel override to Sad→Lonely→Isolated
   - Language detection works
   - Congruence is 0.75–0.85
   - Song fallbacks use curated artists
5. **Deploy workers** and monitor first 10 reflections

Would you like me to proceed with the integration steps?
