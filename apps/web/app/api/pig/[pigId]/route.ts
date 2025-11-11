/**
 * GET /api/pig/[pigId]
 * 
 * Fetch pig profile by pigId (either user ID or session ID)
 * Works with both authenticated users and guest sessions
 * 
 * Response: { pigId, named: boolean, name: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { kv } from '@vercel/kv';

type PigProfile = {
  pig_name: string;
  created_at: string;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pigId: string }> }) {
  const { pigId } = await params;
  
  try {
    // Try both user and sid formats
    let profile: PigProfile | null = null;
    let profileKey: string;

    // Check if pigId starts with sid_ (guest session)
    if (pigId.startsWith('sid_')) {
      profileKey = `sid:${pigId}:profile`;
      profile = await kv.get<PigProfile>(profileKey);
    } else {
      // Assume it's a user ID
      profileKey = `user:${pigId}:profile`;
      profile = await kv.get<PigProfile>(profileKey);
    }

    if (!profile || !profile.pig_name) {
      return NextResponse.json({ 
        pigId, 
        named: false, 
        name: null 
      });
    }
    
    return NextResponse.json({ 
      pigId, 
      named: true, 
      name: profile.pig_name
    });
  } catch (error) {
    console.error('[API /pig/[pigId]] Error fetching pig:', error);
    return NextResponse.json({ 
      pigId, 
      named: false, 
      name: null 
    }, { status: 500 });
  }
}
