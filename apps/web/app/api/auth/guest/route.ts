import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateGuestSession } from '@/lib/guest-session';

export async function POST(req: NextRequest) {
  try {
    // Create or get guest session
    const guestUid = await getOrCreateGuestSession();
    
    return NextResponse.json({ 
      ok: true,
      uid: guestUid,
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
