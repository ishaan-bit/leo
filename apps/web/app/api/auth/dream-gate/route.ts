/**
 * Dream Gate - Post-authentication router
 * Called after successful Google sign-in to decide: dream or reflect
 * TESTING MODE: Always checks dream router
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-helpers';
import { Redis } from '@upstash/redis';
import type { PendingDream, DreamState, ReflectionData } from '@/domain/dream/dream.types';
import { buildDream } from '@/domain/dream/dream-builder';
import { isForceDreamEnabled } from '@/lib/feature-flags';

const redis = Redis.fromEnv();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Get current date in Asia/Kolkata timezone (YYYY-MM-DD)
 */
function getKolkataDate(): string {
  const now = new Date();
  const kolkataTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return kolkataTime.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pigId = searchParams.get('pigId');
    
    console.log('[Dream Gate] ========== ENTRY ==========');
    console.log('[Dream Gate] PigId:', pigId);
    console.log('[Dream Gate] URL:', req.url);
    
    // Get authenticated user
    const auth = await getAuth();
    console.log('[Dream Gate] Auth result:', auth ? `Authenticated (${auth.userId})` : 'Not authenticated');
    
    if (!auth) {
      // Not authenticated, redirect to reflect
      console.log('[Dream Gate] No auth, redirecting to reflect');
      return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
    }

    const userId = auth.userId;

    // Check if force_dream is enabled (feature flag or query param)
    const forceDream = await isForceDreamEnabled(userId, searchParams);
    console.log('[Dream Gate] force_dream:', forceDream ? 'ENABLED' : 'disabled');
    console.log('[Dream Gate] Checking for user:', userId);

    // Check for pending dream
    const pendingDreamKey = `user:${userId}:pending_dream`;
    let pendingDreamData = await redis.get<PendingDream>(pendingDreamKey);

    // If no pending dream exists, build one on-the-fly
    if (!pendingDreamData) {
      console.log('[Dream Gate] No pending dream, building one...');
      
      // Fetch dream state
      const dreamStateKey = `user:${userId}:dream_state`;
      const dreamState = await redis.get<DreamState>(dreamStateKey);

      // Fetch user's reflections (last 180 days)
      const reflectionsKey = `user:${userId}:refl:idx`;
      const cutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
      
      const reflectionIds = await redis.zrange(
        reflectionsKey,
        cutoff,
        Date.now(),
        { byScore: true }
      ) as string[];

      console.log('[Dream Gate] Reflection IDs found:', reflectionIds?.length || 0);
      
      if (!reflectionIds || reflectionIds.length === 0) {
        console.log('[Dream Gate] No reflections found, routing to reflect');
        return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
      }

      // Fetch reflection data
      const reflections: ReflectionData[] = [];
      for (const rid of reflectionIds) {
        const reflData = await redis.get<ReflectionData>(`refl:${rid}`);
        if (reflData) {
          reflections.push(reflData);
        }
      }

      console.log('[Dream Gate] Reflections loaded:', reflections.length);
      
      if (reflections.length === 0) {
        console.log('[Dream Gate] No reflection data found');
        return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
      }

      // Build dream
      const date = getKolkataDate();
      console.log('[Dream Gate] Calling buildDream with', reflections.length, 'reflections');
      console.log('[Dream Gate] Dream state:', dreamState ? `Exists (lastDreamAt: ${dreamState.lastDreamAt})` : 'null');
      console.log('[Dream Gate] force_dream mode:', forceDream);
      
      pendingDreamData = await buildDream({
        userId,
        reflections,
        dreamState: forceDream ? null : dreamState, // Clear state in test mode
        date,
        testMode: forceDream, // Pass testMode flag
      });

      if (pendingDreamData && forceDream) {
        console.log('[Dream Gate] force_dream_build:', {
          sid: pendingDreamData.scriptId,
          K: pendingDreamData.beats.filter(b => b.kind === 'moment').length,
          candidate_count: reflections.length,
          primaries_used: [...new Set(pendingDreamData.beats.filter(b => b.building).map(b => b.building))],
          time_buckets_used: [...new Set(pendingDreamData.beats.filter(b => b.momentId).map(() => 'T0-T4'))], // Simplified
        });
      }

      console.log('[Dream Gate] buildDream result:', pendingDreamData ? `Success (${pendingDreamData.scriptId})` : 'Failed (null)');
      
      if (!pendingDreamData) {
        console.log('[Dream Gate] Dream build failed - no valid candidates or malformed data');
        return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
      }

      console.log('[Dream Gate] Dream beats count:', pendingDreamData.beats?.length || 0);
      
      // Store in Redis (TTL 14 days)
      await redis.set(pendingDreamKey, pendingDreamData, {
        ex: 14 * 24 * 60 * 60,
      });

      console.log('[Dream Gate] Built dream:', pendingDreamData.scriptId);
    }

    // Check if expired
    const expiresAt = new Date(pendingDreamData.expiresAt).getTime();
    const now = Date.now();
    
    if (now >= expiresAt) {
      console.log('[Dream Gate] Dream expired, rebuilding...');
      
      // Expired, rebuild
      const dreamStateKey = `user:${userId}:dream_state`;
      const dreamState = await redis.get<DreamState>(dreamStateKey);

      const reflectionsKey = `user:${userId}:refl:idx`;
      const cutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
      
      const reflectionIds = await redis.zrange(
        reflectionsKey,
        cutoff,
        Date.now(),
        { byScore: true }
      ) as string[];

      const reflections: ReflectionData[] = [];
      for (const rid of reflectionIds) {
        const reflData = await redis.get<ReflectionData>(`refl:${rid}`);
        if (reflData) {
          reflections.push(reflData);
        }
      }

      if (reflections.length === 0) {
        return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
      }

      const date = getKolkataDate();
      pendingDreamData = await buildDream({
        userId,
        reflections,
        dreamState,
        date,
      });

      if (!pendingDreamData) {
        return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
      }

      await redis.set(pendingDreamKey, pendingDreamData, {
        ex: 14 * 24 * 60 * 60,
      });

      console.log('[Dream Gate] Rebuilt expired dream:', pendingDreamData.scriptId);
    }

    // Route to dream
    const pendingExists = !!pendingDreamData;
    const builtNow = !pendingExists; // If we got here, it was either found or built
    
    console.log('[Dream Gate] force_dream_router:', {
      entering: true,
      pending_found: pendingExists,
      built_now: builtNow,
      sid: pendingDreamData.scriptId,
      force_dream: forceDream,
    });
    
    console.log('[Dream Gate] Redirecting to dream:', pendingDreamData.scriptId);
    
    // Pass forceDream param to dream page for TEST MODE badge
    const dreamUrl = new URL(`/dream`, req.url);
    dreamUrl.searchParams.set('sid', pendingDreamData.scriptId);
    if (forceDream) {
      dreamUrl.searchParams.set('testMode', '1');
    }
    
    return NextResponse.redirect(dreamUrl);
    
  } catch (error) {
    console.error('[Dream Gate] Error:', error);
    const { searchParams } = new URL(req.url);
    const pigId = searchParams.get('pigId');
    return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
  }
}
