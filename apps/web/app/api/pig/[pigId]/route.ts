import { NextRequest, NextResponse } from "next/server";
import { redis } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ pigId: string }> }) {
  const { pigId } = await params;
  
  // Check if pigId looks like a UUID (contains hyphens) vs a pig name
  const isUUID = pigId.includes('-');
  
  if (isUUID) {
    // Fetch by pigId from Redis
    try {
      const pigData = await redis.hgetall(`pig:${pigId}`);
      
      if (!pigData || !pigData.name) {
        return NextResponse.json({ 
          pigId, 
          named: false, 
          name: null 
        });
      }
      
      return NextResponse.json({ 
        pigId, 
        named: true, 
        name: pigData.name
      });
    } catch (error) {
      console.error('[API /pig/[pigId]] Error fetching pig by ID:', error);
      return NextResponse.json({ 
        pigId, 
        named: false, 
        name: null 
      });
    }
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
