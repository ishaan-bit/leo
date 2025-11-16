import { NextRequest, NextResponse } from 'next/server';

// This API serves publicly shareable moments
// It only returns non-sensitive data suitable for sharing
export async function GET(
  request: NextRequest,
  { params }: { params: { momentId: string } }
) {
  const { momentId } = params;

  try {
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!upstashUrl || !upstashToken) {
      return NextResponse.json(
        { error: 'Redis configuration missing' },
        { status: 500 }
      );
    }

    // Fetch moment from Redis - use reflection: prefix
    const response = await fetch(`${upstashUrl}/get/reflection:${momentId}`, {
      headers: {
        Authorization: `Bearer ${upstashToken}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Moment not found' },
        { status: 404 }
      );
    }

    const data = await response.json();
    
    // Handle both string and object responses from Upstash
    let moment = data.result;
    if (typeof moment === 'string') {
      moment = JSON.parse(moment);
    }

    if (!moment) {
      return NextResponse.json(
        { error: 'Moment not found' },
        { status: 404 }
      );
    }

    // Return only shareable data (no user ID, session tokens, etc.)
    // Works even if moment.final doesn't exist yet (not fully enriched)
    const shareableData = {
      text: moment.normalized_text || moment.raw_text || moment.text || '',
      invoked: moment.final?.invoked || '',
      expressed: moment.final?.expressed || '',
      poems: moment.post_enrichment?.poems || moment.final?.poems || [],
      poem: moment.final?.poem || moment.post_enrichment?.poem || (moment.final?.poems?.[0]) || null,
      timestamp: moment.timestamp || moment.created_at || new Date().toISOString(),
      image_base64: moment.image_base64 || moment.caption?.image_base64,
      pig_name: moment.pig_name || 'Noen',
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
