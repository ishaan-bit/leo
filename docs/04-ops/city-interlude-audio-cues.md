# City Interlude - Audio Cue Sheet

## Timeline Reference for Audio Design

### Phase 1: The Holding (0-14s)
**Emotional Tone**: Safe, cocooned, gentle

| Time | Visual Event | Audio Cue | Recommendation |
|------|--------------|-----------|----------------|
| 0s | Scene begins, warm blush background | **Fade in soft pad** | Single sustained note, heart-like warmth, 56 bpm |
| 1s | Copy appears: "Your moment has been held safe" | **Subtle swell** | +2dB lift on pad, gentle attack |
| 5s | Copy fades out | **Hold pad** | Maintain level, no change |
| 5-14s | Background cools to mauve, ripples expand | **Add faint chime every 2s** | Wind-bell texture, -30dB background hum enters |

**Audio Layers**:
- `heartbeat_pad.mp3` - 56 bpm, 5s loop, soft synth pad
- `wind_bell_sparse.mp3` - 2s interval, faint metallic chime

---

### Phase 2: The Breath Between Things (14-26s)
**Emotional Tone**: Opening, gentle expectancy

| Time | Visual Event | Audio Cue | Recommendation |
|------|--------------|-----------|----------------|
| 14-15s | Copy: "A quiet breath between things" | **Airy exhale sound** | Soft breath sample, blend with pad |
| 14-20s | Leo inhales/exhales (4s cycle), particles drift | **Wind texture enters** | Low-pass filtered air movement, subtle |
| 20s | Leo begins ascent | **Chord sustain** | Hold current harmonics, no pulse |
| 20-21s | Particles pause mid-air (gravity pause) | **All rhythm drops for 1 beat** | Silence percussion, maintain only pad drone |
| 21-26s | Particles resume slower | **Rhythm resumes softer** | Heartbeat returns at -6dB |

**Audio Layers**:
- `breath_exhale.mp3` - Single sample, triggered at 15s
- `wind_ambient.mp3` - 8s loop, stereo field, -25dB
- `heartbeat_pad.mp3` - Continues, dip to -6dB at 20s

---

### Phase 3: Time Holding Its Breath (26-34s)
**Emotional Tone**: Suspension, twilight stillness

| Time | Visual Event | Audio Cue | Recommendation |
|------|--------------|-----------|----------------|
| 26s | Copy: "And time holding its breath" | **Long sustain pad, no pulse** | Remove all rhythm for 2s, pure drone |
| 26-28s | Twilight gradient, Leo rises to upper-third | **Sub-bass hum builds** | 40-60 Hz sine, -20dB → -12dB over 2s |
| 28-32s | Stars brighten, motes hover | **Subtle restart of pulse** | Heartbeat returns at -8dB, slower (50 bpm) |
| 32-34s | Preparing for city reveal | **Wind passes left → right** | Stereo sweep, 2s duration, foley texture |

**Audio Layers**:
- `sustain_drone.mp3` - 8s pure tone, no attack
- `sub_bass_hum.mp3` - 60 Hz, slow build
- `wind_pass_lr.mp3` - Stereo sweep, triggered at 32s

---

### Phase 4: The Pulse of the City (34-42s → loop)
**Emotional Tone**: Alive, rhythmic, breathing metropolis

| Time | Visual Event | Audio Cue | Recommendation |
|------|--------------|-----------|----------------|
| 34s | Six towers slide up (staggered 0.4s) | **City hum enters** | Low-end drone, urban rumble, -18dB |
| 34-37s | Windows flicker on randomly | **Faint electrical crackles** | Sparse, 1-2 per second, panned L/R |
| 37s | City breathing begins (4s sine wave) | **Deep heartbeat every 4s** | Sub-bass pulse, synchronized with visual |
| 37-40s | Light wave travels across skyline | **City hum breathing in phase** | Amplitude modulation on hum, 4s period |
| 40s+ | **Suspended breath / Ready State LOOP** | **Continue 4s pulse indefinitely** | Loop until backend ready, no fade |

