/**
 * Effective Identity API
 * 
 * Route: /api/effective
 * 
 * Returns the resolved identity for the current request.
 * Client components should call this instead of using useSession()
 * to avoid fragile auth state detection.
 * 
 * Response:
 * {
 *   mode: 'auth' | 'guest',
 *   pigName: string | null,
 *   effectiveId: string,
 *   sid: string,
 *   authId: string | null
 * }
 */

import { NextResponse } from 'next/server';
import { resolveIdentity } from '@/lib/identity-resolver';

export async function GET() {
  try {
    const identity = await resolveIdentity();

    return NextResponse.json({
      mode: identity.effectiveScope === 'user' ? 'auth' : 'guest',
      pigName: identity.pigName,
      effectiveId: identity.effectiveId,
      sid: identity.sid.substring(0, 12) + '...', // Truncated for security
      authId: identity.authId ? identity.authId.substring(0, 12) + '...' : null,
      createdAt: identity.createdAt,
    });
  } catch (error) {
    console.error('[API /effective] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve identity' },
      { status: 500 }
    );
  }
}
