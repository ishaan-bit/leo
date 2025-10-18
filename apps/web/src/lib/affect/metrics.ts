/**
 * metrics.ts
 * Pure functions to compute affect dimensions from gesture data
 * All outputs are normalized and clamped to safe ranges
 */

import type { AffectVector } from '@/providers/SceneStateProvider';

/**
 * Calculate arousal (energy level) from swipe speed samples
 * @param speedSamples - array of velocity measurements in px/ms
 * @returns 0 (calm) to 1 (energized)
 */
export function calcArousalFromSwipe(speedSamples: number[]): number {
  if (speedSamples.length === 0) return 0.5;
  
  const avgSpeed = speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length;
  const maxSpeed = Math.max(...speedSamples);
  
  // Normalize: slow = 0-50px/ms, fast = 200+ px/ms
  const normalized = (avgSpeed * 0.7 + maxSpeed * 0.3) / 250;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Calculate depth (contemplative engagement) from hold duration
 * @param holdMs - milliseconds of continuous press
 * @returns 0 (surface) to 1 (profound)
 */
export function calcDepthFromHold(holdMs: number): number {
  // Longer holds = more depth
  // 0-500ms = surface, 3000+ms = profound
  const normalized = holdMs / 3000;
  return Math.max(0, Math.min(1, normalized));
}

/**
 * Calculate clarity from release behavior
 * @param slope - rate of return to stillness (lower = more deliberate)
 * @returns 0 (confused/rushed) to 1 (clear/intentional)
 */
export function calcClarityFromReleaseSlope(slope: number): number {
  // Lower slope (gentler release) = higher clarity
  // Invert and normalize: sharp = 0, gentle = 1
  const inverted = 1 - Math.min(1, slope / 100);
  return Math.max(0, Math.min(1, inverted));
}

/**
 * Calculate authenticity from path stability (drag smoothness)
 * @param smoothness - 0 (erratic) to 1 (smooth/confident)
 * @returns 0 (performative) to 1 (genuine)
 */
export function calcAuthenticityFromPathStability(smoothness: number): number {
  // Smoother, more confident paths = higher authenticity
  return Math.max(0, Math.min(1, smoothness));
}

/**
 * Calculate effort from session metrics
 * @param timeMs - total interaction time
 * @param inputsCount - number of discrete interactions
 * @returns 0 (effortless) to 1 (strenuous)
 */
export function calcEffortFromSession(timeMs: number, inputsCount: number): number {
  // More inputs + longer time = more effort
  // Normalize: 0-10 inputs over 0-60s
  const inputScore = Math.min(1, inputsCount / 10);
  const timeScore = Math.min(1, timeMs / 60000);
  return Math.max(0, Math.min(1, (inputScore + timeScore) / 2));
}

/**
 * Calculate valence from light temperature preference
 * @param pref - user's hover zone preference
 * @returns -1 (melancholic) to +1 (joyful)
 */
export function calcValenceFromLightTemperature(
  pref: 'dawn' | 'noon' | 'dusk'
): number {
  const map = {
    dawn: -0.3,  // cool/contemplative
    noon: 0.5,   // bright/energetic
    dusk: -0.1,  // warm/nostalgic
  };
  return map[pref];
}

/**
 * Calculate path smoothness from point samples (for authenticity)
 * Uses simplified RDP-like variance measure
 */
export function calcPathSmoothness(points: { x: number; y: number }[]): number {
  if (points.length < 3) return 0.5;
  
  let totalDeviation = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Calculate deviation from straight line
    const expectedX = prev.x + (next.x - prev.x) * 0.5;
    const expectedY = prev.y + (next.y - prev.y) * 0.5;
    const deviation = Math.sqrt(
      Math.pow(curr.x - expectedX, 2) + Math.pow(curr.y - expectedY, 2)
    );
    totalDeviation += deviation;
  }
  
  const avgDeviation = totalDeviation / (points.length - 2);
  // Lower deviation = smoother = higher score
  const smoothness = 1 - Math.min(1, avgDeviation / 50);
  return Math.max(0, Math.min(1, smoothness));
}

/**
 * Compose complete affect vector from gesture metrics
 */
export function composeAffect(
  arousal: number,
  depth: number,
  clarity: number,
  authenticity: number,
  effort: number,
  valence: number,
  seed?: string
): AffectVector {
  return {
    valence: Math.max(-1, Math.min(1, valence)),
    arousal: Math.max(0, Math.min(1, arousal)),
    depth: Math.max(0, Math.min(1, depth)),
    clarity: Math.max(0, Math.min(1, clarity)),
    authenticity: Math.max(0, Math.min(1, authenticity)),
    effort: Math.max(0, Math.min(1, effort)),
    seed,
  };
}
