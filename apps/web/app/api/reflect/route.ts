import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getOrCreateGuestSession } from '@/lib/guest-session';
import { saveReflection, savePigInfo } from '@/lib/reflection-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await request.json();
    
    const {
      pigId,
      pigName,
      inputType,
      originalText,
      normalizedText,
      detectedLanguage,
      affect,
      metrics,
      deviceInfo,
      timestamp,
    } = body;
    
    // Validate required fields
    if (!pigId || !originalText) {
      return NextResponse.json(
        { error: 'Missing required fields: pigId, originalText' },
        { status: 400 }
      );
    }
    
    // Get guest session ID
    const sessionId = await getOrCreateGuestSession();
    const userId = (session?.user as any)?.id || null;
    const signedIn = !!session;
    
    // Determine owner_id
    const ownerId = signedIn && userId ? `user:${userId}` : `guest:${sessionId}`;
    
    console.log('💭 Saving reflection:', {
      ownerId,
      pigId,
      signedIn,
      textLength: originalText.length,
      inputType,
    });
    
    // Save pig info (name if provided)
    if (pigName) {
      await savePigInfo(pigId, ownerId, pigName);
    }
    
    // Save reflection to Supabase
    const reflection = await saveReflection({
      sessionId,
      userId,
      signedIn,
      pigId,
      pigName,
      text: originalText,
      valence: affect?.valence,
      arousal: affect?.arousal,
      cognitiveEffort: affect?.cognitiveEffort,
      language: detectedLanguage,
      inputMode: inputType === 'notebook' ? 'typing' : 'voice',
      metrics,
      deviceInfo,
      consentResearch: true, // Default to true; can add UI toggle later
    });
    
    return NextResponse.json({
      success: true,
      message: 'Reflection saved to database',
      data: {
        reflectionId: reflection.id,
        ownerId: reflection.owner_id,
        pigId: reflection.pig_id,
        timestamp: reflection.created_at,
      },
    });
  } catch (error) {
    console.error('❌ Error saving reflection:', error);
    return NextResponse.json(
      { error: 'Failed to save reflection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Get reflections for a pig or user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    const { searchParams } = new URL(request.url);
    const pigId = searchParams.get('pigId');
    const ownerId = searchParams.get('ownerId');
    
    if (!pigId && !ownerId) {
      return NextResponse.json(
        { error: 'Missing pigId or ownerId parameter' },
        { status: 400 }
      );
    }
    
    // Import reflection service functions
    const { getReflectionsByPig, getReflectionsByOwner } = await import('@/lib/reflection-service');
    
    let reflections: any[] = [];
    if (pigId) {
      reflections = await getReflectionsByPig(pigId, 50);
    } else if (ownerId) {
      reflections = await getReflectionsByOwner(ownerId, 50);
    }
    
    return NextResponse.json({
      success: true,
      reflections,
      count: reflections.length,
    });
  } catch (error) {
    console.error('❌ Error fetching reflections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
