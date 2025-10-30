import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Save Hindi translation to Redis for sharing
export async function POST(
  request: NextRequest,
  { params }: { params: { momentId: string } }
) {
  const { momentId } = params;

  try {
    const body = await request.json();
    const { text, invoked, expressed, poems } = body;

    console.log('[Translation API] Saving translation for:', momentId);

    // Fetch existing moment
    const reflectionKey = `reflection:${momentId}`;
    const reflectionData = await kv.get(reflectionKey);
    
    if (!reflectionData) {
      return NextResponse.json(
        { error: 'Moment not found' },
        { status: 404 }
      );
    }

    const moment = typeof reflectionData === 'string' 
      ? JSON.parse(reflectionData) 
      : reflectionData;

    // Add translation data
    moment.translation_hi = {
      text,
      invoked,
      expressed,
      poems,
    };

    // Save back to Redis
    await kv.set(reflectionKey, JSON.stringify(moment));

    console.log('[Translation API] Translation saved successfully');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Translation API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save translation' },
      { status: 500 }
    );
  }
}
