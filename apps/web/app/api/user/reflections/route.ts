/**
 * DELETE /api/user/reflections
 * Clear all reflections for the current user (signed-in or guest)
 * Keeps user account and pig intact, only removes reflection data
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
    console.log('[API /user/reflections DELETE] Starting deletion...');

    // Get identity (works for both auth and guest users)
    const identity = await resolveIdentity();
    const auth = await getAuth();
    const sid = await getSid();

    const isGuest = !auth;
    const userId = auth?.userId;

    console.log('[API /user/reflections DELETE] Identity:', {
      isGuest,
      userId: userId || 'N/A',
      sid: sid.substring(0, 12) + '...',
      effectiveScope: identity.effectiveScope,
    });

    let deletedCount = 0;

    if (isGuest) {
      // GUEST MODE: Delete from guest namespace
      const guestUid = sid.startsWith('sid_') ? sid.substring(4) : sid;
      const reflectionsKey = getGuestReflectionsSetKey(guestUid);

      console.log('[API /user/reflections DELETE] Guest mode - clearing:', reflectionsKey);

      // Get all reflection IDs from the sorted set
      const reflectionIds = await kv.zrange(reflectionsKey, 0, -1);

      if (reflectionIds && reflectionIds.length > 0) {
        // Delete each reflection document
        const reflectionKeys = reflectionIds.map(rid => 
          getGuestReflectionKey(guestUid, String(rid))
        );
        
        await kv.del(...reflectionKeys);
        deletedCount = reflectionKeys.length;
        
        // Delete the sorted set itself
        await kv.del(reflectionsKey);

        console.log('[API /user/reflections DELETE] Guest reflections deleted:', deletedCount);
      }
    } else {
      // AUTHENTICATED MODE: Delete from user namespace
      console.log('[API /user/reflections DELETE] Auth mode - deleting for userId:', userId);

      // Get reflection IDs from user's sorted set
      const userReflectionsKey = `user:${userId}:refl:idx`;
      const reflectionIds = await kv.zrange(userReflectionsKey, 0, -1);

      if (reflectionIds && reflectionIds.length > 0) {
        // Delete each reflection document
        const reflectionKeys = reflectionIds.map(rid => `refl:${rid}`);
        await kv.del(...reflectionKeys);
        deletedCount = reflectionKeys.length;

        // Delete the sorted set
        await kv.del(userReflectionsKey);

        // Also clean up any pig_reflections sets (if user has reflections tied to pigs)
        // This requires finding all pigs the user has reflected with
        // For now, we'll just delete the user's main index
        console.log('[API /user/reflections DELETE] Auth reflections deleted:', deletedCount);
      }

      // Clear any micro-dreams tied to this user
      const microDreamKey = `micro_dream:${userId}`;
      const microDreamDeleted = await kv.del(microDreamKey);
      if (microDreamDeleted) {
        console.log('[API /user/reflections DELETE] Micro-dream cleared');
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      message: 'Reflections cleared successfully',
    });

  } catch (error) {
    console.error('[API /user/reflections DELETE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete reflections',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
