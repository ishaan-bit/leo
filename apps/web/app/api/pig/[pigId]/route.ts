import { NextRequest, NextResponse } from "next/server";
import { getPigName } from "@/domain/pig/pig.storage";
import { redis } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pigId: string }> }) {
  const { pigId } = await params;
  
  // Check if pigId looks like a UUID (contains hyphens) vs a pig name
  const isUUID = pigId.includes('-');
  
  if (isUUID) {
    // Fetch by pigId from Vercel KV (persists across serverless invocations, browsers, and devices)
    const name = await getPigName(pigId);
    
    return NextResponse.json({ 
      pigId, 
      named: !!name, 
      name 
    });
  } else {
    // Lookup by name → get pigId
    try {
      const resolvedPigId = await redis.get(`pig_name:${pigId}`);
      
      if (!resolvedPigId) {
        return NextResponse.json({ 
          pigId, 
          named: false, 
          name: null 
        });
      }
      
      // Fetch the full pig data
      const pigData = await redis.hgetall(`pig:${resolvedPigId}`);
      
      return NextResponse.json({ 
        pigId: resolvedPigId, 
        named: true, 
        name: pigData?.name || pigId
      });
    } catch (error) {
      console.error('[API /pig/[pigId]] Error looking up by name:', error);
      return NextResponse.json({ 
        pigId, 
        named: false, 
        name: null 
      });
    }
  }
}
