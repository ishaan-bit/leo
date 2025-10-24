/**
 * Dream Builder - Orchestrates inactivity worker logic
 * Implements eligibility, scoring, selection, and beat generation
 */

import type { PendingDream, DreamState, ReflectionData, PrimaryEmotion, DreamKind } from './dream.types';
import { buildCandidatePool, selectCores } from './scoring';
import { determineK, generateBeats, validateBeats } from './timeline';
import { createSeededRandom, DreamSeeds } from './seeded-random';
import { extractKeywords, getTemplatedLine, getOpeningLine, AUDIO_KEYS, BUILDINGS } from './dream.config';

/**
 * Check eligibility for dream building
 */
export function checkEligibility(dreamState: DreamState | null): {
  eligible: boolean;
  kind?: DreamKind;
  daysSince: number;
} {
  if (!dreamState || !dreamState.lastDreamAt) {
    // First time, weekly eligible
    return { eligible: true, kind: 'weekly', daysSince: Infinity };
  }
  
  const lastDreamTime = new Date(dreamState.lastDreamAt).getTime();
  const now = Date.now();
  const daysSince = (now - lastDreamTime) / (1000 * 60 * 60 * 24);
  
  if (daysSince >= 21) {
    return { eligible: true, kind: 'reunion', daysSince };
  } else if (daysSince >= 7) {
    return { eligible: true, kind: 'weekly', daysSince };
  }
  
  return { eligible: false, daysSince };
}

/**
 * Generate unique script ID
 */
function generateScriptId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'dream_';
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Get dominant primary from selected cores
 */
function getDominantPrimary(primaries: PrimaryEmotion[]): PrimaryEmotion {
  const counts: Record<string, number> = {};
  for (const p of primaries) {
    counts[p] = (counts[p] || 0) + 1;
  }
  
  let max = 0;
  let dominant: PrimaryEmotion = 'peaceful';
  for (const [primary, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      dominant = primary as PrimaryEmotion;
    }
  }
  
  return dominant;
}

/**
 * Build dream JSON from reflections
 */
export async function buildDream(params: {
  userId: string;
  reflections: ReflectionData[];
  dreamState: DreamState | null;
  date: string; // YYYY-MM-DD in Asia/Kolkata
  testMode?: boolean; // Force build bypassing all gates
}): Promise<PendingDream | null> {
  const { userId, reflections, dreamState, date, testMode = false } = params;
  
  let kind: DreamKind;
  
  if (testMode) {
    // TEST MODE: Always force weekly, bypass eligibility and sporadic gates
    console.log('[Dream Builder] TEST MODE: Bypassing all gates');
    kind = 'weekly';
  } else {
    // 1. Check eligibility
    const eligibility = checkEligibility(dreamState);
    if (!eligibility.eligible || !eligibility.kind) {
      return null;
    }
    
    kind = eligibility.kind;
    
    // 2. Sporadic build gate (65% chance)
    const sporadicSeed = DreamSeeds.buildSporadicity(userId, date, kind);
    const rng = createSeededRandom(sporadicSeed);
    if (!rng.chance(0.65)) {
      return null; // sporadic_no
    }
  }
  
  // 3. Build candidate pool
  const lastDreamMomentIds = dreamState?.lastDreamMomentIds || [];
  let candidates = buildCandidatePool(reflections, dreamState?.lastDreamAt || null, lastDreamMomentIds, 90);
  
  // Expand to 180 days if < 3
  if (candidates.length < 3) {
    candidates = buildCandidatePool(reflections, dreamState?.lastDreamAt || null, lastDreamMomentIds, 180);
  }
  
  // No data if still < 1
  if (candidates.length === 0) {
    return null; // no_data
  }
  
  // 4. Determine K
  const kSeed = DreamSeeds.kSelection(userId, date, kind);
  const kRng = createSeededRandom(kSeed);
  const K = determineK(candidates.length, kRng.nextInt(0, 1000));
  
  if (K === 0) {
    return null; // no_data
  }
  
  // 5. Select K cores
  const bucketSeed = DreamSeeds.primaryBucketOrder(userId, date, kind);
  const selectedCandidates = selectCores(candidates, K, bucketSeed);
  
  if (selectedCandidates.length === 0) {
    return null; // no_data
  }
  
  // 6. Generate script ID
  const scriptId = generateScriptId();
  
  // 7. Synthesize copy (opening + lines per core)
  const daysSince = testMode ? 8 : checkEligibility(dreamState).daysSince;
  const opening = getOpeningLine(daysSince);
  
  const selectedCores = selectedCandidates.map((candidate) => {
    const reflection = candidate.reflection;
    const primary = reflection.final?.wheel?.primary || 'peaceful';
    const keywords = extractKeywords(reflection.normalized_text || '');
    
    // Pick template variant using seeded RNG
    const templateSeed = DreamSeeds.coreTemplate(userId, scriptId, reflection.rid);
    const templateRng = createSeededRandom(templateSeed);
    const templateIndex = templateRng.nextInt(0, 2); // 3 variants per primary
    
    const line = getTemplatedLine(primary, keywords, templateIndex);
    
    return {
      momentId: reflection.rid,
      primary,
      line,
    };
  });
  
  // 8. Generate beat timeline
  const beats = generateBeats(selectedCores);
  
  // 9. Validate beats
  const validation = validateBeats(beats, K);
  if (!validation.valid) {
    console.error('Beat validation failed:', validation.errors);
    return null;
  }
  
  // 10. Determine audio key and palette
  const primaries = selectedCores.map(c => c.primary);
  const dominantPrimary = getDominantPrimary(primaries);
  const audioKey = AUDIO_KEYS[dominantPrimary];
  
  // 11. Compute timestamps (Asia/Kolkata)
  const now = new Date();
  const kolkataOffset = '+05:30';
  const generatedAt = now.toISOString().replace('Z', kolkataOffset);
  
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const expiresAtStr = expiresAt.toISOString().replace('Z', kolkataOffset);
  
  // 12. Build pending dream JSON
  const pendingDream: PendingDream = {
    scriptId,
    kind,
    generatedAt,
    expiresAt: expiresAtStr,
    duration: 18,
    palette: {
      primary: dominantPrimary,
    },
    audioKey,
    opening,
    beats,
    usedMomentIds: selectedCores.map(c => c.momentId),
  };
  
  return pendingDream;
}

/**
 * Compute distribution stats for telemetry
 */
export function computeDistributions(selectedCandidates: Array<{ reflection: ReflectionData }>) {
  const primaries: Record<PrimaryEmotion, number> = {
    joyful: 0,
    peaceful: 0,
    sad: 0,
    scared: 0,
    mad: 0,
    powerful: 0,
  };
  
  const timeBuckets: Record<number, number> = {
    0: 0, // 0-7d
    1: 0, // 8-21d
    2: 0, // 22-45d
    3: 0, // 46-90d
    4: 0, // 91-180d
  };
  
  for (const candidate of selectedCandidates) {
    const primary = candidate.reflection.final?.wheel?.primary;
    if (primary) {
      primaries[primary]++;
    }
    
    // Would need daysSince calculation here for time buckets
    // Simplified for now
  }
  
  return { primaries, timeBuckets };
}
