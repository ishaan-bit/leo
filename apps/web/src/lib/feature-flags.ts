/**
 * Feature Flags System
 * Redis-backed feature flags for testing and gradual rollout
 */

import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export type FeatureFlags = {
  force_dream?: 'on' | 'off';
};

/**
 * Get feature flags for a user
 */
export async function getUserFeatureFlags(userId: string): Promise<FeatureFlags> {
  try {
    const flags = await redis.hgetall<FeatureFlags>(`user:${userId}:feature_flags`);
    return flags || {};
  } catch (error) {
    console.error('[Feature Flags] Error fetching flags for user:', userId, error);
    return {};
  }
}

/**
 * Set a feature flag for a user
 */
export async function setUserFeatureFlag(
  userId: string,
  flag: keyof FeatureFlags,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  try {
    await redis.hset(`user:${userId}:feature_flags`, { [flag]: value });
    
    if (ttlSeconds) {
      await redis.expire(`user:${userId}:feature_flags`, ttlSeconds);
    }
    
    console.log(`[Feature Flags] Set ${flag}=${value} for user ${userId}`);
  } catch (error) {
    console.error('[Feature Flags] Error setting flag:', error);
  }
}

/**
 * Check if force_dream is enabled for user (flag or query param)
 */
export async function isForceDreamEnabled(
  userId: string,
  queryParams?: URLSearchParams
): Promise<boolean> {
  // Check URL query param first
  if (queryParams?.get('forceDream') === '1') {
    console.log('[Feature Flags] force_dream enabled via query param');
    return true;
  }
  
  // Check Redis flag
  const flags = await getUserFeatureFlags(userId);
  const enabled = flags.force_dream === 'on';
  
  if (enabled) {
    console.log('[Feature Flags] force_dream enabled via Redis flag');
  }
  
  return enabled;
}
