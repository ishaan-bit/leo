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

    // Fetch moment from Redis
    const response = await fetch(`${upstashUrl}/get/moment:${momentId}`, {
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
    const moment = data.result ? JSON.parse(data.result) : null;

    if (!moment || !moment.final) {
      return NextResponse.json(
        { error: 'Moment not found' },
        { status: 404 }
      );
    }

    // Return only shareable data (no user ID, session tokens, etc.)
    const shareableData = {
      text: moment.normalized_text || moment.text,
      invoked: moment.final.invoked,
      expressed: moment.final.expressed,
      poems: moment.final.poems || [],
      timestamp: moment.created_at,
      image_base64: moment.final.image_base64,
      pig_name: moment.pig_name,
      primaryEmotion: moment.final.wheel?.primary || 'Happy',
      songs: moment.final.songs,
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
