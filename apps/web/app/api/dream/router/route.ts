/**
 * Sign-in router with dream gate
 * TESTING MODE: Always shows dream on sign-in (hardcoded for testing)
 * TODO: Restore to trigger after 3 new moments, then random K=3-8 selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-helpers';
import { Redis } from '@upstash/redis';
import type { PendingDream, DreamState, ReflectionData } from '@/domain/dream/dream.types';
import { buildDream } from '@/domain/dream/dream-builder';
// import { createSeededRandom, DreamSeeds } from '@/domain/dream/seeded-random';

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
    // Get authenticated user
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json(
        { route: '/reflect/new', reason: 'no_session' },
        { status: 200 }
      );
    }

    const userId = auth.userId;

    // TESTING MODE: Always create/show dream on sign-in
    const pendingDreamKey = `user:${userId}:pending_dream`;
    let pendingDreamData = await redis.get<PendingDream>(pendingDreamKey);

    // If no pending dream exists, build one on-the-fly
    if (!pendingDreamData) {
      console.log('[Dream Router] No pending dream, building one...');
      
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
        console.log('[Dream Router] No reflections found, routing to reflect');
        return NextResponse.json({
          route: '/reflect/new',
          reason: 'no_reflections',
        });
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
        console.log('[Dream Router] No reflection data found');
        return NextResponse.json({
          route: '/reflect/new',
          reason: 'no_data',
        });
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
        console.log('[Dream Router] Dream build failed (ineligible or sporadic gate)');
        return NextResponse.json({
          route: '/reflect/new',
          reason: 'build_failed',
        });
      }

      // Store in Redis (TTL 14 days)
      await redis.set(pendingDreamKey, pendingDreamData, {
        ex: 14 * 24 * 60 * 60,
      });

      console.log('[Dream Router] Built dream:', pendingDreamData.scriptId);
    }

    // Check if expired
    const expiresAt = new Date(pendingDreamData.expiresAt).getTime();
    const now = Date.now();
    
    if (now >= expiresAt) {
      console.log('[Dream Router] Dream expired, rebuilding...');
      
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
        return NextResponse.json({
          route: '/reflect/new',
          reason: 'no_data',
        });
      }

      const date = getKolkataDate();
      pendingDreamData = await buildDream({
        userId,
        reflections,
        dreamState,
        date,
      });

      if (!pendingDreamData) {
        return NextResponse.json({
          route: '/reflect/new',
          reason: 'build_failed',
        });
      }

      await redis.set(pendingDreamKey, pendingDreamData, {
        ex: 14 * 24 * 60 * 60,
      });

      console.log('[Dream Router] Rebuilt expired dream:', pendingDreamData.scriptId);
    }

    // TESTING MODE: Always show dream (100% chance)
    return NextResponse.json({
      route: `/dream?sid=${pendingDreamData.scriptId}`,
      reason: 'testing_mode_always_show',
      scriptId: pendingDreamData.scriptId,
    });

    // ========== ORIGINAL LOGIC (COMMENTED OUT FOR TESTING) ==========
    // Check for pending dream
    // const pendingDreamKey = `user:${userId}:pending_dream`;
    // const pendingDreamData = await redis.get<PendingDream>(pendingDreamKey);

    // if (!pendingDreamData) {
    //   // No pending dream, route to reflect
    //   return NextResponse.json({
    //     route: '/reflect/new',
    //     reason: 'no_pending_dream',
    //   });
    // }

    // // Check if expired
    // const expiresAt = new Date(pendingDreamData.expiresAt).getTime();
    // const now = Date.now();
    
    // if (now >= expiresAt) {
    //   // Expired, clean up and route to reflect
    //   await redis.del(pendingDreamKey);
    //   return NextResponse.json({
    //     route: '/reflect/new',
    //     reason: 'dream_expired',
    //   });
    // }

    // // Apply 80% seeded chance to show dream
    // const signinSeed = DreamSeeds.signinPlayChance(userId, pendingDreamData.scriptId);
    // const rng = createSeededRandom(signinSeed);
    // const showDream = rng.chance(0.80);

    // if (showDream) {
    //   // Route to dream player
    //   return NextResponse.json({
    //     route: `/dream?sid=${pendingDreamData.scriptId}`,
    //     reason: 'dream_available',
    //     scriptId: pendingDreamData.scriptId,
    //   });
    // } else {
    //   // 20% chance: skip dream, route to reflect
    //   return NextResponse.json({
    //     route: '/reflect/new',
    //     reason: 'seeded_skip',
    //   });
    // }
    // ========== END ORIGINAL LOGIC ==========
  } catch (error) {
    console.error('Error in dream router:', error);
    return NextResponse.json(
      { route: '/reflect/new', reason: 'error' },
      { status: 500 }
    );
  }
}
