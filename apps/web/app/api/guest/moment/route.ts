/**
 * POST /api/guest/moment
 * 
 * Save a moment/reflection for guest session
 * Merges into existing guest session data in Upstash
 * 
 * Body: { guest_session_id: string, moment: string }
 * Response: { success: true }
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/supabase';

const GUEST_TTL = 180; // 3 minutes in seconds

export async function POST(req: Request) {
  try {
    const { guest_session_id, moment } = await req.json();

    if (!guest_session_id || typeof guest_session_id !== 'string') {
      return NextResponse.json(
        { error: 'Guest session ID is required' },
        { status: 400 }
      );
    }

    if (!moment || typeof moment !== 'string' || !moment.trim()) {
      return NextResponse.json(
        { error: 'Moment is required' },
        { status: 400 }
      );
    }

    // Get existing guest session
    const existingData = await redis.get(`guest:${guest_session_id}`);
    
    if (!existingData) {
      return NextResponse.json(
        { error: 'Guest session not found or expired' },
        { status: 404 }
      );
    }

    // Parse and merge
    const guestData = typeof existingData === 'string' 
      ? JSON.parse(existingData) 
      : existingData;

    guestData.moment = moment.trim();
    guestData.moment_created_at = new Date().toISOString();

    // Update with refreshed TTL
    await redis.set(
      `guest:${guest_session_id}`,
      JSON.stringify(guestData),
      { ex: GUEST_TTL }
    );

    console.log('[Guest Moment] Saved moment for session:', guest_session_id);

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error('[Guest Moment] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
