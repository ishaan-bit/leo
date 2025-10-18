/**
 * pig.storage.ts
 * Vercel-compatible storage for pig names using environment variables
 * Stores data in memory (resets on deploy, good for testing)
 * In production, replace with Supabase, Vercel KV, or PostgreSQL
 */

// In-memory storage (temporary solution for Vercel)
const pigData: Record<string, { name: string; namedAt: string }> = {};

/**
 * Get a pig's name by pigId
 */
export function getPigName(pigId: string): string | null {
  return pigData[pigId]?.name || null;
}

/**
 * Save a pig's name
 */
export function savePigName(pigId: string, name: string): void {
  pigData[pigId] = {
    name,
    namedAt: new Date().toISOString(),
  };
  console.log('Saved pig:', pigId, name, 'Total pigs:', Object.keys(pigData).length);
}

/**
 * Check if a pig has been named
 */
export function isPigNamed(pigId: string): boolean {
  return !!pigData[pigId];
}

/**
 * Delete a pig's name (for testing/admin purposes)
 */
export function deletePigName(pigId: string): void {
  delete pigData[pigId];
}
