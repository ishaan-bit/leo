import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

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

    // Return only shareable data (no user ID, session tokens, etc.)
    const shareableData = {
      text: moment.normalized_text || moment.raw_text || moment.text,
      invoked: moment.final?.invoked || '',
      expressed: moment.final?.expressed || '',
      poems: moment.post_enrichment?.poems || moment.final?.poems || [],
      timestamp: moment.timestamp || moment.created_at,
      image_base64: moment.image_base64 || moment.caption?.image_base64,
      pig_name: moment.pig_name,
      primaryEmotion: moment.final?.wheel?.primary || 'peaceful',
      songs: moment.songs,
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
