/**
 * Inactivity Worker API - Builds pending dreams for eligible users
 * Triggered daily at 06:00 Asia/Kolkata (cron job)
 */

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import type { DreamState, ReflectionData, PendingDream } from '@/domain/dream/dream.types';
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

/**
 * Build dream for a single user
 */
async function buildDreamForUser(userId: string, date: string): Promise<{
  success: boolean;
  reason?: string;
  scriptId?: string;
}> {
  try {
    // 1. Idempotent lock
    const lockKey = `user:${userId}:locks:build_dream:${date}`;
    const existingLock = await redis.get(lockKey);
    
    if (existingLock) {
      return { success: false, reason: 'lock_exists' };
    }

    // 2. Check for existing pending dream
    const pendingDreamKey = `user:${userId}:pending_dream`;
    const existingDream = await redis.get<PendingDream>(pendingDreamKey);
    
    if (existingDream) {
      const expiresAt = new Date(existingDream.expiresAt).getTime();
      if (Date.now() < expiresAt) {
        return { success: false, reason: 'pending_exists' };
      }
    }

    // 3. Fetch dream state
    const dreamStateKey = `user:${userId}:dream_state`;
    const dreamState = await redis.get<DreamState>(dreamStateKey);

    // 4. Fetch user's reflections (last 180 days)
    const reflectionsKey = `user:${userId}:refl:idx`;
    const cutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
    
    // Get reflection IDs from sorted set
    const reflectionIds = await redis.zrangebyscore(
      reflectionsKey,
      cutoff,
      Date.now()
    );

    if (!reflectionIds || reflectionIds.length === 0) {
      return { success: false, reason: 'no_reflections' };
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
      return { success: false, reason: 'no_data' };
    }

    // 5. Build dream
    const pendingDream = await buildDream({
      userId,
      reflections,
      dreamState,
      date,
    });

    if (!pendingDream) {
      return { success: false, reason: 'build_failed' };
    }

    // 6. Persist pending dream (TTL 14 days)
    await redis.set(
      pendingDreamKey,
      JSON.stringify(pendingDream),
      { ex: 14 * 24 * 60 * 60 }
    );

    // 7. Set lock (TTL 24 hours)
    await redis.set(
      lockKey,
      pendingDream.scriptId,
      { ex: 24 * 60 * 60 }
    );

    // 8. Emit telemetry
    console.log('[Dream] Built:', {
      sid: pendingDream.scriptId,
      userId,
      kind: pendingDream.kind,
      K: pendingDream.beats.filter(b => b.kind === 'moment').length,
    });

    return {
      success: true,
      scriptId: pendingDream.scriptId,
    };
  } catch (error) {
    console.error(`[Dream] Build error for user ${userId}:`, error);
    return { success: false, reason: 'error' };
  }
}

/**
 * Main worker endpoint
 * In production, this should be called by a cron job (Vercel Cron, GitHub Actions, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret (security)
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const date = getKolkataDate();
    console.log(`[Dream Worker] Starting for date: ${date}`);

    // Get list of user IDs (this needs to be adapted to your user storage)
    // For now, we'll accept user IDs from request body
    const { userIds } = await req.json();
    
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: 'No user IDs provided' },
        { status: 400 }
      );
    }

    const results = {
      total: userIds.length,
      built: 0,
      skipped: 0,
      errors: 0,
      reasons: {} as Record<string, number>,
    };

    // Process each user
    for (const userId of userIds) {
      const result = await buildDreamForUser(userId, date);
      
      if (result.success) {
        results.built++;
      } else {
        results.skipped++;
        const reason = result.reason || 'unknown';
        results.reasons[reason] = (results.reasons[reason] || 0) + 1;
      }
    }

    console.log('[Dream Worker] Complete:', results);

    return NextResponse.json({
      success: true,
      date,
      results,
    });
  } catch (error) {
    console.error('[Dream Worker] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Cleanup endpoint - removes expired pending dreams
 * Should run nightly
 */
export async function DELETE(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'dev-secret';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // This is a simplified version - in production you'd scan for all pending_dream keys
    // and check expiration. For now, Redis TTL handles cleanup automatically.
    
    console.log('[Dream Cleanup] Expired dreams removed (handled by Redis TTL)');

    return NextResponse.json({
      success: true,
      message: 'Cleanup complete (automatic via TTL)',
    });
  } catch (error) {
    console.error('[Dream Cleanup] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
