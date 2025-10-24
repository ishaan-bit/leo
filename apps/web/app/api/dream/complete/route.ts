/**
 * Dream completion API
 * Updates dream_state and deletes pending_dream
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { Redis } from '@upstash/redis';
import type { DreamState, PendingDream } from '@/domain/dream/dream.types';

const redis = Redis.fromEnv();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();
    const { scriptId, skipped, skipTime } = body;

    if (!scriptId) {
      return NextResponse.json(
        { error: 'Missing script ID' },
        { status: 400 }
      );
    }

    // Fetch pending dream to get metadata
    const pendingDreamKey = `user:${userId}:pending_dream`;
    const pendingDream = await redis.get<PendingDream>(pendingDreamKey);

    if (!pendingDream || pendingDream.scriptId !== scriptId) {
      return NextResponse.json(
        { error: 'Dream not found or mismatch' },
        { status: 404 }
      );
    }

    // Update dream_state
    const dreamStateKey = `user:${userId}:dream_state`;
    const now = new Date().toISOString();
    
    const newDreamState: DreamState = {
      lastDreamAt: now,
      lastDreamType: pendingDream.kind,
      lastDreamMomentIds: pendingDream.usedMomentIds,
    };

    await redis.set(dreamStateKey, JSON.stringify(newDreamState));

    // Delete pending_dream
    await redis.del(pendingDreamKey);

    // Emit telemetry
    if (skipped) {
      console.log('[Dream] Skipped:', {
        sid: scriptId,
        t: skipTime || 0,
      });
    } else {
      console.log('[Dream] Completed:', {
        sid: scriptId,
        K: pendingDream.beats.filter(b => b.kind === 'moment').length,
      });
    }

    return NextResponse.json({
      success: true,
      redirectTo: '/reflect/new',
    });
  } catch (error) {
    console.error('Error completing dream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
