/**
 * Sign-in router with dream gate
 * Conditionally plays dream once (80% seeded chance) or routes to reflect
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { Redis } from '@upstash/redis';
import type { PendingDream } from '@/domain/dream/dream.types';
import { createSeededRandom, DreamSeeds } from '@/domain/dream/seeded-random';

const redis = Redis.fromEnv();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { route: '/reflect/new', reason: 'no_session' },
        { status: 200 }
      );
    }

    const userId = session.user.id;

    // Check for pending dream
    const pendingDreamKey = `user:${userId}:pending_dream`;
    const pendingDreamData = await redis.get<PendingDream>(pendingDreamKey);

    if (!pendingDreamData) {
      // No pending dream, route to reflect
      return NextResponse.json({
        route: '/reflect/new',
        reason: 'no_pending_dream',
      });
    }

    // Check if expired
    const expiresAt = new Date(pendingDreamData.expiresAt).getTime();
    const now = Date.now();
    
    if (now >= expiresAt) {
      // Expired, clean up and route to reflect
      await redis.del(pendingDreamKey);
      return NextResponse.json({
        route: '/reflect/new',
        reason: 'dream_expired',
      });
    }

    // Apply 80% seeded chance to show dream
    const signinSeed = DreamSeeds.signinPlayChance(userId, pendingDreamData.scriptId);
    const rng = createSeededRandom(signinSeed);
    const showDream = rng.chance(0.80);

    if (showDream) {
      // Route to dream player
      return NextResponse.json({
        route: `/dream?sid=${pendingDreamData.scriptId}`,
        reason: 'dream_available',
        scriptId: pendingDreamData.scriptId,
      });
    } else {
      // 20% chance: skip dream, route to reflect
      return NextResponse.json({
        route: '/reflect/new',
        reason: 'seeded_skip',
      });
    }
  } catch (error) {
    console.error('Error in dream router:', error);
    return NextResponse.json(
      { route: '/reflect/new', reason: 'error' },
      { status: 500 }
    );
  }
}
