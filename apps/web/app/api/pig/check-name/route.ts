/**
 * POST /api/pig/check-name
 * Check if a pig name is already taken for the current user
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { resolveIdentity } from '@/lib/identity-resolver';

export async function POST(request: NextRequest) {
  try {
    const { pigName } = await request.json();

    if (!pigName || typeof pigName !== 'string') {
      return NextResponse.json(
        { error: 'Invalid pig name' },
        { status: 400 }
      );
    }

    // Resolve current user identity
    const identity = await resolveIdentity();

    // Only check uniqueness for authenticated users
    if (!identity.authId) {
      // Guest users don't need uniqueness check
      return NextResponse.json({ available: true });
    }

    // Check if this name is already taken by this user
    const normalizedName = pigName.trim().toLowerCase();
    const nameKey = `pig_name:${identity.authId}:${normalizedName}`;
    
    const exists = await kv.exists(nameKey);

    if (exists) {
      return NextResponse.json(
        { error: 'NAME_TAKEN', available: false },
        { status: 409 }
      );
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error('[API /pig/check-name] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
