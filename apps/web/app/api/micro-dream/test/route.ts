/**
 * Test endpoint to manually trigger micro-dream check
 * GET /api/micro-dream/test
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getSid, buildOwnerId } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    // Get auth state
    const auth = await getAuth();
    const sid = await getSid();
    const userId = auth?.userId || null;
    const ownerId = buildOwnerId(userId, sid);

    console.log('🧪 TEST: Manual micro-dream trigger');
    console.log('   Auth:', { userId, sid, ownerId });

    // Call the check endpoint
    const checkUrl = `${process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`}/api/micro-dream/check`;
    
    console.log('   Calling:', checkUrl);

    const response = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerId }),
    });

    const result = await response.json();

    console.log('   Response:', response.status, result);

    return NextResponse.json({
      test: 'manual-trigger',
      ownerId,
      checkUrl,
      responseStatus: response.status,
      result,
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
