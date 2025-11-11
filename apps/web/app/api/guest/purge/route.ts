/**
 * POST /api/guest/purge
 * 
 * Manually purge guest session data (optional - TTL handles auto-purge)
 * 
 * Body: { guest_session_id: string }
 * Response: { success: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import { redis } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { guest_session_id } = await request.json();

    if (!guest_session_id || typeof guest_session_id !== 'string') {
      return NextResponse.json(
        { error: 'Guest session ID is required' },
        { status: 400 }
      );
    }

    // Delete guest session from Upstash
    await redis.del(`guest:${guest_session_id}`);

    console.log('[Guest Purge] Manually purged guest session:', guest_session_id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Guest Purge] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
