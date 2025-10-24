/**
 * Sign-in router with dream gate
 * TESTING MODE: Always shows dream on sign-in (hardcoded for testing)
 * TODO: Restore to trigger after 3 new moments, then random K=3-8 selection
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-helpers';
import { Redis } from '@upstash/redis';
import type { PendingDream } from '@/domain/dream/dream.types';
// import { createSeededRandom, DreamSeeds } from '@/domain/dream/seeded-random';

const redis = Redis.fromEnv();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // If no pending dream exists, create one on-the-fly
    if (!pendingDreamData) {
      const scriptId = `dream_${Date.now()}_test`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      pendingDreamData = {
        scriptId,
        kind: 'daily',
        usedMomentIds: [], // Will be populated when fetched
        expiresAt: expiresAt.toISOString(),
        createdAt: now.toISOString(),
      };

      // Store in Redis
      await redis.set(pendingDreamKey, pendingDreamData, {
        ex: 24 * 60 * 60, // 24 hour TTL
      });

      console.log('[Dream Router] Created test dream:', scriptId);
    }

    // Check if expired
    const expiresAt = new Date(pendingDreamData.expiresAt).getTime();
    const now = Date.now();
    
    if (now >= expiresAt) {
      // Expired, create a new one
      const scriptId = `dream_${Date.now()}_test`;
      const nowDate = new Date();
      const expiresAtNew = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000);

      pendingDreamData = {
        scriptId,
        kind: 'daily',
        usedMomentIds: [],
        expiresAt: expiresAtNew.toISOString(),
        createdAt: nowDate.toISOString(),
      };

      await redis.set(pendingDreamKey, pendingDreamData, {
        ex: 24 * 60 * 60,
      });

      console.log('[Dream Router] Refreshed expired dream:', scriptId);
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
