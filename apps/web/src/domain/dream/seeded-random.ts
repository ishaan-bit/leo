/**
 * Seeded PRNG for deterministic dream generation
 * Ensures same seed always produces same outputs across runs
 */

/**
 * Simple hash function to convert seed string to integer
 * Based on Java's String.hashCode() implementation
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Mulberry32 PRNG - fast, simple, deterministic
 * https://github.com/bryc/code/blob/master/jshash/PRNGs.md
 */
function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Create seeded random number generator from seed string
 */
export function createSeededRandom(seedString: string) {
  const seedNumber = hashSeed(seedString);
  const rng = mulberry32(seedNumber);
  
  return {
    /**
     * Get next random float in [0, 1)
     */
    next: (): number => {
      return rng();
    },
    
    /**
     * Get random integer in [min, max]
     */
    nextInt: (min: number, max: number): number => {
      return Math.floor(rng() * (max - min + 1)) + min;
    },
    
    /**
     * Get random float in [min, max)
     */
    nextFloat: (min: number, max: number): number => {
      return rng() * (max - min) + min;
    },
    
    /**
     * Boolean with given probability (0-1)
     */
    chance: (probability: number): boolean => {
      return rng() < probability;
    },
    
    /**
     * Shuffle array in-place using Fisher-Yates
     */
    shuffle: <T>(array: T[]): T[] => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    
    /**
     * Pick random element from array
     */
    pick: <T>(array: T[]): T => {
      return array[Math.floor(rng() * array.length)];
    },
    
    /**
     * Sample K elements from array without replacement
     */
    sample: <T>(array: T[], k: number): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, Math.min(k, array.length));
    },
  };
}

/**
 * Build seed strings according to spec
 */
export const DreamSeeds = {
  /**
   * Build sporadicity (65% chance to proceed)
   */
  buildSporadicity: (userId: string, date: string, kind: string) => 
    `${userId}|${date}|${kind}`,
  
  /**
   * K selection (tie-breaking for core count)
   */
  kSelection: (userId: string, date: string, kind: string) => 
    `${userId}|${date}|${kind}|count`,
  
  /**
   * Primary bucket order (for diversity selection)
   */
  primaryBucketOrder: (userId: string, date: string, kind: string) => 
    `${userId}|${date}|${kind}|buckets`,
  
  /**
   * Core template pick (which variant to use)
   */
  coreTemplate: (userId: string, scriptId: string, rid: string) => 
    `${userId}|${scriptId}|${rid}`,
  
  /**
   * Sign-in play chance (80% to show dream)
   */
  signinPlayChance: (userId: string, scriptId: string) => 
    `${userId}|${scriptId}|signin`,
  
  /**
   * Camera parallax phase per core
   */
  cameraParallax: (scriptId: string, rid: string) => 
    `${scriptId}|${rid}|camera`,
  
  /**
   * Glow hue drift per core (±3°)
   */
  glowHueDrift: (scriptId: string, rid: string) => 
    `${scriptId}|${rid}|huedrift`,
};
