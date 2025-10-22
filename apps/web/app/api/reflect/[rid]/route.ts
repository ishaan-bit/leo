import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * GET /api/reflect/[rid]
 * 
 * Fetch a single reflection by ID
 * Used by interlude polling to check if enrichment is complete
 */

// CRITICAL: Disable all caching - this endpoint must always fetch fresh data
// Enrichment happens asynchronously, so we need to poll for updates
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rid: string }> }
) {
  try {
    const { rid } = await params;

    if (!rid || !rid.startsWith('refl_')) {
      return NextResponse.json(
        { error: 'Invalid reflection ID' },
        { status: 400 }
      );
    }

    // Fetch from Upstash
    const key = `reflection:${rid}`;
    const reflection = await kv.get(key);

    if (!reflection) {
      return NextResponse.json(
        { error: 'Reflection not found' },
        { status: 404 }
      );
    }

    console.log('[GET /api/reflect/[rid]] Raw from Upstash - type:', typeof reflection);
    console.log('[GET /api/reflect/[rid]] Raw first 200 chars:', JSON.stringify(reflection).substring(0, 200));

    // Parse if it's a string (Upstash sometimes returns JSON strings)
    const parsed = typeof reflection === 'string' ? JSON.parse(reflection) : reflection;
    
    console.log('[GET /api/reflect/[rid]] After parsing - has final?:', !!parsed.final);
    
    console.log('[GET /api/reflect/[rid]] Returning reflection:', {
      rid,
      hasFinal: !!parsed.final,
      primary: parsed.final?.wheel?.primary,
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[GET /api/reflect/[rid]] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
