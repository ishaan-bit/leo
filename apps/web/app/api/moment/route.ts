/**
 * POST /api/moment
 * 
 * Save a moment/reflection for authenticated user
 * Persists to database (Redis for now, can migrate to Supabase later)
 * 
 * Body: { moment: string }
 * Response: { success: true, momentId: string }
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { redis } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    // Must be authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Must be signed in' },
        { status: 401 }
      );
    }

    const { moment } = await req.json();

    if (!moment || typeof moment !== 'string' || !moment.trim()) {
      return NextResponse.json(
        { error: 'Moment is required' },
        { status: 400 }
      );
    }

    const userId = session.user.email;

    // Get user's pig ID
    const pigId = await redis.get(`user_pig:${userId}`);
    
    if (!pigId) {
      return NextResponse.json(
        { error: 'No pig found. Please create a pig first.' },
        { status: 404 }
      );
    }

    // Create moment
    const momentId = uuidv4();
    const momentData = {
      id: momentId,
      pig_id: pigId,
      user_id: userId,
      content: moment.trim(),
      created_at: new Date().toISOString(),
    };

    // Store moment
    await redis.hset(`moment:${momentId}`, momentData);
    
    // Add to pig's moments sorted set (sorted by timestamp)
    const timestamp = Date.now();
    await redis.zadd(`pig_moments:${pigId}`, { score: timestamp, member: momentId });

    console.log('[API /moment] Created moment:', momentId, 'for pig:', pigId);

    return NextResponse.json({
      success: true,
      momentId,
    });
  } catch (err) {
    console.error('[API /moment] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
