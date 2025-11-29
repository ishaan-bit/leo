import { NextRequest, NextResponse } from 'next/server';

// This API serves publicly shareable moments
// It only returns non-sensitive data suitable for sharing
// Supports lang=en (default) or lang=hi for Hindi translations
export async function GET(
  request: NextRequest,
  { params }: { params: { momentId: string } }
) {
  const { momentId } = params;
  
  // Get language preference from query params
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') === 'hi' ? 'hi' : 'en';

  try {
    // Support both naming conventions for Upstash/Vercel KV
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

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
    // Note: poem is stored as singular string in final.post_enrichment.poem (from Excel "Poem En 1/2")
    const poemValue = moment.final?.post_enrichment?.poem || moment.post_enrichment?.poem || null;
    
    // Check for Hindi translations if lang=hi
    const hasHindiTranslation = moment.translation_hi && lang === 'hi';
    
    // Get localized content - prefer translation if Hindi requested and available
    const localizedText = hasHindiTranslation && moment.translation_hi.text
      ? moment.translation_hi.text
      : (moment.normalized_text || moment.raw_text || moment.text || '');
    
    const localizedInvoked = hasHindiTranslation && moment.translation_hi.invoked
      ? moment.translation_hi.invoked
      : (moment.final?.invoked || '');
    
    const localizedExpressed = hasHindiTranslation && moment.translation_hi.expressed
      ? moment.translation_hi.expressed
      : (moment.final?.expressed || '');
    
    // Poem: check translation_hi.poem first (from MomentsLibrary translation)
    const localizedPoem = hasHindiTranslation && moment.translation_hi.poem
      ? moment.translation_hi.poem
      : poemValue;
    
    const shareableData = {
      text: localizedText,
      invoked: localizedInvoked,
      expressed: localizedExpressed,
      poems: localizedPoem ? [localizedPoem] : [],
      poem: localizedPoem,
      timestamp: moment.timestamp || moment.created_at || new Date().toISOString(),
      image_base64: moment.image_base64 || moment.caption?.image_base64,
      pig_name: moment.pig_name || 'Noen',
      primaryEmotion: moment.final?.wheel?.primary || 'peaceful',
      songs: moment.songs,
      lang, // Echo back the language used
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
