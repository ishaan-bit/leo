/**
 * Dream timeline math and beat generation
 * Ensures proper timing for K=3–8 cores
 */

import type { TimelineConfig, DreamBeat, PrimaryEmotion } from './dream.types';
import { BUILDINGS } from './dream.config';

/**
 * Calculate timeline segments for given core count
 */
export function calculateTimeline(K: number): TimelineConfig {
  const duration = 18; // fixed total duration
  const takeoff = 2.0;
  const resolve = 3.5;
  
  // Drift varies by K
  let drift: number;
  if (K <= 4) {
    drift = 3.0;
  } else if (K <= 6) {
    drift = 2.5;
  } else {
    drift = 2.0;
  }
  
  // Calculate slot duration per core
  const slotDuration = (duration - takeoff - drift - resolve) / K;
  
  // Guard: slot must be >= 2.2s
  if (slotDuration < 2.2) {
    throw new Error(`Slot duration ${slotDuration.toFixed(2)}s < 2.2s minimum for K=${K}`);
  }
  
  return {
    duration,
    takeoff,
    drift,
    resolve,
    coresCount: K,
    slotDuration,
  };
}

/**
 * Determine K (core count) based on candidate pool size
 * Returns adjusted K that satisfies slot >= 2.2s constraint
 */
export function determineK(candidateCount: number, seedValue: number): number {
  const N = candidateCount;
  let K: number;
  
  if (N <= 3) {
    K = N; // build only if K >= 1
  } else if (N <= 5) {
    // prefer 4, but can be 3-4
    K = (seedValue % 2 === 0) ? 4 : 3;
    K = Math.min(K, N);
  } else if (N <= 8) {
    // prefer 5, range 4-6
    const options = [4, 5, 6];
    K = options[seedValue % options.length];
    K = Math.min(K, N);
  } else {
    // N >= 9, prefer 7, range 6-8
    const options = [6, 7, 8];
    K = options[seedValue % options.length];
    K = Math.min(K, N);
  }
  
  // Validate slot constraint, decrement K if needed
  while (K > 0) {
    try {
      calculateTimeline(K);
      break; // constraint satisfied
    } catch {
      K--;
    }
  }
  
  return K;
}

/**
 * Generate beat timeline from selected cores
 */
export function generateBeats(
  selectedCores: Array<{
    momentId: string;
    primary: PrimaryEmotion;
    line: string;
  }>
): DreamBeat[] {
  const K = selectedCores.length;
  const timeline = calculateTimeline(K);
  
  const beats: DreamBeat[] = [];
  
  // Takeoff beat
  beats.push({
    t: 0,
    kind: 'takeoff',
  });
  
  // Drift beat
  beats.push({
    t: timeline.takeoff,
    kind: 'drift',
  });
  
  // Moment beats (one per core)
  const momentStartTime = timeline.takeoff + timeline.drift;
  for (let i = 0; i < K; i++) {
    const core = selectedCores[i];
    const building = BUILDINGS[core.primary];
    
    beats.push({
      t: momentStartTime + (i * timeline.slotDuration),
      kind: 'moment',
      building: building.name,
      momentId: core.momentId,
      line: core.line,
    });
  }
  
  // Resolve beat (focus on first core's building)
  const firstBuilding = BUILDINGS[selectedCores[0].primary];
  beats.push({
    t: timeline.duration - timeline.resolve,
    kind: 'resolve',
    focus: firstBuilding.name,
  });
  
  return beats;
}

/**
 * Validate beat timeline for QA
 */
export function validateBeats(beats: DreamBeat[], expectedK: number): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Count moment beats
  const momentBeats = beats.filter(b => b.kind === 'moment');
  if (momentBeats.length !== expectedK) {
    errors.push(`Expected ${expectedK} moment beats, got ${momentBeats.length}`);
  }
  
  // Check per-core dwell time (slot >= 2.2s)
  const timeline = calculateTimeline(expectedK);
  if (timeline.slotDuration < 2.2) {
    errors.push(`Slot duration ${timeline.slotDuration.toFixed(2)}s < 2.2s minimum`);
  }
  
  // Check total duration (17.7–18.3s tolerance)
  const lastBeat = beats[beats.length - 1];
  const totalDuration = lastBeat.t + 3.5; // resolve duration
  if (totalDuration < 17.7 || totalDuration > 18.3) {
    errors.push(`Total duration ${totalDuration.toFixed(1)}s outside 17.7-18.3s range`);
  }
  
  // Check beat ordering
  for (let i = 1; i < beats.length; i++) {
    if (beats[i].t <= beats[i - 1].t) {
      errors.push(`Beat ${i} timestamp ${beats[i].t} <= previous beat ${beats[i - 1].t}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
