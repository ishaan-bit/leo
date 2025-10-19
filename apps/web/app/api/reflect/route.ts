import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getOrCreateGuestSession } from '@/lib/guest-session';
import { kv } from '@vercel/kv';

// Helper to generate reflection ID
function generateReflectionId() {
  return `refl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Save reflection to Vercel KV
async function saveReflection(data: {
  sessionId: string;
  userId: string | null;
  signedIn: boolean;
  pigId: string;
  pigName?: string;
  text: string;
  valence?: number;
  arousal?: number;
  cognitiveEffort?: number;
  language?: string;
  inputMode: string;
  metrics?: any;
  deviceInfo?: any;
  consentResearch: boolean;
}) {
  const reflectionId = generateReflectionId();
  const ownerId = data.signedIn && data.userId ? `user:${data.userId}` : `guest:${data.sessionId}`;
  
  const reflection = {
    id: reflectionId,
    owner_id: ownerId,
    user_id: data.userId,
    session_id: data.sessionId,
    signed_in: data.signedIn,
    pig_id: data.pigId,
    pig_name: data.pigName || null,
    text: data.text,
    valence: data.valence ?? null,
    arousal: data.arousal ?? null,
    cognitive_effort: data.cognitiveEffort ?? null,
    language: data.language || null,
    input_mode: data.inputMode,
    metrics: data.metrics || {},
    device_info: data.deviceInfo || {},
    consent_research: data.consentResearch,
    created_at: new Date().toISOString(),
  };
  
  // Save reflection
  await kv.hset(`reflection:${reflectionId}`, reflection);
  
  // Add to owner's reflection list
  await kv.zadd(`reflections:${ownerId}`, { score: Date.now(), member: reflectionId });
  
  // Add to pig's reflection list
  await kv.zadd(`pig_reflections:${data.pigId}`, { score: Date.now(), member: reflectionId });
  
  console.log('✅ Reflection saved to KV:', reflectionId);
  return reflection;
}

// Save pig info
async function savePigInfo(data: {
  pigId: string;
  userId: string | null;
  sessionId: string;
  name: string;
}) {
  const pigKey = `pig:${data.pigId}`;
  const existing = await kv.hgetall(pigKey);
  
  const pigInfo = {
    pig_id: data.pigId,
    name: data.name,
    owner_id: data.userId ? `user:${data.userId}` : `guest:${data.sessionId}`,
    user_id: data.userId,
    session_id: data.sessionId,
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  await kv.hset(pigKey, pigInfo);
  console.log('✅ Pig info saved:', data.pigId, data.name);
  return pigInfo;
}

// Get reflections by pig
async function getReflectionsByPig(pigId: string, limit: number = 50) {
  const reflectionIds = await kv.zrange(`pig_reflections:${pigId}`, 0, limit - 1, { rev: true }) as string[];
  const reflections = await Promise.all(
    reflectionIds.map((id: string) => kv.hgetall(`reflection:${id}`))
  );
  return reflections.filter(Boolean);
}

// Get reflections by owner
async function getReflectionsByOwner(ownerId: string, limit: number = 50) {
  const reflectionIds = await kv.zrange(`reflections:${ownerId}`, 0, limit - 1, { rev: true }) as string[];
  const reflections = await Promise.all(
    reflectionIds.map((id: string) => kv.hgetall(`reflection:${id}`))
  );
  return reflections.filter(Boolean);
}

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
      await savePigInfo({
        pigId,
        userId,
        sessionId,
        name: pigName,
      });
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
