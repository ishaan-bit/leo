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
    
    // Get authenticated user
    const auth = await getAuth();
    if (!auth) {
      // Not authenticated, redirect to reflect
      return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
    }

    const userId = auth.userId;

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

      if (reflections.length === 0) {
        console.log('[Dream Gate] No reflection data found');
        return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
      }

      // Build dream
      const date = getKolkataDate();
      pendingDreamData = await buildDream({
        userId,
        reflections,
        dreamState,
        date,
      });

      if (!pendingDreamData) {
        console.log('[Dream Gate] Dream build failed (ineligible or sporadic gate)');
        return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
      }

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

    // TESTING MODE: Always show dream (100% chance)
    console.log('[Dream Gate] Redirecting to dream:', pendingDreamData.scriptId);
    return NextResponse.redirect(new URL(`/dream?sid=${pendingDreamData.scriptId}`, req.url));
    
  } catch (error) {
    console.error('[Dream Gate] Error:', error);
    const { searchParams } = new URL(req.url);
    const pigId = searchParams.get('pigId');
    return NextResponse.redirect(new URL(`/reflect/${pigId || 'new'}`, req.url));
  }
}
