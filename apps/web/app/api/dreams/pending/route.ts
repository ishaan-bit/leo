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
    
    console.log('[API] /api/dreams/pending GET - Full identity:', {
      authId: userId,
      effectiveId: identity.effectiveId,
      effectiveScope: identity.effectiveScope,
      hasPig: !!identity.pigName
    });
    
    if (!userId) {
      console.log('[API] /api/dreams/pending - No userId, returning 401');
      return NextResponse.json(
        { error: 'Unauthorized - please sign in' },
        { status: 401 }
      );
    }

    // Query Upstash for pending dream letter
    const dreamKey = `user:${userId}:pending_dream`;
    console.log('[API] /api/dreams/pending - Checking key:', dreamKey);
    
    let dreamData = await kv.get(dreamKey);
    console.log('[API] /api/dreams/pending - Data found:', !!dreamData, 'Type:', typeof dreamData);

    // DEBUGGING: If not found, try to find ANY pending dream for this user
    // This helps diagnose if the userId format is different
    if (!dreamData) {
      console.log('[API] /api/dreams/pending - Searching for alternate keys...');
      try {
        // Try common variations
        const alternateKeys = [
          `user:${userId}:pending_dream`,
          `user_${userId}:pending_dream`,
          `sid:${userId}:pending_dream`,
        ];
        
        for (const altKey of alternateKeys) {
          const altData = await kv.get(altKey);
          if (altData) {
            console.log('[API] /api/dreams/pending - FOUND with alternate key:', altKey);
            dreamData = altData;
            break;
          }
        }
      } catch (err) {
        console.error('[API] /api/dreams/pending - Error checking alternates:', err);
      }
    }

    if (!dreamData) {
      console.log('[API] /api/dreams/pending - No data after all checks, returning 404');
      return NextResponse.json(
        { exists: false },
        { status: 404 }
      );
    }

    // Parse if it's a JSON string (from Python nightly_dream_generator)
    let parsedDream: PendingDreamLetter;
    if (typeof dreamData === 'string') {
      console.log('[API] /api/dreams/pending - Parsing JSON string');
      parsedDream = JSON.parse(dreamData);
    } else {
      console.log('[API] /api/dreams/pending - Using data as-is');
      parsedDream = dreamData as PendingDreamLetter;
    }

    // Check if dream has expired (14-day TTL, but double-check)
    const expiresAt = new Date(parsedDream.expiresAt);
    const now = new Date();
    
    console.log('[API] /api/dreams/pending - Expiry check:', {
      expiresAt: expiresAt.toISOString(),
      now: now.toISOString(),
      expired: expiresAt < now
    });
    
    if (expiresAt < now) {
      // Expired - delete and return 404
      console.log('[API] /api/dreams/pending - Dream expired, deleting');
      await kv.del(dreamKey);
      return NextResponse.json(
        { exists: false, reason: 'expired' },
        { status: 404 }
      );
    }

    // Return dream letter data
    console.log('[API] /api/dreams/pending - Returning dream data');
    return NextResponse.json({
      exists: true,
      dream: parsedDream,
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