**Audio Layers**:
- `city_hum_night.mp3` - 30s loop, urban ambience, -18dB
- `electrical_crackle.mp3` - Random trigger, 5-10 per minute
- `deep_pulse_4s.mp3` - 4s loop, sub-bass, synchronized with visual sine
- `city_breathing.mp3` - Amplitude envelope on hum, 4s period

---

### When Stage 1 Completes (variable time)
**Emotional Tone**: Resolution, clarity

| Time | Visual Event | Audio Cue | Recommendation |
|------|--------------|-----------|----------------|
| +0s | One tower stays bright, others dim | **Isolation tone** | Sine wave matching tower color frequency |
| +2s | Hand-off to next scene | **Crossfade to next scene audio** | 2s fade, maintain sub-bass continuity |

**Audio Layers**:
- `tower_highlight_<emotion>.mp3` - Unique tone per emotion
  - Joyful (Vera): 440 Hz (A4), bright
  - Powerful (Vanta): 523 Hz (C5), bold
  - Peaceful (Haven): 349 Hz (F4), calm
  - Sad (Ashmere): 293 Hz (D4), somber
  - Mad (Vire): 587 Hz (D5), sharp
  - Scared (Sable): 369 Hz (F#4), tense

---

## Master Audio Mix Levels

| Layer | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Notes |
|-------|---------|---------|---------|---------|-------|
| Heartbeat Pad | -12dB | -18dB | -20dB | -24dB | Gradual fade as city emerges |
| Wind Bells | - | -30dB | -32dB | -35dB | Sparse, atmospheric |
| Wind Ambient | - | -25dB | -28dB | -30dB | Stereo field, subtle |
| Sub-Bass Hum | - | - | -12dB | -10dB | Builds in Phase 3, sustains in 4 |
| City Hum | - | - | - | -18dB | Only in Phase 4 |
| Deep Pulse | - | - | - | -15dB | 4s period, Phase 4 only |

## Sync Points (Critical for Visual Alignment)

### 4-Second City Pulse (Phase 4, 37s+)
Visual sine wave: `brightness = 0.2 + 0.4 * sin(t * π * 2 / 4)`

Audio must match exactly:
```
t = (currentTime - 37s) / 4s  // Normalized time in 4s period
amplitude = 0.6 + 0.4 * sin(t * π * 2)  // Audio gain envelope
```

**Implementation**:
```javascript
const startTime = 37000; // ms
const period = 4000; // 4s
const t = (Date.now() - sceneStartTime - startTime) / period;
const gain = 0.6 + 0.4 * Math.sin(t * Math.PI * 2);
audioNode.gain.value = gain;
```

### Per-Tower Offset (Phase 4, 37s+)
Each tower has 0.4s stagger:
- Vera (Joyful): +0.0s
- Vanta (Powerful): +0.4s
- Haven (Peaceful): +0.8s
- Ashmere (Sad): +1.2s
- Vire (Mad): +1.6s
- Sable (Scared): +2.0s

**Audio consideration**: Subtle stereo panning per tower, matching x-position

---

## Audio File Specifications

### Format
- **Container**: MP3 or WAV
- **Sample Rate**: 48 kHz
- **Bit Depth**: 24-bit (WAV) or 320 kbps (MP3)
- **Channels**: Stereo for ambience, mono for pads

### Loop Points
- **Heartbeat Pad**: 5s loop, seamless crossfade
- **City Hum**: 30s loop, fade in/out 1s
- **Deep Pulse**: 4s exact loop, hard cut (no fade)

### Naming Convention
```
/audio/interlude/
  heartbeat_pad_56bpm.mp3
  wind_bell_sparse.mp3
  wind_ambient_stereo.mp3
  breath_exhale.mp3
  sustain_drone_8s.mp3
  sub_bass_hum_60hz.mp3
  wind_pass_lr.mp3
  city_hum_night_30s.mp3
  electrical_crackle_01.mp3
  deep_pulse_4s.mp3
  city_breathing_envelope.mp3
  tower_highlight_joyful.mp3
  tower_highlight_powerful.mp3
  tower_highlight_peaceful.mp3
  tower_highlight_sad.mp3
  tower_highlight_mad.mp3
  tower_highlight_scared.mp3
```

---

## Integration Code Snippet

```typescript
// In CityInterlude.tsx
import { getAdaptiveAmbientSystem } from '@/lib/audio/AdaptiveAmbientSystem';

const audioSystem = getAdaptiveAmbientSystem();

useEffect(() => {
  // Phase 1: Heartbeat pad
  if (currentPhase === 1) {
    audioSystem.playLayer('heartbeat_pad_56bpm', { 
      volume: 0.3, 
      loop: true,
      fadeIn: 2000 
    });
    
    // Wind bells at 5s
    if (currentBeat === 2) {
      audioSystem.playLayer('wind_bell_sparse', { 
        volume: 0.1, 
        loop: true 
      });
    }
  }
  
  // Phase 2: Add wind ambient
  if (currentPhase === 2) {
    audioSystem.playLayer('wind_ambient_stereo', { 
      volume: 0.15, 
      loop: true 
    });
    
    // Breath exhale at 15s
    if (elapsedTime >= 15000 && elapsedTime < 15100) {
      audioSystem.playOneShot('breath_exhale', { volume: 0.4 });
    }
  }
  
  // Phase 3: Sub-bass hum
  if (currentPhase === 3) {
    audioSystem.playLayer('sub_bass_hum_60hz', { 
      volume: 0.2, 
      loop: true,
      fadeIn: 2000 
    });
    
    // Wind pass at 32s
    if (elapsedTime >= 32000 && elapsedTime < 32100) {
      audioSystem.playOneShot('wind_pass_lr', { volume: 0.3 });
    }
  }
  
  // Phase 4: City breathing
  if (currentPhase === 4) {
    audioSystem.playLayer('city_hum_night_30s', { 
      volume: 0.25, 
      loop: true 
    });
    
    // Deep pulse synchronized with visual
    const pulseLayer = audioSystem.playLayer('deep_pulse_4s', { 
      volume: 0.3, 
      loop: true 
    });
    
    // Sync pulse with visual sine wave
    const syncInterval = setInterval(() => {
      const t = (Date.now() - startTimeRef.current - 37000) / 4000;
      const gain = 0.6 + 0.4 * Math.sin(t * Math.PI * 2);
      audioSystem.setLayerVolume('city_hum_night_30s', 0.25 * gain);
    }, 50); // 20fps sync
    
    return () => clearInterval(syncInterval);
  }
}, [currentPhase, elapsedTime]);

// When primary emotion identified
useEffect(() => {
  if (primaryEmotion) {
    const towerAudio = `tower_highlight_${primaryEmotion}`;
    audioSystem.playOneShot(towerAudio, { 
      volume: 0.5,
      fadeIn: 1000 
    });
  }
}, [primaryEmotion]);

// Cleanup on unmount
useEffect(() => {
  return () => {
    audioSystem.stopAllLayers({ fadeOut: 2000 });
  };
}, []);
```

---

## Testing Checklist

- [ ] Heartbeat pad fades in smoothly at 0s
- [ ] Wind bells enter at 5s without click/pop
- [ ] Breath exhale sample triggers at 15s
- [ ] Rhythm drops for 1 beat at 20s (particles pause)
- [ ] Sub-bass hum builds from 26-28s
- [ ] City hum enters at 34s as towers slide up
- [ ] Deep pulse syncs with visual sine wave (4s period)
- [ ] City breathing amplitude modulation matches window brightness
- [ ] Tower highlight tone plays when primary emotion identified
- [ ] All audio stops cleanly on scene exit (no hanging notes)
- [ ] Sound toggle mutes all layers immediately
- [ ] Audio loops seamlessly (no pops or gaps)

---

**Status**: 🎵 Ready for audio production
**Priority**: Medium (can ship without audio, add in v1.1)
**Audio Team Contact**: [Add contact]
**Estimated production time**: 4-6 hours (recording + mixing)
