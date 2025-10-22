/**
 * Breathing Sequence Configuration
 * Based on Willcox 6 primaries + secondary modifiers
 */

export type PrimaryEmotion = 'joyful' | 'sad' | 'mad' | 'scared' | 'powerful' | 'peaceful';

export interface BreatheCycle {
  in: number;      // Inhale duration (seconds)
  h1: number;      // Hold after inhale (seconds)
  out: number;     // Exhale duration (seconds)
  h2: number;      // Hold after exhale (seconds)
}

export interface LightConfig {
  mode: 'bloom' | 'sink' | 'strobe' | 'jitter' | 'surge' | 'drift';
  intensity: [number, number]; // [min, max]
  strobe?: boolean;
  jitter?: boolean;
  amp?: number;
}

export interface PrimaryPreset {
  color: string;
  audio: string;
  cycle: BreatheCycle;
  light: LightConfig;
}

export interface SecondaryModifier {
  cycleDelta: Partial<BreatheCycle>;
  light: Partial<LightConfig>;
  cueHint: string;
}

// Base presets by primary emotion
export const PRIMARY_PRESETS: Record<PrimaryEmotion, PrimaryPreset> = {
  joyful: {
    color: '#FFD479',
    audio: '/audio/breathe/low_whoosh_joy.mp3',
    cycle: { in: 4, h1: 1, out: 4, h2: 1 },
    light: { mode: 'bloom', intensity: [0.4, 1.0] },
  },
  sad: {
    color: '#637DFF',
    audio: '/audio/breathe/hum_rain_sad.mp3',
    cycle: { in: 5, h1: 2, out: 6, h2: 2 },
    light: { mode: 'sink', intensity: [0.25, 0.8] },
  },
  mad: {
    color: '#FF4949',
    audio: '/audio/breathe/crackle_mad.mp3',
    cycle: { in: 3, h1: 0.5, out: 3, h2: 0.5 },
    light: { mode: 'strobe', intensity: [0.5, 1.0], strobe: true },
  },
  scared: {
    color: '#A770FF',
    audio: '/audio/breathe/tremolo_fear.mp3',
    cycle: { in: 2, h1: 1, out: 3, h2: 1 },
    light: { mode: 'jitter', intensity: [0.35, 0.95], jitter: true },
  },
  powerful: {
    color: '#FF77C4',
    audio: '/audio/breathe/resonant_power.mp3',
    cycle: { in: 4, h1: 2, out: 4, h2: 2 },
    light: { mode: 'surge', intensity: [0.45, 1.0] },
  },
  peaceful: {
    color: '#4FFFE3',
    audio: '/audio/breathe/ocean_peace.mp3',
    cycle: { in: 5, h1: 2, out: 5, h2: 2 },
    light: { mode: 'drift', intensity: [0.3, 0.9] },
  },
};

// Secondary emotion modifiers (additive tweaks)
export const SECONDARY_MODIFIERS: Record<string, SecondaryModifier> = {
  optimistic: { cycleDelta: { in: -0.5, out: -0.5 }, light: { amp: 0.05 }, cueHint: 'bright' },
  proud: { cycleDelta: { h1: 0.5, h2: 0.5 }, light: { amp: 0.05 }, cueHint: 'steady' },
  content: { cycleDelta: { in: 0.5, out: 0.5 }, light: { amp: -0.05 }, cueHint: 'smooth' },
  relaxed: { cycleDelta: { out: 0.5 }, light: { amp: -0.05 }, cueHint: 'soft' },
  lonely: { cycleDelta: { out: 1.0 }, light: { amp: -0.03 }, cueHint: 'heavy' },
  empty: { cycleDelta: { out: 1.0, h2: 0.5 }, light: { amp: -0.04 }, cueHint: 'hollow' },
  numb: { cycleDelta: { in: 0.5, out: 0.5 }, light: { amp: -0.06 }, cueHint: 'flat' },
  angry: { cycleDelta: { in: -0.5, out: -0.5 }, light: { strobe: true, amp: 0.02 }, cueHint: 'sharp' },
  annoyed: { cycleDelta: { in: -0.3, out: -0.3 }, light: { strobe: true }, cueHint: 'spiky' },
  anxious: { cycleDelta: { in: -0.7, h1: 0.3 }, light: { jitter: true }, cueHint: 'narrow' },
  fearful: { cycleDelta: { in: -0.5, out: -0.5 }, light: { jitter: true }, cueHint: 'tight' },
  confident: { cycleDelta: { h1: 0.3, h2: 0.3 }, light: { amp: 0.04 }, cueHint: 'grounded' },
  serene: { cycleDelta: { in: 0.5, out: 0.5 }, light: { amp: -0.05 }, cueHint: 'wide' },
  default: { cycleDelta: {}, light: {}, cueHint: 'neutral' },
};

// Fallback invoked words if enrichment incomplete
export const FALLBACK_WORDS = ['open', 'soft', 'steady', 'clear', 'light', 'still'];

// Word drift direction by primary (in pixels, Y-axis)
export const WORD_DRIFT_PX: Record<PrimaryEmotion, number> = {
  joyful: -20,
  sad: 15,
  mad: -10,
  scared: 10,
  powerful: 0,
  peaceful: -5,
};

/**
 * Compute effective breathing parameters
 */
export function computeBreatheParams(
  primary: PrimaryEmotion,
  secondary?: string
): { cycle: BreatheCycle; light: LightConfig; color: string; audio: string; cueHint: string } {
  const base = PRIMARY_PRESETS[primary];
  const mod = SECONDARY_MODIFIERS[secondary?.toLowerCase() || 'default'];

  // Apply deltas to cycle
  const cycle: BreatheCycle = {
    in: Math.max(1, base.cycle.in + (mod.cycleDelta.in || 0)),
    h1: Math.max(0.5, base.cycle.h1 + (mod.cycleDelta.h1 || 0)),
    out: Math.max(1, base.cycle.out + (mod.cycleDelta.out || 0)),
    h2: Math.max(0.5, base.cycle.h2 + (mod.cycleDelta.h2 || 0)),
  };

  // Merge light config
  const light: LightConfig = {
    ...base.light,
    strobe: mod.light.strobe || base.light.strobe,
    jitter: mod.light.jitter || base.light.jitter,
    intensity: [
      Math.max(0.1, base.light.intensity[0] + (mod.light.amp || 0)),
      Math.min(1.0, base.light.intensity[1] + (mod.light.amp || 0)),
    ],
  };

  return {
    cycle,
    light,
    color: base.color,
    audio: base.audio,
    cueHint: mod.cueHint,
  };
}

/**
 * Calculate total cycles (3-5 based on tempo)
 */
export function calculateTotalCycles(cycle: BreatheCycle): number {
  const totalDuration = cycle.in + cycle.h1 + cycle.out + cycle.h2;
  
  // Aim for ~40-60s total
  // Fast tempo (< 8s) → 5 cycles
  // Medium (8-12s) → 4 cycles  
  // Slow (> 12s) → 3 cycles
  if (totalDuration < 8) return 5;
  if (totalDuration < 12) return 4;
  return 3;
}
