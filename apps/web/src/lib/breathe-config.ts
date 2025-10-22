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

// Base presets by primary emotion (matched to Building Zones)
export const PRIMARY_PRESETS: Record<PrimaryEmotion, PrimaryPreset> = {
  joyful: {
    color: '#FFD479', // Warm amber-gold (Haven)
    audio: '/audio/breathe/low_whoosh_joy.mp3',
    cycle: { in: 3, h1: 0.5, out: 3, h2: 0.5 }, // Light & quick
    light: { mode: 'bloom', intensity: [0.4, 1.0] },
  },
  sad: {
    color: '#637DFF', // Indigo-blue (Ashmere)
    audio: '/audio/breathe/hum_rain_sad.mp3',
    cycle: { in: 6, h1: 1, out: 6, h2: 1 }, // Slow & heavy
    light: { mode: 'sink', intensity: [0.25, 0.8] },
  },
  mad: {
    color: '#FF4949', // Deep red (Sable)
    audio: '/audio/breathe/crackle_mad.mp3',
    cycle: { in: 2, h1: 0.3, out: 2, h2: 0.3 }, // Sharp & forceful
    light: { mode: 'strobe', intensity: [0.5, 1.0], strobe: true },
  },
  scared: {
    color: '#A770FF', // Purple-grey (Vanta)
    audio: '/audio/breathe/tremolo_fear.mp3',
    cycle: { in: 2, h1: 0.5, out: 4, h2: 0.5 }, // Uneven, trembling
    light: { mode: 'jitter', intensity: [0.35, 0.95], jitter: true },
  },
  peaceful: {
    color: '#4FFFE3', // Soft teal (Vera)
    audio: '/audio/breathe/ocean_peace.mp3',
    cycle: { in: 4, h1: 1, out: 4, h2: 1 }, // Balanced
    light: { mode: 'drift', intensity: [0.3, 0.9] },
  },
  powerful: {
    color: '#FF77C4', // Electric white-gold (Vire)
    audio: '/audio/breathe/resonant_power.mp3',
    cycle: { in: 5, h1: 1, out: 5, h2: 1 }, // Expanding
    light: { mode: 'surge', intensity: [0.45, 1.0] },
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
  
  // Safely get modifier, fallback to 'default' if secondary not found
  const secondaryKey = secondary?.toLowerCase() || 'default';
  const mod = SECONDARY_MODIFIERS[secondaryKey] || SECONDARY_MODIFIERS['default'];

  // Apply deltas to cycle (with safe access)
  const cycle: BreatheCycle = {
    in: Math.max(1, base.cycle.in + (mod?.cycleDelta?.in || 0)),
    h1: Math.max(0.5, base.cycle.h1 + (mod?.cycleDelta?.h1 || 0)),
    out: Math.max(1, base.cycle.out + (mod?.cycleDelta?.out || 0)),
    h2: Math.max(0.5, base.cycle.h2 + (mod?.cycleDelta?.h2 || 0)),
  };

  // Merge light config (with safe access)
  const light: LightConfig = {
    ...base.light,
    strobe: mod?.light?.strobe || base.light.strobe,
    jitter: mod?.light?.jitter || base.light.jitter,
    intensity: [
      Math.max(0.1, base.light.intensity[0] + (mod?.light?.amp || 0)),
      Math.min(1.0, base.light.intensity[1] + (mod?.light?.amp || 0)),
    ],
  };

  return {
    cycle,
    light,
    color: base.color,
    audio: base.audio,
    cueHint: mod?.cueHint || 'steady',
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
