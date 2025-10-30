import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getPigName } from '@/domain/pig/pig.storage';

// This API serves publicly shareable moments
// It only returns non-sensitive data suitable for sharing
export async function GET(
  request: NextRequest,
  { params }: { params: { momentId: string } }
) {
  const { momentId } = params;

  try {
    console.log('[Share API] Request for momentId:', momentId);

    // Fetch moment from Redis using @vercel/kv (same as moments API)
    const reflectionKey = `reflection:${momentId}`;
    console.log('[Share API] Fetching key:', reflectionKey);
    
    const reflectionData = await kv.get(reflectionKey);
    
    if (!reflectionData) {
      console.error('[Share API] Reflection not found:', reflectionKey);
      return NextResponse.json(
        { error: 'Moment not found' },
        { status: 404 }
      );
    }
    
    // Parse if it's a string
    const moment = typeof reflectionData === 'string' 
      ? JSON.parse(reflectionData) 
      : reflectionData;

    console.log('[Share API] Found moment:', {
      hasData: !!moment,
      hasFinal: !!moment?.final,
      hasText: !!(moment?.normalized_text || moment?.raw_text || moment?.text),
    });

    if (!moment || !moment.final) {
      console.error('[Share API] Moment data incomplete');
      return NextResponse.json(
        { error: 'Moment not found or not enriched yet' },
        { status: 404 }
      );
    }

    // Fetch pig name from pig storage
    let pigName = 'Noen';
    if (moment.pig_id) {
      const fetchedName = await getPigName(moment.pig_id);
      if (fetchedName) {
        pigName = fetchedName;
      }
    } else if (moment.pig_name_snapshot) {
      // Fallback to snapshot if pig_id not available
      pigName = moment.pig_name_snapshot;
    }

    // Return only shareable data (no user ID, session tokens, etc.)
    const shareableData = {
      text: moment.normalized_text || moment.raw_text || moment.text,
      invoked: moment.final?.invoked || '',
      expressed: moment.final?.expressed || '',
      poems: moment.post_enrichment?.poems || moment.final?.poems || [],
      timestamp: moment.timestamp || moment.created_at,
      image_base64: moment.image_base64 || moment.caption?.image_base64,
      pig_name: pigName, // Use fetched pig name from storage
      primaryEmotion: moment.final?.wheel?.primary || 'peaceful',
      songs: moment.songs,
      // Include Hindi translations if available
      text_hi: moment.translation_hi?.text,
      invoked_hi: moment.translation_hi?.invoked,
      expressed_hi: moment.translation_hi?.expressed,
      poems_hi: moment.translation_hi?.poems,
    };

    return NextResponse.json(shareableData);
  } catch (error) {
    console.error('[Share API] Error fetching moment:', error);
    return NextResponse.json(
      { error: 'Failed to load moment' },
      { status: 500 }
    );
  }
}
