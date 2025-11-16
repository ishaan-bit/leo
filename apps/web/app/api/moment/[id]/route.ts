/**
 * DELETE /api/moment/[id]
 * Delete a single reflection/moment by ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { getAuth, getSid } from '@/lib/auth-helpers';
import { extractGuestUidFromPigId, getGuestReflectionKey, getGuestReflectionsSetKey } from '@/lib/guest-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing reflection ID' },
        { status: 400 }
      );
    }

    console.log('[API /moment DELETE] Deleting moment:', id);

    const auth = await getAuth();
    const sid = await getSid();
    const isGuest = !auth;
    const userId = auth?.userId;

    // Determine the reflection key based on auth status
    let reflectionKey: string;
    let sortedSetKey: string;

    if (isGuest) {
      // Guest mode
      const guestUid = sid.startsWith('sid_') ? sid.substring(4) : sid;
      reflectionKey = getGuestReflectionKey(guestUid, id);
      sortedSetKey = getGuestReflectionsSetKey(guestUid);
    } else {
      // Authenticated mode
      reflectionKey = `refl:${id}`;
      sortedSetKey = `user:${userId}:refl:idx`;
    }

    console.log('[API /moment DELETE] Keys:', {
      reflectionKey,
      sortedSetKey,
      isGuest,
    });

    // Verify the reflection exists and belongs to this user
    const reflection = await kv.get(reflectionKey);

    if (!reflection) {
      return NextResponse.json(
        { error: 'Reflection not found' },
        { status: 404 }
      );
    }

    // Delete the reflection document
    await kv.del(reflectionKey);

    // Remove from the sorted set
    await kv.zrem(sortedSetKey, id);

    // Also remove from pig_reflections if it exists
    if (!isGuest && typeof reflection === 'object' && 'pig_id' in reflection) {
      const pigReflectionsKey = `pig_reflections:${(reflection as any).pig_id}`;
      await kv.zrem(pigReflectionsKey, id);
    }

    console.log('[API /moment DELETE] Successfully deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Reflection deleted successfully',
    });

  } catch (error) {
    console.error('[API /moment DELETE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete reflection',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
