import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await request.json();
    
    const {
      pigId,
      inputType,
      originalText,
      normalizedText,
      detectedLanguage,
      affect,
      metrics,
      userId,
      timestamp,
    } = body;
    
    // Validate required fields
    if (!pigId || !originalText || !normalizedText) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Log reflection data (TODO: integrate database)
    console.log('💭 Reflection received:', {
      pigId,
      userId: userId || 'guest',
      inputType,
      textLength: originalText.length,
      language: detectedLanguage,
      affect: {
        arousal: affect.arousal.toFixed(2),
        valence: affect.valence.toFixed(2),
        effort: affect.cognitiveEffort.toFixed(2),
      },
      timestamp,
    });
    
    // TODO: Store in database
    // const reflection = await db.reflections.create({
    //   data: {
    //     userId: session?.user?.id || null,
    //     pigId,
    //     inputType,
    //     originalText,
    //     normalizedText,
    //     detectedLanguage,
    //     arousal: affect.arousal,
    //     valence: affect.valence,
    //     cognitiveEffort: affect.cognitiveEffort,
    //     metrics: JSON.stringify(metrics),
    //     createdAt: new Date(timestamp),
    //   },
    // });
    
    // For now, store in localStorage on client side for guests
    // and return success
    
    return NextResponse.json({
      success: true,
      message: 'Reflection saved',
      data: {
        reflectionId: `temp_${Date.now()}`, // Temporary ID until DB integrated
        pigId,
        timestamp,
      },
    });
  } catch (error) {
    console.error('Error saving reflection:', error);
    return NextResponse.json(
      { error: 'Failed to save reflection' },
      { status: 500 }
    );
  }
}

// Get reflections for a pig
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const { searchParams } = new URL(request.url);
    const pigId = searchParams.get('pigId');
    
    if (!pigId) {
      return NextResponse.json(
        { error: 'Missing pigId parameter' },
        { status: 400 }
      );
    }
    
    // TODO: Fetch from database
    // const reflections = await db.reflections.findMany({
    //   where: {
    //     pigId,
    //     userId: session?.user?.id,
    //   },
    //   orderBy: { createdAt: 'desc' },
    //   take: 10,
    // });
    
    // For now, return empty array
    return NextResponse.json({
      success: true,
      reflections: [],
      message: 'Database integration pending',
    });
  } catch (error) {
    console.error('Error fetching reflections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    );
  }
}
