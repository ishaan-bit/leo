/**
 * Pending Dream Letter API
 * Handles one-time check and deletion for epistolary dream letters
 */

import { NextResponse } from 'next/server';
import { resolveIdentity } from '@/lib/identity-resolver';
import { kv } from '@/lib/kv';

/**
 * Dream letter structure from nightly_dream_generator
 */
interface PendingDreamLetter {
  letter_text: string;
  created_at: string; // ISO timestamp
  expiresAt: string; // ISO timestamp
}

/**
 * GET /api/dreams/pending
 * Check if user has a pending dream letter
 * Returns 200 with dream data, 404 if none exists, 401 if not authenticated
 */
export async function GET() {
  try {
    // Get authenticated user ID from next-auth
    const identity = await resolveIdentity();
    const userId = identity.authId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      );
    }

    // Query Upstash for pending dream letter
    const dreamKey = `user:${userId}:pending_dream`;
    const dreamData = await kv.get<PendingDreamLetter>(dreamKey);

    if (!dreamData) {
      return NextResponse.json(
        { exists: false },
        { status: 404 }
      );
    }

    // Check if dream has expired (14-day TTL, but double-check)
    const expiresAt = new Date(dreamData.expiresAt);
    const now = new Date();
    
    if (expiresAt < now) {
      // Expired - delete and return 404
      await kv.del(dreamKey);
      return NextResponse.json(
        { exists: false, reason: 'expired' },
        { status: 404 }
      );
    }

    // Return dream letter data
    return NextResponse.json({
      exists: true,
      dream: dreamData,
    });
    
  } catch (error) {
    console.error('[API] /api/dreams/pending GET error:', error);
    return NextResponse.json(
      { error: 'Failed to check pending dream' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dreams/pending
 * Mark dream letter as read and remove from pending state
 * Returns 204 on success, 401 if not authenticated
 */
export async function DELETE() {
  try {
    // Get authenticated user ID from next-auth
    const identity = await resolveIdentity();
    const userId = identity.authId;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      );
    }

    // Delete pending dream key from Upstash
    const dreamKey = `user:${userId}:pending_dream`;
    await kv.del(dreamKey);

    console.log('[API] /api/dreams/pending deleted for user:', userId);

    // Return 204 No Content (success, no body)
    return new NextResponse(null, { status: 204 });
    
  } catch (error) {
    console.error('[API] /api/dreams/pending DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete pending dream' },
      { status: 500 }
    );
  }
}
