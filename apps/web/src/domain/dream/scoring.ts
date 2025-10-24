/**
 * Candidate scoring and diversity selection for dream cores
 * Implements recency decay, intensity, novelty, textRichness
 */

import type { ReflectionData, ScoredCandidate, PrimaryEmotion } from './dream.types';
import { createSeededRandom } from './seeded-random';

/**
 * Calculate days since timestamp
 */
function daysSince(timestamp: string): number {
  const then = new Date(timestamp).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

/**
 * Assign time bucket based on recency
 * T0: 0-7d, T1: 8-21d, T2: 22-45d, T3: 46-90d, T4: 91-180d
 */
function getTimeBucket(daysSince: number): number {
  if (daysSince <= 7) return 0;
  if (daysSince <= 21) return 1;
  if (daysSince <= 45) return 2;
  if (daysSince <= 90) return 3;
  return 4; // 91-180d
}

/**
 * Score a single candidate reflection
 */
export function scoreCandidate(
  reflection: ReflectionData,
  lastDreamMomentIds: string[]
): ScoredCandidate {
  const days = daysSince(reflection.timestamp);
  
  // Recency decay: exp(-days/14) — 50% weight
  const recencyDecay = Math.exp(-days / 14);
  
  // Intensity: valence or arousal, default 0.5 — 25% weight
  const valence = reflection.final?.valence ?? 0.5;
  const arousal = reflection.final?.arousal ?? 0.5;
  const intensity = Math.max(valence, arousal);
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  
  // Novelty: not in last dream — 15% weight
  const novelty = lastDreamMomentIds.includes(reflection.rid) ? 0 : 1;
  
  // Text richness: normalized_text.length / 120 — 10% weight
  const textLength = reflection.normalized_text?.length || 0;
  const textRichness = Math.min(1, textLength / 120);
  
  // Base score (before soft penalties)
  const baseScore = 
    0.50 * recencyDecay +
    0.25 * clampedIntensity +
    0.15 * novelty +
    0.10 * textRichness;
  
  return {
    reflection,
    baseScore,
    recencyDecay,
    intensity: clampedIntensity,
    novelty,
    textRichness,
    daysSince: days,
    timeBucket: getTimeBucket(days),
  };
}

/**
 * Filter candidate pool by eligibility criteria
 */
export function buildCandidatePool(
  reflections: ReflectionData[],
  lastDreamAt: string | null,
  lastDreamMomentIds: string[],
  maxDays: number = 90
): ScoredCandidate[] {
  const now = Date.now();
  const cutoffDate = new Date(now - maxDays * 24 * 60 * 60 * 1000);
  
  // Filter by date range
  let candidates = reflections.filter(r => {
    const ts = new Date(r.timestamp).getTime();
    return ts >= cutoffDate.getTime();
  });
  
  // Prefer items after lastDreamAt if present
  if (lastDreamAt) {
    const lastDreamTime = new Date(lastDreamAt).getTime();
    const afterLast = candidates.filter(r => new Date(r.timestamp).getTime() > lastDreamTime);
    if (afterLast.length >= 3) {
      candidates = afterLast;
    }
  }
  
  // Quality floor: normalized_text >= 30 chars OR has valence/arousal
  candidates = candidates.filter(r => {
    const hasText = (r.normalized_text?.length || 0) >= 30;
    const hasEmotionalData = r.final?.valence !== undefined || r.final?.arousal !== undefined;
    return hasText || hasEmotionalData;
  });
  
  // Exclude lastDreamMomentIds if possible
  const withoutOverlap = candidates.filter(r => !lastDreamMomentIds.includes(r.rid));
  if (withoutOverlap.length >= 3) {
    candidates = withoutOverlap;
  } else if (withoutOverlap.length > 0 && candidates.length - withoutOverlap.length <= 1) {
    // Allow up to 1 overlap if needed to reach 3
    candidates = withoutOverlap.concat(
      candidates
        .filter(r => lastDreamMomentIds.includes(r.rid))
        .slice(0, 1)
    );
  }
  
  // Score all candidates
  return candidates.map(r => scoreCandidate(r, lastDreamMomentIds));
}

/**
 * Select K cores with diversity and fairness
 * Implements primary bucketing, time bucket spacing, same-day caps
 */
export function selectCores(
  candidates: ScoredCandidate[],
  K: number,
  seedString: string
): ScoredCandidate[] {
  if (K === 0 || candidates.length === 0) return [];
  
  const rng = createSeededRandom(seedString);
  
  // Sort candidates by base score desc, then timestamp desc, then rid asc (stable)
  const sorted = [...candidates].sort((a, b) => {
    if (Math.abs(a.baseScore - b.baseScore) > 0.001) {
      return b.baseScore - a.baseScore;
    }
    const tsA = new Date(a.reflection.timestamp).getTime();
    const tsB = new Date(b.reflection.timestamp).getTime();
    if (tsA !== tsB) return tsB - tsA;
    return a.reflection.rid.localeCompare(b.reflection.rid);
  });
  
  // Group by primary
  const primaries: PrimaryEmotion[] = ['joyful', 'peaceful', 'sad', 'scared', 'mad', 'powerful'];
  const buckets: Record<string, ScoredCandidate[]> = {};
  for (const p of primaries) {
    buckets[p] = sorted.filter(c => c.reflection.final?.wheel?.primary === p);
  }
  
  // Seeded permutation of primary order
  const primaryOrder = rng.shuffle(primaries);
  
  const selected: ScoredCandidate[] = [];
  const usedTimeBuckets: number[] = [];
  const dateCount: Record<string, number> = {};
  const primaryCount: Record<string, number> = {};
  
  // Warm start: pick highest-base from two distinct primaries
  const firstPrimary = primaryOrder.find(p => buckets[p].length > 0);
  const secondPrimary = primaryOrder.find(p => p !== firstPrimary && buckets[p].length > 0);
  
  if (firstPrimary && buckets[firstPrimary].length > 0) {
    const first = buckets[firstPrimary].shift()!;
    selected.push(first);
    usedTimeBuckets.push(first.timeBucket);
    const date = new Date(first.reflection.timestamp).toISOString().split('T')[0];
    dateCount[date] = 1;
    primaryCount[firstPrimary] = 1;
  }
  
  if (secondPrimary && buckets[secondPrimary].length > 0 && selected.length < K) {
    const second = buckets[secondPrimary].shift()!;
    selected.push(second);
    usedTimeBuckets.push(second.timeBucket);
    const date = new Date(second.reflection.timestamp).toISOString().split('T')[0];
    dateCount[date] = (dateCount[date] || 0) + 1;
    primaryCount[secondPrimary] = 1;
  }
  
  // Round-robin fill
  const perPrimaryCap = Math.min(3, Math.ceil(K * 0.5));
  
  while (selected.length < K) {
    let added = false;
    
    for (const primary of primaryOrder) {
      if (selected.length >= K) break;
      
      // Check per-primary cap
      if ((primaryCount[primary] || 0) >= perPrimaryCap) continue;
      
      const bucket = buckets[primary];
      if (bucket.length === 0) continue;
      
      // Find best candidate that satisfies constraints
      let candidate: ScoredCandidate | undefined;
      
      // Try to find candidate with good time bucket spacing
      for (const c of bucket) {
        const timeBucket = c.timeBucket;
        const recentBuckets = usedTimeBuckets.slice(-2);
        
        // Prefer different time bucket from last 2 picks
        if (recentBuckets.includes(timeBucket)) continue;
        
        // Check same-day cap (max 2, prefer 1)
        const date = new Date(c.reflection.timestamp).toISOString().split('T')[0];
        if ((dateCount[date] || 0) >= 2) continue;
        
        candidate = c;
        break;
      }
      
      // Relax time bucket rule if stuck
      if (!candidate) {
        for (const c of bucket) {
          const date = new Date(c.reflection.timestamp).toISOString().split('T')[0];
          if ((dateCount[date] || 0) >= 2) continue;
          candidate = c;
          break;
        }
      }
      
      // Relax same-day rule only if required to reach K
      if (!candidate && selected.length < K - 1) {
        for (const c of bucket) {
          const date = new Date(c.reflection.timestamp).toISOString().split('T')[0];
          if ((dateCount[date] || 0) >= 3) continue;
          candidate = c;
          break;
        }
      }
      
      if (candidate) {
        selected.push(candidate);
        buckets[primary] = bucket.filter(c => c !== candidate);
        usedTimeBuckets.push(candidate.timeBucket);
        const date = new Date(candidate.reflection.timestamp).toISOString().split('T')[0];
        dateCount[date] = (dateCount[date] || 0) + 1;
        primaryCount[primary] = (primaryCount[primary] || 0) + 1;
        added = true;
      }
    }
    
    // If nothing added in full round, break to avoid infinite loop
    if (!added) break;
  }
  
  // Final playback ordering: avoid adjacent cores with same primary AND date
  return reorderForPlayback(selected);
}

/**
 * Reorder selected cores to avoid adjacent items sharing both primary and date
 */
function reorderForPlayback(selected: ScoredCandidate[]): ScoredCandidate[] {
  if (selected.length <= 1) return selected;
  
  const ordered = [...selected];
  
  // Try to swap neighbors if they share both primary and date
  for (let i = 0; i < ordered.length - 1; i++) {
    const curr = ordered[i];
    const next = ordered[i + 1];
    
    const currPrimary = curr.reflection.final?.wheel?.primary;
    const nextPrimary = next.reflection.final?.wheel?.primary;
    const currDate = new Date(curr.reflection.timestamp).toISOString().split('T')[0];
    const nextDate = new Date(next.reflection.timestamp).toISOString().split('T')[0];
    
    if (currPrimary === nextPrimary && currDate === nextDate) {
      // Try to swap with next+1 if available
      if (i + 2 < ordered.length) {
        [ordered[i + 1], ordered[i + 2]] = [ordered[i + 2], ordered[i + 1]];
      }
    }
  }
  
  return ordered;
}
