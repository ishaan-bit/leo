/**
 * Reflection service
 * Handles saving, querying, and migrating reflections
 */

import { supabase, ReflectionRow, PigRow, SessionUserLinkRow } from './supabase';

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

/**
 * Save a reflection to Supabase
 */
export async function saveReflection(input: SaveReflectionInput) {
  try {
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
    
    // Insert reflection
    const { data, error } = await supabase
      .from('reflections')
      .insert({
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
        consent_research: input.consentResearch !== false,
      })
      .select()
      .single();
    
    if (error) {
      console.error('[ReflectionService] Error saving reflection:', error);
      throw error;
    }
    
    // Update pig's last_reflection_at
    await updatePigLastReflection(input.pigId);
    
    console.log('💾 Reflection saved:', {
      id: data.id,
      ownerId,
      pigId: input.pigId,
      wordCount: input.text.split(/\s+/).length,
    });
    
    return data;
  } catch (error) {
    console.error('[ReflectionService] Failed to save reflection:', error);
    throw error;
  }
}

/**
 * Get reflections for an owner (user or guest)
 */
export async function getReflectionsByOwner(ownerId: string, limit = 50) {
  const { data, error } = await supabase
    .from('reflections')
    .select('*')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[ReflectionService] Error fetching reflections:', error);
    throw error;
  }
  
  return data;
}

/**
 * Get reflections for a specific pig
 */
export async function getReflectionsByPig(pigId: string, limit = 50) {
  const { data, error } = await supabase
    .from('reflections')
    .select('*')
    .eq('pig_id', pigId)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (error) {
    console.error('[ReflectionService] Error fetching pig reflections:', error);
    throw error;
  }
  
  return data;
}

/**
 * Migrate guest reflections to user account (on sign-in)
 */
export async function migrateGuestToUser(sessionId: string, userId: string) {
  try {
    console.log(`🔄 Migrating reflections: session ${sessionId} → user ${userId}`);
    
    const guestOwnerId = `guest:${sessionId}`;
    const userOwnerId = `user:${userId}`;
    
    // 1. Update all reflections from guest to user
    const { data: updated, error: updateError } = await supabase
      .from('reflections')
      .update({
        owner_id: userOwnerId,
        user_id: userId,
        signed_in: true,
      })
      .eq('owner_id', guestOwnerId)
      .select();
    
    if (updateError) {
      console.error('[ReflectionService] Migration error:', updateError);
      throw updateError;
    }
    
    console.log(`✅ Migrated ${updated?.length || 0} reflections`);
    
    // 2. Update pig ownership if any
    await supabase
      .from('pigs')
      .update({ owner_id: userOwnerId })
      .eq('owner_id', guestOwnerId);
    
    // 3. Record the link
    await supabase
      .from('session_user_links')
      .insert({
        session_id: sessionId,
        user_id: userId,
        migration_completed: true,
      });
    
    return {
      success: true,
      migratedCount: updated?.length || 0,
    };
  } catch (error) {
    console.error('[ReflectionService] Migration failed:', error);
    throw error;
  }
}

/**
 * Save or update pig info
 */
export async function savePigInfo(pigId: string, ownerId: string, pigName?: string) {
  try {
    // Check if pig exists
    const { data: existing } = await supabase
      .from('pigs')
      .select('*')
      .eq('pig_id', pigId)
      .single();
    
    if (existing) {
      // Update existing pig
      const updates: any = {};
      if (pigName && !existing.pig_name) {
        updates.pig_name = pigName;
        updates.named_at = new Date().toISOString();
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('pigs')
          .update(updates)
          .eq('pig_id', pigId);
      }
    } else {
      // Create new pig
      await supabase
        .from('pigs')
        .insert({
          pig_id: pigId,
          pig_name: pigName || null,
          owner_id: ownerId,
          named_at: pigName ? new Date().toISOString() : null,
        });
    }
  } catch (error) {
    console.error('[ReflectionService] Error saving pig info:', error);
  }
}

/**
 * Update pig's last reflection timestamp
 */
async function updatePigLastReflection(pigId: string) {
  try {
    await supabase
      .from('pigs')
      .update({ last_reflection_at: new Date().toISOString() })
      .eq('pig_id', pigId);
  } catch (error) {
    console.error('[ReflectionService] Error updating pig timestamp:', error);
  }
}

/**
 * Get owner stats (count, avg valence/arousal, etc.)
 */
export async function getOwnerStats(ownerId: string) {
  const { data, error } = await supabase
    .rpc('get_owner_stats', { p_owner_id: ownerId });
  
  if (error) {
    console.error('[ReflectionService] Error fetching stats:', error);
    return null;
  }
  
  return data;
}

/**
 * Get all reflections (admin view)
 */
export async function getAllReflections(limit = 100, offset = 0) {
  const { data, error } = await supabase
    .from('reflections')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  
  if (error) {
    console.error('[ReflectionService] Error fetching all reflections:', error);
    throw error;
  }
  
  return data;
}

/**
 * Delete reflections by owner (GDPR compliance)
 */
export async function deleteReflectionsByOwner(ownerId: string) {
  const { error } = await supabase
    .from('reflections')
    .delete()
    .eq('owner_id', ownerId);
  
  if (error) {
    console.error('[ReflectionService] Error deleting reflections:', error);
    throw error;
  }
  
  console.log(`🗑️ Deleted all reflections for ${ownerId}`);
}
