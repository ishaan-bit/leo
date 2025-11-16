/**
 * DELETE /api/user/dream-letters
 * Clear all dream letters for the current user
 * Keeps reflections intact, only removes dream letter data
 */

import { NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { getAuth, getSid } from '@/lib/auth-helpers';
import { extractGuestUidFromPigId, getGuestReflectionsSetKey, getGuestReflectionKey } from '@/lib/guest-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE() {
  try {
    console.log('[API /user/dream-letters DELETE] Starting deletion...');

    const auth = await getAuth();
    const sid = await getSid();
    const isGuest = !auth;
    const userId = auth?.userId;

    console.log('[API /user/dream-letters DELETE] Identity:', {
      isGuest,
      userId: userId || 'N/A',
      sid: sid.substring(0, 12) + '...',
    });

    let clearedCount = 0;

    if (isGuest) {
      // GUEST MODE: Clear dream letters from local reflections
      const guestUid = sid.startsWith('sid_') ? sid.substring(4) : sid;
      const reflectionsKey = getGuestReflectionsSetKey(guestUid);

      const reflectionIds = await kv.zrange(reflectionsKey, 0, -1);

      if (reflectionIds && reflectionIds.length > 0) {
        for (const rid of reflectionIds) {
          const reflectionKey = getGuestReflectionKey(guestUid, String(rid));
          const reflection = await kv.get(reflectionKey);

          if (reflection && typeof reflection === 'object' && 'dream_letter' in reflection) {
            // Remove dream_letter field
            const { dream_letter, ...rest } = reflection as any;
            await kv.set(reflectionKey, rest);
            clearedCount++;
          }
        }
      }

      console.log('[API /user/dream-letters DELETE] Guest dream letters cleared:', clearedCount);
    } else {
      // AUTHENTICATED MODE: Clear dream letters from user's reflections
      const userReflectionsKey = `user:${userId}:refl:idx`;
      const reflectionIds = await kv.zrange(userReflectionsKey, 0, -1);

      if (reflectionIds && reflectionIds.length > 0) {
        for (const rid of reflectionIds) {
          const reflectionKey = `refl:${rid}`;
          const reflection = await kv.get(reflectionKey);

          if (reflection && typeof reflection === 'object' && 'dream_letter' in reflection) {
            // Remove dream_letter field
            const { dream_letter, ...rest } = reflection as any;
            await kv.set(reflectionKey, rest);
            clearedCount++;
          }
        }
      }

      // Delete pending dream
      const pendingDreamKey = `user:${userId}:pending_dream`;
      const pendingDeleted = await kv.del(pendingDreamKey);
      if (pendingDeleted) {
        console.log('[API /user/dream-letters DELETE] Pending dream cleared');
        clearedCount++;
      }

      console.log('[API /user/dream-letters DELETE] Auth dream letters cleared:', clearedCount);
    }

    return NextResponse.json({
      success: true,
      clearedCount,
      message: 'Dream letters cleared successfully',
    });

  } catch (error) {
    console.error('[API /user/dream-letters DELETE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to clear dream letters',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
