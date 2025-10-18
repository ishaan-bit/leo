/**
 * Adaptive ambient audio system for Scene_Reflect
 * Responds to behavioral metrics in real-time
 */

import { Howl } from 'howler';
import type { AffectVector, AdaptiveResponse } from '@/lib/behavioral/metrics';
import { mapAffectToResponse } from '@/lib/behavioral/metrics';

class AdaptiveAmbientSystem {
  private initialized = false;
  private ambientLayer: Howl | null = null;
  private pigBreathingLayer: Howl | null = null;
  private inkRippleSound: Howl | null = null;
  private windPadLayer: Howl | null = null;
  private chimeTail: Howl | null = null;
  
  private currentResponse: AdaptiveResponse | null = null;
  private fadeInProgress = false;

  /**
   * Initialize all audio layers
   * Gracefully handles missing audio files
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      // Helper to create Howl with error handling
      const createHowl = (config: any) => {
        const howl = new Howl({
          ...config,
          onloaderror: (id: any, error: any) => {
            console.warn(`Audio file not found: ${config.src[0]} (gracefully continuing)`);
          },
          onplayerror: (id: any, error: any) => {
            console.warn(`Audio playback failed: ${config.src[0]} (gracefully continuing)`);
          },
        });
        return howl;
      };

      // Ambient base layer (persistent from global audio)
      this.ambientLayer = createHowl({
        src: ['/audio/ambient.mp3'],
        loop: true,
        volume: 0.3,
        preload: true,
      });

      // Pig breathing loop (4-second cycle recommended)
      this.pigBreathingLayer = createHowl({
        src: ['/audio/pigBreathing.mp3'],
        loop: true,
        volume: 0.2,
        preload: true,
        sprite: {
          breath: [0, 4000, true], // 4-second loop if file is longer
        },
      });

      // Ink ripple effect (one-shot, ~0.5-0.8s recommended)
      this.inkRippleSound = createHowl({
        src: ['/audio/inkRipple.mp3'],
        volume: 0.15,
        preload: true,
        sprite: {
          ripple: [0, 800], // Use first 800ms if file is longer
        },
      });

      // Wind pad (tempo-responsive)
      this.windPadLayer = createHowl({
        src: ['/audio/windSoft.mp3'],
        loop: true,
        volume: 0,
        preload: true,
      });

      // Chime tail (completion, 1-3s recommended)
      this.chimeTail = createHowl({
        src: ['/audio/chime.mp3'],
        volume: 0.4,
        preload: true,
        sprite: {
          tail: [0, 3000], // Use first 3 seconds if file is longer
        },
      });

      // Start ambient and breathing (safe play - won't crash if files missing)
      try {
        this.ambientLayer?.play();
        // Play the 4-second breathing sprite on loop
        if (this.pigBreathingLayer) {
          this.pigBreathingLayer.play('breath');
        }
        this.windPadLayer?.play();
      } catch (e) {
        console.warn('Audio autoplay blocked or files missing - continuing silently');
      }

      this.initialized = true;
      console.log('🎵 Adaptive ambient system initialized (audio files optional)');
    } catch (error) {
      console.error('Failed to initialize adaptive ambient system:', error);
      this.initialized = true; // Mark as initialized to prevent retry loops
    }
  }

  /**
   * Play ink ripple sound on keystroke
   */
  playInkRipple(): void {
    if (this.inkRippleSound && this.initialized) {
      // Play the 800ms ripple sprite
      this.inkRippleSound.play('ripple');
    }
  }

  /**
   * Play chime on completion
   */
  playChime(): void {
    if (this.chimeTail && this.initialized) {
      // Play the 3-second chime sprite
      this.chimeTail.play('tail');
    }
  }

  /**
   * Update audio parameters based on affect vector
   * Smoothly transitions between states
   */
  updateFromAffect(affect: AffectVector): void {
    if (!this.initialized) return;

    const response = mapAffectToResponse(affect);
    this.currentResponse = response;

    // Update ambient tempo (arousal drives speed)
    if (this.ambientLayer) {
      this.ambientLayer.rate(response.ambientTempo);
    }

    // Update wind pad volume and tempo (follows arousal)
    if (this.windPadLayer) {
      const targetWindVolume = response.particleSpeed * 0.25;
      this.smoothFade(this.windPadLayer, targetWindVolume, 1000);
      this.windPadLayer.rate(response.ambientTempo);
    }

    // Update ambient warmth (valence drives tone)
    // In a full implementation, this would crossfade between warm/cool stems
    // For now, we adjust volume based on warmth
    if (this.ambientLayer) {
      const warmthVolume = 0.2 + (response.ambientWarmth * 0.2);
      this.smoothFade(this.ambientLayer, warmthVolume, 2000);
    }
  }

  /**
   * Smooth fade to target volume
   */
  private smoothFade(sound: Howl, targetVolume: number, duration: number): void {
    if (this.fadeInProgress) return;
    
    this.fadeInProgress = true;
    sound.fade(sound.volume(), targetVolume, duration);
    
    setTimeout(() => {
      this.fadeInProgress = false;
    }, duration);
  }

  /**
   * Suspend all audio (pause scene)
   */
  suspend(): void {
    this.ambientLayer?.pause();
    this.pigBreathingLayer?.pause();
    this.windPadLayer?.pause();
  }

  /**
   * Resume all audio
   */
  resume(): void {
    this.ambientLayer?.play();
    this.pigBreathingLayer?.play();
    this.windPadLayer?.play();
  }

  /**
   * Stop all audio and cleanup
   */
  stop(): void {
    this.ambientLayer?.stop();
    this.pigBreathingLayer?.stop();
    this.windPadLayer?.stop();
    this.inkRippleSound?.unload();
    this.chimeTail?.unload();
    
    this.initialized = false;
  }

  /**
   * Get current adaptive response
   */
  getCurrentResponse(): AdaptiveResponse | null {
    return this.currentResponse;
  }
}

// Singleton instance
let instance: AdaptiveAmbientSystem | null = null;

export function getAdaptiveAmbientSystem(): AdaptiveAmbientSystem {
  if (!instance) {
    instance = new AdaptiveAmbientSystem();
  }
  return instance;
}

export default AdaptiveAmbientSystem;
