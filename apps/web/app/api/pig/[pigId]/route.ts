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

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type PigProfile = {
  pig_name: string;
  created_at: string;
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pigId: string }> }) {
  let pigId: string;
  
  try {
    const resolvedParams = await params;
    pigId = resolvedParams.pigId;
    
    console.log(`[API /pig/[pigId]] Request for pigId: ${pigId}`);
  } catch (error) {
    console.error('[API /pig/[pigId]] ❌ Failed to resolve params:', error);
    return NextResponse.json({ 
      pigId: 'unknown', 
      named: false, 
      name: null,
      error: 'Invalid request'
    }, { status: 400 });
  }
  
  try {
    // Try both NEW and OLD formats
    let profile: PigProfile | null = null;
    let profileKey: string;

    // Check if pigId starts with sid_ (guest session)
    if (pigId.startsWith('sid_')) {
      // NEW format: sid:{sid}:profile
      profileKey = `sid:${pigId}:profile`;
      profile = await kv.get<PigProfile>(profileKey);
      
      console.log(`[API /pig/[pigId]] Guest lookup at ${profileKey}:`, profile ? 'Found' : 'Not found');
    } else {
      // Authenticated user - try NEW format first, then OLD
      
      // NEW format: user:{authId}:profile
      profileKey = `user:${pigId}:profile`;
      profile = await kv.get<PigProfile>(profileKey);
      
      console.log(`[API /pig/[pigId]] New format lookup at ${profileKey}:`, profile ? 'Found' : 'Not found');
      
      // FALLBACK: OLD format: pig:{authId}
      if (!profile) {
        const oldKey = `pig:${pigId}`;
        
        console.log(`[API /pig/[pigId]] Trying old format at ${oldKey}...`);
        
        const oldProfile = await kv.get(oldKey);
        
        console.log(`[API /pig/[pigId]] Old format result type:`, typeof oldProfile);
        console.log(`[API /pig/[pigId]] Old format result value:`, JSON.stringify(oldProfile));
        
        if (oldProfile) {
          // Handle both string and object formats
          let parsedProfile: any;
          
          if (typeof oldProfile === 'string') {
            try {
              parsedProfile = JSON.parse(oldProfile);
              console.log(`[API /pig/[pigId]] Parsed string to:`, parsedProfile);
            } catch (e) {
              console.error(`[API /pig/[pigId]] Failed to parse old profile:`, e);
              parsedProfile = null;
            }
          } else {
            parsedProfile = oldProfile;
            console.log(`[API /pig/[pigId]] Using object directly:`, parsedProfile);
          }
          
          console.log(`[API /pig/[pigId]] Checking for pig_name field...`);
          console.log(`[API /pig/[pigId]] parsedProfile?.pig_name:`, parsedProfile?.pig_name);
          console.log(`[API /pig/[pigId]] parsedProfile?.name:`, parsedProfile?.name);
          console.log(`[API /pig/[pigId]] All keys:`, Object.keys(parsedProfile || {}));
          
          if (parsedProfile && (parsedProfile.pig_name || parsedProfile.name)) {
            const pigNameValue = parsedProfile.pig_name || parsedProfile.name;
            console.log(`[API /pig/[pigId]] ✅ Found pig in old format: ${pigNameValue}`);
            
            profile = {
              pig_name: pigNameValue,
              created_at: parsedProfile.created_at || new Date().toISOString(),
            };
          } else {
            console.log(`[API /pig/[pigId]] ❌ No pig_name or name field found in old format`);
          }
        }
      }
    }

    if (!profile || !profile.pig_name) {
      console.log(`[API /pig/[pigId]] ❌ No pig found for ${pigId}`);
      return NextResponse.json({ 
        pigId, 
        named: false, 
        name: null 
      });
    }
    
    console.log(`[API /pig/[pigId]] ✅ Returning pig: ${profile.pig_name}`);
    
    return NextResponse.json({ 
      pigId, 
      named: true, 
      name: profile.pig_name
    });
  } catch (error) {
    console.error('[API /pig/[pigId]] ❌ Error fetching pig:', error);
    console.error('[API /pig/[pigId]] Stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Always return the expected shape, even on error
    return NextResponse.json({ 
      pigId, 
      named: false, 
      name: null
    }, { status: 200 }); // Return 200 to avoid breaking client
  }
}
