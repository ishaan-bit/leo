/**
 * GET /api/pig/fetch
 * Fetch existing pig data for authenticated user
 * Returns pig name if found, error if not signed in or no pig exists
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveIdentity } from '@/lib/identity-resolver';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Resolve current identity
    const identity = await resolveIdentity();

    // Must be authenticated to fetch pig
    if (!identity.authId) {
      return NextResponse.json(
        { error: 'Must be signed in to fetch pig' },
        { status: 401 }
      );
    }

    // Check if user has a pig
    if (!identity.pigName) {
      return NextResponse.json(
        { error: 'No existing pig found for this account' },
        { status: 404 }
      );
    }

    console.log('[API /pig/fetch] Fetched pig:', {
      pigName: identity.pigName,
      userId: identity.authId.substring(0, 12) + '...',
    });

    return NextResponse.json({
      success: true,
      pigName: identity.pigName,
      createdAt: identity.createdAt,
    });
  } catch (error) {
    console.error('[API /pig/fetch] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
