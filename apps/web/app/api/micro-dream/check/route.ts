/**
 * Micro-Dream Trigger API
 * POST: Increment signin counter when reflection is created
 * TODO: Later integrate with Python agent for actual micro-dream generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

/**
 * Simple counter increment for now - proves the trigger works
 * Python agent integration will come after we verify this fires
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId } = body;

    if (!ownerId) {
      return NextResponse.json({
        error: 'Missing ownerId',
        code: 'VALIDATION_FAILED',
      }, { status: 400 });
    }

    console.log('🌙 Micro-dream check triggered for:', ownerId);

    // Increment signin counter
    const signinCountKey = `signin_count:${ownerId}`;
    const newCount = await kv.incr(signinCountKey);

    console.log(`✅ Incremented ${signinCountKey} to ${newCount}`);

    // For now, return simple response
    // TODO: Later call Python agent to generate actual micro-dream
    return NextResponse.json({
      ok: true,
      signinCount: newCount,
      message: 'Counter incremented (Python agent integration pending)',
    });

  } catch (error) {
    console.error('❌ Micro-dream check error:', error);
    
    return NextResponse.json({
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
