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
 * Check if force_dream is enabled for user (flag, query param, or cookie)
 */
export async function isForceDreamEnabled(
  userId: string,
  queryParams?: URLSearchParams,
  cookies?: string,
  pigId?: string
): Promise<{ enabled: boolean; source: string; key?: string }> {
  // Check URL query param first
  if (queryParams?.get('forceDream') === '1') {
    console.log('[Feature Flags] force_dream enabled via query param');
    return { enabled: true, source: 'query_param' };
  }
  
  // Check cookie (survives OAuth redirect)
  if (cookies) {
    const cookieMatch = cookies.match(/(?:^|;\s*)fd=([^;]*)/);
    if (cookieMatch && cookieMatch[1] === '1') {
      console.log('[Feature Flags] force_flag_cookie_bridge: { from: "cookie", applied: true }');
      return { enabled: true, source: 'cookie' };
    }
  }
  
  // Check Redis flag for userId
  const userKey = `user:${userId}:feature_flags`;
  const flags = await getUserFeatureFlags(userId);
  
  console.log('[Feature Flags] router_user_id:', userId);
  console.log('[Feature Flags] feature_flags_key:', userKey);
  console.log('[Feature Flags] force_dream_value:', flags.force_dream || 'null');
  
  if (flags.force_dream === 'on') {
    console.log('[Feature Flags] force_dream enabled via Redis flag (userId)');
    return { enabled: true, source: 'redis_user', key: userKey };
  }
  
  // Fallback: Check pigId-based flag for TEST MODE
  if (pigId) {
    const pigKey = `user:${pigId}:feature_flags`;
    const pigFlags = await redis.hgetall<FeatureFlags>(pigKey);
    
    console.log('[Feature Flags] Checking pigId fallback:', pigKey);
    console.log('[Feature Flags] pigId force_dream_value:', pigFlags?.force_dream || 'null');
    
    if (pigFlags?.force_dream === 'on') {
      console.log('[Feature Flags] force_dream enabled via Redis flag (pigId fallback)');
      return { enabled: true, source: 'redis_pig', key: pigKey };
    }
  }
  
  return { enabled: false, source: 'none' };
}
