/**
 * POST /api/guest/init
 * 
 * Initialize a guest pig using the identity-resolver system
 * Stores pig profile in Vercel KV at sid:{sid}:profile (same as authenticated users)
 * NO DUPLICATE NAME CHECK - guests can use any name
 * 
 * Body: { pigName: string }
 * Response: { success: true, pigName: string, pigId: string }
 */

import { NextResponse } from 'next/server';
import { resolveIdentity, savePigName } from '@/lib/identity-resolver';

export async function POST(req: Request) {
  try {
    const { pigName } = await req.json();

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

    // Get current identity (will be guest session since not authenticated)
    const identity = await resolveIdentity();

    // Save pig name using identity resolver (writes to Vercel KV)
    const result = await savePigName(identity.effectiveId, sanitizedName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to save pig name' },
        { status: 500 }
      );
    }

    console.log('[Guest Init] Created guest pig:', {
      sid: identity.sid.substring(0, 12) + '...',
      pigName: sanitizedName,
      scope: identity.effectiveScope,
    });

    return NextResponse.json({
      success: true,
      pigName: sanitizedName,
      pigId: identity.sid, // Use sid as pigId for guest sessions
    });
  } catch (err) {
    console.error('[Guest Init] Error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
