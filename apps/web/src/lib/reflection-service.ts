/**
 * Reflection service
 * Handles saving, querying, and migrating reflections using Upstash Redis KV
 */

import { redis } from './supabase';

// Type definitions
export type ReflectionRow = {
  id: string;
  owner_id: string;
  user_id: string | null;
  session_id: string;
  signed_in: boolean;
  pig_id: string;
  pig_name: string | null;
  text: string;
  feeling_seed: string | null;
  valence: number | null;
  arousal: number | null;
  language: string | null;
  input_mode: 'typing' | 'voice';
  time_of_day: 'morning' | 'noon' | 'evening' | 'night';
  metrics: any;
  device_info: any;
  created_at: string;
  consent_research: boolean;
};

export type PigInfoRow = {
  pig_id: string;
  user_id: string | null;
  session_id: string;
  name: string;
  created_at: string;
  last_reflection_at: string | null;
};

// Redis key patterns
const KEYS = {
  reflection: (id: string) => `reflection:${id}`,
  reflectionsByOwner: (ownerId: string) => `owner:${ownerId}:reflections`,
  reflectionsByPig: (pigId: string) => `pig:${pigId}:reflections`,
  pig: (pigId: string) => `pig:${pigId}:info`,
  sessionLink: (sessionId: string) => `session:${sessionId}:link`,
};

export type SaveReflectionInput = {
  // Identity
  sessionId: string;
  userId?: string | null;
  signedIn: boolean;
  
  // Pig
  pigId: string;
  pigName?: string | null;
  
  // Content
  text: string;
  feelingSeed?: string | null;
  
  // Signals
  valence?: number;
  arousal?: number;
  cognitiveEffort?: number;
  language?: string;
  inputMode: 'typing' | 'voice';
  
  // Metadata
  metrics?: any;
  deviceInfo?: any;
  
  // Privacy
  consentResearch?: boolean;
};

export type SavePigInfoInput = {
  pigId: string;
  userId?: string | null;
  sessionId: string;
  name: string;
  createdAt?: string;
};

/**
 * Save a reflection to Redis KV
 */
