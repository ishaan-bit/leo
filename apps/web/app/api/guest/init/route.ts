/**
 * POST /api/guest/init
 * 
 * Initialize a guest pig (ephemeral, auto-purge after 3 minutes)
 * Stores in Upstash with TTL=180s
 * 
 * Body: { guest_session_id: string, pigName: string }
 * Response: { success: true, pigName: string }
 */

import { NextResponse } from 'next/server';
import { redis } from '@/lib/supabase';

const GUEST_TTL = 180; // 3 minutes in seconds

export async function POST(req: Request) {
  try {
    const { guest_session_id, pigName } = await req.json();

    if (!guest_session_id || typeof guest_session_id !== 'string') {
      return NextResponse.json(
        { error: 'Guest session ID is required' },
        { status: 400 }
      );
    }

    if (!pigName || typeof pigName !== 'string' || !pigName.trim()) {
      return NextResponse.json(
        { error: 'Pig name is required' },
        { status: 400 }
      );
    }

    const sanitizedName = pigName.trim().slice(0, 20);

    // Validate name format (2-20 chars, a-z0-9_-)
    if (sanitizedName.length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-z0-9_-]+$/i.test(sanitizedName)) {
      return NextResponse.json(
        { error: 'Only letters, numbers, hyphens, and underscores allowed' },
        { status: 400 }
      );
    }

    // Create guest session in Upstash with TTL
    const guestData = {
      pigName: sanitizedName,
      created_at: new Date().toISOString(),
    };

    // Store with 180-second TTL (auto-purge)
    await redis.set(
      `guest:${guest_session_id}`,
      JSON.stringify(guestData),
      { ex: GUEST_TTL }
    );

    console.log('[Guest Init] Created guest session:', guest_session_id, sanitizedName, `TTL=${GUEST_TTL}s`);

    return NextResponse.json({
      success: true,
      pigName: sanitizedName,
    });
  } catch (err) {
    console.error('[Guest Init] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
