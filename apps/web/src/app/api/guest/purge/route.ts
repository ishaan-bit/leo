/**
 * POST /api/guest/purge
 * 
 * Purge all guest data after viewing moments (transient mode).
 * Called by MomentsLibrary after 3-minute display timer.
 * 
 * Deletes:
 * - Session profile: sid:{sid}:profile
 * - All moments: sid:{sid}:moments:*
 * - All reflections where owner_id = guest:{sid}
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { resolveIdentity } from '@/lib/identity-resolver';

export async function POST(req: NextRequest) {
  try {
    // Resolve current identity
    const identity = await resolveIdentity();
    
    // Only allow purging for guest sessions (not authenticated users)
    if (identity.effectiveScope !== 'sid') {
      return NextResponse.json(
        { error: 'Purge only allowed for guest sessions' },
        { status: 403 }
      );
    }

    const sid = identity.sid;
    const ownerId = `guest:${sid}`;
    
    console.log(`[Guest Purge] Starting purge for session: ${sid.substring(0, 20)}...`);

    // 1. Delete session profile
    const profileKey = `sid:${sid}:profile`;
    await kv.del(profileKey);
    console.log(`[Guest Purge] Deleted profile: ${profileKey}`);

    // 2. Get all moments for this session
    const momentsPattern = `sid:${sid}:moments:*`;
    let cursor = 0;
    let deletedMoments = 0;
    const reflectionIds: string[] = [];

    do {
      // Scan for moment keys
      const [newCursor, keys] = await kv.scan(cursor, {
        match: momentsPattern,
        count: 100,
      });
      
      cursor = typeof newCursor === 'string' ? parseInt(newCursor, 10) : newCursor;

      if (keys.length > 0) {
        // Get moment data to extract reflection IDs
        const moments = await kv.mget(...keys);
        
        for (const moment of moments) {
          if (moment && typeof moment === 'object' && 'id' in moment) {
            reflectionIds.push(moment.id as string);
          }
        }

        // Delete moment keys
        await kv.del(...keys);
        deletedMoments += keys.length;
        console.log(`[Guest Purge] Deleted ${keys.length} moment keys`);
      }
    } while (cursor !== 0);

    // 3. Delete all reflection data
    let deletedReflections = 0;
    if (reflectionIds.length > 0) {
      const reflectionKeys = reflectionIds.map(rid => `reflection:${rid}`);
      await kv.del(...reflectionKeys);
      deletedReflections = reflectionKeys.length;
      console.log(`[Guest Purge] Deleted ${deletedReflections} reflections`);
    }

    // 4. Optionally delete any metadata or cached data
    // (Add more cleanup here if needed)

    const summary = {
      sid: sid.substring(0, 20) + '...',
      deleted: {
        profile: 1,
        moments: deletedMoments,
        reflections: deletedReflections,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('[Guest Purge] Complete:', summary);

    return NextResponse.json({
      success: true,
      message: 'Guest data purged successfully',
      clearLocalStorage: true, // Signal frontend to clear guest UID
      ...summary,
    });

  } catch (error) {
    console.error('[Guest Purge] Error:', error);
    return NextResponse.json(
      { error: 'Failed to purge guest data', details: String(error) },
      { status: 500 }
    );
  }
}
