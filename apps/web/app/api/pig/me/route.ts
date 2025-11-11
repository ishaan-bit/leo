/**
 * GET /api/pig/me
 * 
 * Get current authenticated user's pig
 * Returns pig name and metadata
 * 
 * Response: { pigName: string, createdAt: string } | 404
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { redis } from '@/lib/supabase';

export async function GET() {
  try {
    // Must be authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Must be signed in' },
        { status: 401 }
      );
    }

    const userId = session.user.email; // Using email as user ID

    // Get user's pig ID
    const pigId = await redis.get(`user_pig:${userId}`);
    
    if (!pigId) {
      return NextResponse.json(
        { error: 'No pig found for this user' },
        { status: 404 }
      );
    }

    // Get pig data
    const pigData = await redis.hgetall(`pig:${pigId}`);
    
    if (!pigData || !pigData.name) {
      return NextResponse.json(
        { error: 'Pig data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      pigName: pigData.name as string,
      createdAt: pigData.created_at as string,
    });
  } catch (err) {
    console.error('[API /pig/me] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
