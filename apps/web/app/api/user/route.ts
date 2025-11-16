/**
 * DELETE /api/user
 * Delete all data for the current user (complete erasure)
 * Includes: reflections, dream letters, pending dreams, micro-dreams, and user profile
 * Signs out the user and returns success
 */

import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { getAuth, getSid } from '@/lib/auth-helpers';
import { resolveIdentity } from '@/lib/identity-resolver';
import { extractGuestUidFromPigId, getGuestReflectionsSetKey, getGuestReflectionKey } from '@/lib/guest-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE() {
  try {
    console.log('[API /user DELETE] Starting complete data deletion...');

    const identity = await resolveIdentity();
    const auth = await getAuth();
    const sid = await getSid();

    const isGuest = !auth;
    const userId = auth?.userId;

    console.log('[API /user DELETE] Identity:', {
      isGuest,
      userId: userId || 'N/A',
      sid: sid.substring(0, 12) + '...',
      effectiveScope: identity.effectiveScope,
    });

    const deletionSummary = {
      reflections: 0,
      dreamLetters: 0,
      pendingDreams: 0,
      microDreams: 0,
      profiles: 0,
    };

    if (isGuest) {
      // GUEST MODE: Delete all guest data
      const guestUid = sid.startsWith('sid_') ? sid.substring(4) : sid;
      const reflectionsKey = getGuestReflectionsSetKey(guestUid);

      // Get all reflection IDs
      const reflectionIds = await kv.zrange(reflectionsKey, 0, -1);

      if (reflectionIds && reflectionIds.length > 0) {
        // Delete each reflection document
        const reflectionKeys = reflectionIds.map(rid => 
          getGuestReflectionKey(guestUid, String(rid))
        );
        
        await kv.del(...reflectionKeys);
        deletionSummary.reflections = reflectionKeys.length;
        
        // Delete the sorted set itself
        await kv.del(reflectionsKey);
      }

      // Delete guest profile
      const guestProfileKey = `sid:${sid}:profile`;
      const profileDeleted = await kv.del(guestProfileKey);
      if (profileDeleted) {
        deletionSummary.profiles = 1;
      }

      console.log('[API /user DELETE] Guest data deleted:', deletionSummary);
    } else {
      // AUTHENTICATED MODE: Delete all user data
      console.log('[API /user DELETE] Auth mode - deleting all data for userId:', userId);

      // 1. Delete all reflections
      const userReflectionsKey = `user:${userId}:refl:idx`;
      const reflectionIds = await kv.zrange(userReflectionsKey, 0, -1);

      if (reflectionIds && reflectionIds.length > 0) {
        const reflectionKeys = reflectionIds.map(rid => `refl:${rid}`);
        await kv.del(...reflectionKeys);
        deletionSummary.reflections = reflectionKeys.length;
        await kv.del(userReflectionsKey);
      }

      // 2. Delete pending dream
      const pendingDreamKey = `user:${userId}:pending_dream`;
      const pendingDeleted = await kv.del(pendingDreamKey);
      if (pendingDeleted) {
        deletionSummary.pendingDreams = 1;
      }

      // 3. Delete dream state
      const dreamStateKey = `user:${userId}:dream_state`;
      await kv.del(dreamStateKey);

      // 4. Delete micro-dream
      const microDreamKey = `micro_dream:${userId}`;
      const microDeleted = await kv.del(microDreamKey);
      if (microDeleted) {
        deletionSummary.microDreams = 1;
      }

      // 5. Delete user profile
      const userProfileKey = `user:${userId}:profile`;
      const profileDeleted = await kv.del(userProfileKey);
      if (profileDeleted) {
        deletionSummary.profiles = 1;
      }

      // 6. Delete user cache
      const userCacheKey = `user:${userId}`;
      await kv.del(userCacheKey);

      console.log('[API /user DELETE] Auth data deleted:', deletionSummary);
    }

    return NextResponse.json({
      success: true,
      deletionSummary,
      message: 'All data has been erased',
    });

  } catch (error) {
    console.error('[API /user DELETE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete user data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
