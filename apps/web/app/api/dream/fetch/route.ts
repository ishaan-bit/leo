/**
 * API route to fetch pending dream by script ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-helpers';
import { Redis } from '@upstash/redis';
import type { PendingDream } from '@/domain/dream/dream.types';

const redis = Redis.fromEnv();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = auth.userId;
    const { searchParams } = new URL(req.url);
    const scriptId = searchParams.get('sid');

    if (!scriptId) {
      return NextResponse.json(
        { error: 'Missing script ID' },
        { status: 400 }
      );
    }

    // Fetch pending dream
    const pendingDreamKey = `user:${userId}:pending_dream`;
    const pendingDream = await redis.get<PendingDream>(pendingDreamKey);

    if (!pendingDream) {
      return NextResponse.json(
        { error: 'Dream not found' },
        { status: 404 }
      );
    }

    // Verify script ID matches
    if (pendingDream.scriptId !== scriptId) {
      return NextResponse.json(
        { error: 'Script ID mismatch' },
        { status: 403 }
      );
    }

    // Check if expired
    const expiresAt = new Date(pendingDream.expiresAt).getTime();
    const now = Date.now();
    
    if (now >= expiresAt) {
      // Expired, clean up
      await redis.del(pendingDreamKey);
      return NextResponse.json(
        { error: 'Dream expired' },
        { status: 410 }
      );
    }

    // Return dream data
    return NextResponse.json({
      dream: pendingDream,
    });
  } catch (error) {
    console.error('Error fetching pending dream:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
