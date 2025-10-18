/**
 * pig.storage.ts
 * Persistent storage for pig names using Vercel KV (Redis)
 * Falls back to in-memory for local development without KV configured
 * 
 * This ensures pig names persist across:
 * - Serverless function invocations
 * - Different browsers/devices
 * - User sessions (names tied to pigId, not user)
 */

import { kv } from '@vercel/kv';

// In-memory fallback for local dev (when KV is not configured)
const pigData: Record<string, { name: string; namedAt: string }> = {};

// Check if Vercel KV is configured
const hasVercelKV = !!process.env.KV_REST_API_URL;

/**
 * Get a pig's name by pigId
 */
export async function getPigName(pigId: string): Promise<string | null> {
  if (hasVercelKV) {
    try {
      const data = await kv.get<{ name: string; namedAt: string }>(`pig:${pigId}`);
      return data?.name || null;
    } catch (error) {
      console.error('KV get error:', error);
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
  
  if (hasVercelKV) {
    try {
      await kv.set(`pig:${pigId}`, data);
      console.log('Saved pig to KV:', pigId, name);
    } catch (error) {
      console.error('KV set error:', error);
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
  if (hasVercelKV) {
    try {
      await kv.del(`pig:${pigId}`);
    } catch (error) {
      console.error('KV delete error:', error);
      throw error;
    }
  } else {
    delete pigData[pigId];
  }
}
