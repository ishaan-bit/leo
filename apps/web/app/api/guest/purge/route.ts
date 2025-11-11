/**
 * POST /api/guest/purge
 * Purge all guest data after Living City display
 * 
 * For guest users only: Delete pig_name, profile, reflections
 * This ensures guest mode is truly transient
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { resolveIdentity } from '@/lib/identity-resolver';

export async function POST(request: NextRequest) {
  try {
    // Resolve current identity
    const identity = await resolveIdentity();

    // Only purge for guest users (sid scope, not authenticated)
    if (identity.authId) {
      console.log('[API /guest/purge] ⚠️ Skipping purge - user is authenticated');
      return NextResponse.json({
        success: false,
        reason: 'Cannot purge authenticated user data',
      });
    }

    console.log('[API /guest/purge] 🗑️ Starting guest data purge for sid:', identity.sid.substring(0, 12) + '...');

    // 1. Delete profile (pig_name, created_at)
    const profileKey = `sid:${identity.sid}:profile`;
    await kv.del(profileKey);
    console.log('[API /guest/purge] ✅ Deleted profile:', profileKey);

    // 2. Delete all reflections for this guest
    const reflectionsKey = `pig_reflections:${identity.sid}`;
    const reflectionIds = await kv.zrange(reflectionsKey, 0, -1);
    
    if (reflectionIds && reflectionIds.length > 0) {
      console.log('[API /guest/purge] 📋 Found', reflectionIds.length, 'reflections to delete');
      
      // Delete each reflection
      for (const rid of reflectionIds) {
        const reflectionKey = `reflection:${rid}`;
        await kv.del(reflectionKey);
        console.log('[API /guest/purge] 🗑️ Deleted reflection:', reflectionKey);
      }
      
      // Delete the sorted set itself
      await kv.del(reflectionsKey);
      console.log('[API /guest/purge] ✅ Deleted reflections sorted set:', reflectionsKey);
    }

    // 3. Delete any other guest-related keys (counters, etc.)
    const counterKey = `${identity.effectiveId}:signin_count`;
    const cursorKey = `${identity.effectiveId}:dream_gap_cursor`;
    await kv.del(counterKey);
    await kv.del(cursorKey);

    console.log('[API /guest/purge] ✨ Guest data purge complete!', {
      sid: identity.sid.substring(0, 12) + '...',
      reflectionsPurged: reflectionIds?.length || 0,
    });

    return NextResponse.json({
      success: true,
      purged: {
        profile: true,
        reflections: reflectionIds?.length || 0,
      },
    });
  } catch (error) {
    console.error('[API /guest/purge] ❌ Error purging guest data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
