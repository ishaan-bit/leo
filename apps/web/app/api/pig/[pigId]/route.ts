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
    // Try both NEW and OLD formats
    let profile: PigProfile | null = null;
    let profileKey: string;

    // Check if pigId starts with sid_ (guest session)
    if (pigId.startsWith('sid_')) {
      // NEW format: sid:{sid}:profile
      profileKey = `sid:${pigId}:profile`;
      profile = await kv.get<PigProfile>(profileKey);
    } else {
      // Authenticated user - try NEW format first, then OLD
      
      // NEW format: user:{authId}:profile
      profileKey = `user:${pigId}:profile`;
      profile = await kv.get<PigProfile>(profileKey);
      
      // FALLBACK: OLD format: pig:{authId}
      if (!profile) {
        const oldKey = `pig:${pigId}`;
        const oldProfile = await kv.get<any>(oldKey);
        
        if (oldProfile && oldProfile.pig_name) {
          console.log(`[API /pig/[pigId]] Found pig in old format (pig:${pigId}), migrating...`);
          
          // Return old format for now
          profile = {
            pig_name: oldProfile.pig_name,
            created_at: oldProfile.created_at || new Date().toISOString(),
          };
          
          // TODO: Optionally migrate to new format
          // await kv.set(profileKey, profile);
        }
      }
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