export async function saveReflection(input: SaveReflectionInput) {
  try {
    // Generate unique ID
    const id = `refl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine owner_id
    const ownerId = input.signedIn && input.userId
      ? `user:${input.userId}`
      : `guest:${input.sessionId}`;
    
    // Determine time of day
    const hour = new Date().getHours();
    let timeOfDay: 'morning' | 'noon' | 'evening' | 'night';
    if (hour >= 5 && hour < 12) timeOfDay = 'morning';
    else if (hour >= 12 && hour < 17) timeOfDay = 'noon';
    else if (hour >= 17 && hour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';
    
    // Create reflection object
    const reflection: ReflectionRow = {
      id,
      owner_id: ownerId,
      user_id: input.userId || null,
      session_id: input.sessionId,
      signed_in: input.signedIn,
      pig_id: input.pigId,
      pig_name: input.pigName || null,
      text: input.text,
      feeling_seed: input.feelingSeed || null,
      valence: input.valence || null,
      arousal: input.arousal || null,
      language: input.language || null,
      input_mode: input.inputMode,
      time_of_day: timeOfDay,
      metrics: input.metrics || null,
      device_info: input.deviceInfo || null,
      created_at: new Date().toISOString(),
      consent_research: input.consentResearch !== false,
    };
    
    // Save reflection
    await redis.set(KEYS.reflection(id), JSON.stringify(reflection));
    
    // Add to owner's reflection list
    await redis.lpush(KEYS.reflectionsByOwner(ownerId), id);
    
    // Add to pig's reflection list
    await redis.lpush(KEYS.reflectionsByPig(input.pigId), id);
    
    // Update pig's last_reflection_at
    await updatePigLastReflection(input.pigId);
    
    console.log('💾 Reflection saved to Redis:', {
      id,
      ownerId,
      pigId: input.pigId,
      wordCount: input.text.split(/\s+/).length,
    });
    
    return reflection;
  } catch (error) {
    console.error('[ReflectionService] Failed to save reflection:', error);
    throw error;
  }
}

/**
 * Get reflections by owner (user or guest session)
 */
export async function getReflectionsByOwner(ownerId: string, limit = 50) {
  try {
    // Get list of reflection IDs
    const reflectionIds = await redis.lrange(KEYS.reflectionsByOwner(ownerId), 0, limit - 1);
    
    if (reflectionIds.length === 0) {
      return [];
    }
    
    // Fetch all reflections
    const reflectionKeys = reflectionIds.map((id: string) => KEYS.reflection(id));
    const reflections = await redis.mget(...reflectionKeys);
    
    // Parse and filter out nulls
    return (reflections as (string | null)[])
      .filter((r): r is string => r !== null)
      .map((r: string) => JSON.parse(r) as ReflectionRow)
      .sort((a: ReflectionRow, b: ReflectionRow) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    console.error('[ReflectionService] Failed to get reflections by owner:', error);
    return [];
  }
}

/**
 * Get reflections by pig
 */
export async function getReflectionsByPig(pigId: string, limit = 50) {
  try {
    // Get list of reflection IDs
    const reflectionIds = await redis.lrange(KEYS.reflectionsByPig(pigId), 0, limit - 1);
    
    if (reflectionIds.length === 0) {
      return [];
    }
    
    // Fetch all reflections
    const reflectionKeys = reflectionIds.map((id: string) => KEYS.reflection(id));
    const reflections = await redis.mget(...reflectionKeys);
    
    // Parse and filter out nulls
    return (reflections as (string | null)[])
      .filter((r): r is string => r !== null)
      .map((r: string) => JSON.parse(r) as ReflectionRow)
      .sort((a: ReflectionRow, b: ReflectionRow) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (error) {
    console.error('[ReflectionService] Failed to get reflections by pig:', error);
    return [];
  }
}

/**
 * Migrate guest reflections to a signed-in user
 */
export async function migrateGuestToUser(sessionId: string, userId: string) {
  try {
    const guestOwnerId = `guest:${sessionId}`;
    const userOwnerId = `user:${userId}`;
    
    console.log('🔄 Starting migration:', { sessionId, userId });
    
    // Get all guest reflections
    const guestReflections = await getReflectionsByOwner(guestOwnerId);
    
    if (guestReflections.length === 0) {
      console.log('✅ No guest reflections to migrate');
      return { migrated: 0 };
    }
    
    // Update each reflection
    for (const reflection of guestReflections) {
      const updated: ReflectionRow = {
        ...reflection,
        owner_id: userOwnerId,
        user_id: userId,
        signed_in: true,
      };
      
      // Update reflection data
      await redis.set(KEYS.reflection(reflection.id), JSON.stringify(updated));
      
      // Add to user's reflection list
      await redis.lpush(KEYS.reflectionsByOwner(userOwnerId), reflection.id);
    }
    
    // Delete guest's reflection list (reflections themselves stay with new owner)
    await redis.del(KEYS.reflectionsByOwner(guestOwnerId));
    
    // Create session link for future reference
    await redis.set(KEYS.sessionLink(sessionId), userId);
    
    console.log(`✅ Migrated ${guestReflections.length} reflections from guest to user`);
    
    return { migrated: guestReflections.length };
  } catch (error) {
    console.error('[ReflectionService] Failed to migrate guest to user:', error);
    throw error;
  }
}

/**
 * Save or update pig info
 */
export async function savePigInfo(input: SavePigInfoInput) {
  try {
    const pigInfo: PigInfoRow = {
      pig_id: input.pigId,
      user_id: input.userId || null,
      session_id: input.sessionId,
      name: input.name,
      created_at: input.createdAt || new Date().toISOString(),
      last_reflection_at: null,
    };
    
    // Check if pig already exists
    const existing = await redis.get(KEYS.pig(input.pigId));
    
    if (existing) {
      // Update existing pig
      const existingPig = JSON.parse(existing as string) as PigInfoRow;
      
      // If user is being added, update pig ownership
      if (input.userId && !existingPig.user_id) {
        pigInfo.user_id = input.userId;
      }
      
      // Preserve last_reflection_at
      pigInfo.last_reflection_at = existingPig.last_reflection_at;
    }
    
    // Save pig info
    await redis.set(KEYS.pig(input.pigId), JSON.stringify(pigInfo));
    
    console.log('🐷 Pig info saved:', { pigId: input.pigId, name: input.name });
    
    return pigInfo;
  } catch (error) {
    console.error('[ReflectionService] Failed to save pig info:', error);
    throw error;
  }
}

/**
 * Update pig's last_reflection_at timestamp
 */
async function updatePigLastReflection(pigId: string) {
  try {
    const existing = await redis.get(KEYS.pig(pigId));
    
    if (existing) {
      const pigInfo = JSON.parse(existing as string) as PigInfoRow;
      pigInfo.last_reflection_at = new Date().toISOString();
      await redis.set(KEYS.pig(pigId), JSON.stringify(pigInfo));
    }
  } catch (error) {
    console.error('[ReflectionService] Failed to update pig last_reflection_at:', error);
  }
}

/**
 * Get pig info
 */
export async function getPigInfo(pigId: string) {
  try {
    const data = await redis.get(KEYS.pig(pigId));
    
    if (!data) return null;
    
    return JSON.parse(data as string) as PigInfoRow;
  } catch (error) {
    console.error('[ReflectionService] Failed to get pig info:', error);
    return null;
  }
}

/**
 * Delete all reflections for an owner (for testing/cleanup)
 */
export async function deleteReflectionsByOwner(ownerId: string) {
  try {
    // Get all reflection IDs
    const reflectionIds = await redis.lrange(KEYS.reflectionsByOwner(ownerId), 0, -1);
    
    if (reflectionIds.length === 0) {
      return { deleted: 0 };
    }
    
    // Delete each reflection
    const reflectionKeys = reflectionIds.map(id => KEYS.reflection(id));
    await redis.del(...reflectionKeys);
    
    // Delete owner's reflection list
    await redis.del(KEYS.reflectionsByOwner(ownerId));
    
    console.log(`🗑️ Deleted ${reflectionIds.length} reflections for owner ${ownerId}`);
    
    return { deleted: reflectionIds.length };
  } catch (error) {
    console.error('[ReflectionService] Failed to delete reflections:', error);
    throw error;
  }
}

/**
 * Get owner stats (basic implementation for Redis)
 */
export async function getOwnerStats(ownerId: string) {
  try {
    const reflections = await getReflectionsByOwner(ownerId);
    
    if (reflections.length === 0) {
      return {
        count: 0,
        avgValence: null,
        avgArousal: null,
        lastReflectionAt: null,
      };
    }
    
    const valences = reflections.map((r: ReflectionRow) => r.valence).filter((v: number | null): v is number => v !== null);
    const arousals = reflections.map((r: ReflectionRow) => r.arousal).filter((a: number | null): a is number => a !== null);
    
    return {
      count: reflections.length,
      avgValence: valences.length > 0 ? valences.reduce((a: number, b: number) => a + b, 0) / valences.length : null,
      avgArousal: arousals.length > 0 ? arousals.reduce((a: number, b: number) => a + b, 0) / arousals.length : null,
      lastReflectionAt: reflections[0].created_at,
    };
  } catch (error) {
    console.error('[ReflectionService] Failed to get owner stats:', error);
    return null;
  }
}

/**
 * Get all reflections (admin view) - simplified for Redis
 * Note: This is inefficient for Redis KV. For production, consider using a different approach.
 */
export async function getAllReflections(limit = 100, offset = 0) {
  try {
    // This is a simplified implementation
    // In production, you'd want to maintain a separate "all reflections" list
    console.warn('[ReflectionService] getAllReflections is not fully implemented for Redis');
    return [];
  } catch (error) {
    console.error('[ReflectionService] Failed to get all reflections:', error);
    throw error;
  }
}
