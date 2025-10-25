/**
 * Get Micro-Dream API
 * GET /api/micro-dream/get
 * 
 * Fetches micro-dream for current owner_id and optionally clears it
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getSid, buildOwnerId } from '@/lib/auth-helpers';
import { kv } from '@/lib/kv';

// Force dynamic rendering (required for cookies/session)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🌙 [1/5] Micro-dream API called');
    
    // Get auth and session ID
    const auth = await getAuth();
    console.log('🌙 [2/5] Auth result:', auth ? 'authenticated' : 'guest');
    
    const sid = await getSid();
    console.log('🌙 [3/5] Session ID:', sid);
    
    const userId = auth?.userId || null;
    
    // Build owner_id (same logic as reflect/route.ts)
    const ownerId = buildOwnerId(userId, sid);
    console.log('🌙 [4/5] Owner ID:', ownerId);
    
    if (!ownerId) {
      console.error('❌ No owner_id available');
      return NextResponse.json(
        { error: 'No owner_id available' },
        { status: 400 }
      );
    }

    const microDreamKey = `micro_dream:${ownerId}`;
    const clearAfterRead = request.nextUrl.searchParams.get('clear') === 'true';
    
    console.log(`🌙 [5/5] Fetching micro-dream key: ${microDreamKey} (clear=${clearAfterRead})`);
    
    // Fetch micro-dream from KV
    const microDreamData = await kv.get(microDreamKey);
    
    if (!microDreamData) {
      console.log('   No micro-dream found in KV');
      return NextResponse.json({ microDream: null });
    }

    // Parse if it's a string, otherwise use as-is
    const microDream = typeof microDreamData === 'string' 
      ? JSON.parse(microDreamData) 
      : microDreamData;
      
    console.log('✅ Micro-dream found:', microDream?.lines || 'no lines');
    
    // Clear micro-dream if requested (after displaying)
    if (clearAfterRead) {
      await kv.del(microDreamKey);
      console.log('   Cleared micro-dream after display');
    }
    
    return NextResponse.json({ microDream });

  } catch (error) {
    console.error('❌ Micro-dream get error:', error);
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'no stack');
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
