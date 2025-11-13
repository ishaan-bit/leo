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

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const identity = await resolveIdentity();

    // For guest users, pigId is sid (already has sid_ prefix from identity-resolver)
    // For authenticated users, use authId
    const pigId = identity.authId || identity.sid;

    console.log('[API /effective] Resolved identity:', {
      mode: identity.effectiveScope === 'user' ? 'auth' : 'guest',
      pigId,
      pigName: identity.pigName,
      sid: identity.sid.substring(0, 12) + '...',
    });

    return NextResponse.json({
      mode: identity.effectiveScope === 'user' ? 'auth' : 'guest',
      pigName: identity.pigName,
      pigId: pigId, // This will be sid_xxx for guests, authId for authenticated
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
