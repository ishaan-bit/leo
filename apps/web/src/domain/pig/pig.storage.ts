/**
 * pig.storage.ts
 * Persistent storage for pig names using Upstash Redis (via Vercel Marketplace)
 * Falls back to in-memory for local development without Redis configured
 * 
 * This ensures pig names persist across:
 * - Serverless function invocations
 * - Different browsers/devices
 * - User sessions (names tied to pigId, not user)
 * 
 * Note: Vercel KV was deprecated in June 2025, replaced with Upstash Redis integration
 */

import { Redis } from '@upstash/redis';

// In-memory fallback for local dev (when Redis is not configured)
const pigData: Record<string, { name: string; namedAt: string }> = {};

// Check if Redis is configured
// Upstash uses KV_REST_API_URL and KV_REST_API_TOKEN for compatibility
const hasRedis = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

// Initialize Upstash Redis client
const redis = hasRedis
  ? new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  : null;

/**
 * Get a pig's name by pigId
 */
export async function getPigName(pigId: string): Promise<string | null> {
  if (redis) {
    try {
      const data = await redis.get<{ name: string; namedAt: string }>(`pig:${pigId}`);
      return data?.name || null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }
  
  // Fallback to in-memory for local dev
  return pigData[pigId]?.name || null;
}

/**
 * Save a pig's name
 */
export async function savePigName(pigId: string, name: string): Promise<void> {
  const data = {
    name,
    namedAt: new Date().toISOString(),
  };
  
  if (redis) {
    try {
      await redis.set(`pig:${pigId}`, data);
      console.log('Saved pig to Redis:', pigId, name);
    } catch (error) {
      console.error('Redis set error:', error);
      throw error;
    }
  } else {
    // Fallback to in-memory for local dev
    pigData[pigId] = data;
    console.log('Saved pig (in-memory):', pigId, name, 'Total pigs:', Object.keys(pigData).length);
  }
}

/**
 * Check if a pig has been named
 */
export async function isPigNamed(pigId: string): Promise<boolean> {
  const name = await getPigName(pigId);
  return !!name;
}

/**
 * Delete a pig's name (for testing/admin purposes)
 */
export async function deletePigName(pigId: string): Promise<void> {
  if (redis) {
    try {
      await redis.del(`pig:${pigId}`);
    } catch (error) {
      console.error('Redis delete error:', error);
      throw error;
    }
  } else {
    delete pigData[pigId];
  }
}
