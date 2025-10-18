# Audio Assets for Scene_Reflect

This directory contains audio files for the Reflect scene's adaptive ambient system.

## ✅ Current Files

You have added:
- `pigBreathing.mp3` - Breathing loop (will use first 4 seconds)
- `chime.mp3` - Completion chime (will use first 3 seconds)
- `inkRipple.mp3` - Keystroke sound (will use first 800ms)

## 📋 Still Needed

### `ambient.mp3`
- **Type**: Looping ambient base layer
- **Duration**: Any (will loop)
- **Volume**: 0.3 (30%)
- **Purpose**: Persistent background atmosphere
- **Notes**: Calming, minimal melody, suitable for contemplation

### `windSoft.mp3`
- **Type**: Looping wind pad
- **Duration**: Any (will loop)
- **Volume**: 0-0.25 (variable, responds to arousal)
- **Purpose**: Dynamic layer that follows user's typing/voice intensity
- **Notes**: Airy, textural, non-melodic

## 🎵 Audio Sprite Configuration

The system uses Howler.js audio sprites to trim files automatically:

- **pigBreathing.mp3**: Loops first 4 seconds continuously
- **inkRipple.mp3**: Plays first 800ms on each keystroke
- **chime.mp3**: Plays first 3 seconds on submission

If your files are longer, they'll be automatically trimmed. If shorter, the entire file plays.

## 🔧 Manual Trimming (Optional)

If you want to optimize file sizes, you can manually trim to these lengths:

```bash
# Using ffmpeg (if installed):
ffmpeg -i pigBreathing.mp3 -t 4 -c copy pigBreathing_trimmed.mp3
ffmpeg -i inkRipple.mp3 -t 0.8 -c copy inkRipple_trimmed.mp3
ffmpeg -i chime.mp3 -t 3 -c copy chime_trimmed.mp3
```

But this is **optional** - the sprites handle it automatically!
