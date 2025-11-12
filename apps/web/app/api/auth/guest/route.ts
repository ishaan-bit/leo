import { NextRequest, NextResponse } from 'next/server';
import { resolveIdentity } from '@/lib/identity-resolver';

export async function POST(req: NextRequest) {
  try {
    // Use identity-resolver to get/create guest session
    // It automatically handles sid_xxx format and cookie management
    const identity = await resolveIdentity();
    
    // Verify it's a guest session (not authenticated)
    if (identity.effectiveScope !== 'sid') {
      return NextResponse.json(
        { error: 'Expected guest session but got authenticated user' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({ 
      ok: true,
      uid: identity.sid,  // Returns sid_xxx format (correct)
      type: 'guest'
    });
  } catch (error) {
    console.error('Error creating guest session:', error);
    return NextResponse.json(
      { error: 'Failed to create guest session' },
      { status: 500 }
    );
  }
}
