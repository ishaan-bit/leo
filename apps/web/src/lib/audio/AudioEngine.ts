/**
 * AudioEngine.ts
 * Singleton WebAudio-based engine that persists across route navigation
 * Manages ambient music stems and crossfading without restarts
 */

import { Howl, Howler } from 'howler';

interface AudioStem {
  howl: Howl | null;
  name: string;
  volume: number;
}

class AudioEngineInstance {
  private static instance: AudioEngineInstance | null = null;
  private stems: Map<string, AudioStem> = new Map();
  private currentStem: string | null = null;
  private initialized = false;
  private suspended = false;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): AudioEngineInstance {
    if (!AudioEngineInstance.instance) {
      AudioEngineInstance.instance = new AudioEngineInstance();
    }
    return AudioEngineInstance.instance;
  }

  /**
   * Initialize audio engine with context
   * Safe to call multiple times (guards against re-init)
   */
  async init(): Promise<void> {
    if (this.initialized) {
      console.log('[AudioEngine] Already initialized');
      return;
    }

    console.log('[AudioEngine] Initializing...');

    // Preload ambient stems
    this.stems.set('ambient', {
      howl: new Howl({
        src: ['/audio/ambient.mp3'],
        loop: true,
        volume: 0.4,
        preload: true,
      }),
      name: 'ambient',
      volume: 0.4,
    });

    this.stems.set('calm', {
      howl: new Howl({
        src: ['/audio/ambient.mp3'], // Using same ambient for now
        loop: true,
        volume: 0,
        preload: true,
      }),
      name: 'calm',
      volume: 0,
    });

    this.stems.set('bright', {
      howl: new Howl({
        src: ['/audio/ambient.mp3'], // Using same ambient for now
        loop: true,
        volume: 0,
        preload: true,
      }),
      name: 'bright',
      volume: 0,
    });

    this.initialized = true;
    console.log('[AudioEngine] Initialized with', this.stems.size, 'stems');
  }

  /**
   * Start playing ambient layer
   */
  playAmbient(seed?: string): void {
    if (!this.initialized || this.suspended) return;

    const stem = this.stems.get('ambient');
    if (stem?.howl && !stem.howl.playing()) {
      stem.howl.play();
      this.currentStem = 'ambient';
      console.log('[AudioEngine] Playing ambient');
    }
  }

  /**
   * Crossfade to a different pad/stem
   * @param stemName - 'calm' | 'bright' | 'ambient'
   * @param duration - fade duration in ms
   */
  crossfadeTo(stemName: string, duration = 2000): void {
    if (!this.initialized || this.suspended) return;

    const targetStem = this.stems.get(stemName);
    if (!targetStem?.howl) {
      console.warn('[AudioEngine] Stem not found:', stemName);
      return;
    }

    // Fade out current
    if (this.currentStem && this.currentStem !== stemName) {
      const currentStemObj = this.stems.get(this.currentStem);
      if (currentStemObj?.howl) {
        currentStemObj.howl.fade(currentStemObj.volume, 0, duration);
        setTimeout(() => {
          currentStemObj.howl?.pause();
        }, duration);
      }
    }

    // Fade in target
    if (!targetStem.howl.playing()) {
      targetStem.howl.play();
    }
    targetStem.howl.fade(0, targetStem.volume, duration);
    this.currentStem = stemName;

    console.log('[AudioEngine] Crossfading to', stemName);
  }

  /**
   * Adjust tempo (rate) - affects playback speed
   */
  setTempo(bpm: number): void {
    if (!this.initialized || this.suspended) return;

    // Map BPM (60-120) to rate (0.8-1.2)
    const rate = 0.8 + ((bpm - 60) / 60) * 0.4;
    const clampedRate = Math.max(0.8, Math.min(1.2, rate));

    this.stems.forEach((stem) => {
      if (stem.howl?.playing()) {
        stem.howl.rate(clampedRate);
      }
    });
  }

  /**
   * Set warmth (affects which stem is active)
   * 0 = calm/cool, 1 = bright/warm
   */
  setWarmth(value: number): void {
    const clamped = Math.max(0, Math.min(1, value));
    
    if (clamped < 0.4) {
      this.crossfadeTo('calm');
    } else if (clamped > 0.6) {
      this.crossfadeTo('bright');
    } else {
      this.crossfadeTo('ambient');
    }
  }

  /**
   * Suspend audio (pause all)
   */
  suspend(): void {
    this.suspended = true;
    this.stems.forEach((stem) => {
      stem.howl?.pause();
    });
    console.log('[AudioEngine] Suspended');
  }

  /**
   * Resume audio
   */
  resume(): void {
    this.suspended = false;
    if (this.currentStem) {
      const stem = this.stems.get(this.currentStem);
      stem?.howl?.play();
    }
    console.log('[AudioEngine] Resumed');
  }

  /**
   * Set global volume
   */
  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    Howler.volume(clamped);
  }

  /**
   * Stop all audio
   */
  stopAll(): void {
    this.stems.forEach((stem) => {
      stem.howl?.stop();
    });
    this.currentStem = null;
  }

  /**
   * Check if audio is playing
   */
  isPlaying(): boolean {
    return this.stems.get(this.currentStem || '')?.howl?.playing() || false;
  }
}

// Export singleton instance
export const AudioEngine = AudioEngineInstance.getInstance();
