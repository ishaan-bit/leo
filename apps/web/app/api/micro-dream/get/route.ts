/**
 * Get Micro-Dream API
 * GET /api/micro-dream/get
 * 
 * Fetches micro-dream for current owner_id and optionally clears it
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, getSid, buildOwnerId } from '@/lib/auth-helpers';
import { kv } from '@/lib/kv';

export async function GET(request: NextRequest) {
  try {
    // Get auth and session ID
    const auth = await getAuth();
    const sid = await getSid();
    const userId = auth?.userId || null;
    
    // Build owner_id (same logic as reflect/route.ts)
    const ownerId = buildOwnerId(userId, sid);
    
    if (!ownerId) {
      return NextResponse.json(
        { error: 'No owner_id available' },
        { status: 400 }
      );
    }

    const microDreamKey = `micro_dream:${ownerId}`;
    const clearAfterRead = request.nextUrl.searchParams.get('clear') === 'true';
    
    console.log(`🌙 Fetching micro-dream for owner: ${ownerId} (clear=${clearAfterRead})`);
    
    // Fetch micro-dream from KV
    const microDreamJson = await kv.get<string>(microDreamKey);
    
    if (!microDreamJson) {
      console.log('   No micro-dream found');
      return NextResponse.json({ microDream: null });
    }

    const microDream = JSON.parse(microDreamJson);
    console.log('✅ Micro-dream found:', microDream.lines);
    
    // Clear micro-dream if requested (after displaying)
    if (clearAfterRead) {
      await kv.del(microDreamKey);
      console.log('   Cleared micro-dream after display');
    }
    
    return NextResponse.json({ microDream });

  } catch (error) {
    console.error('❌ Micro-dream get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
