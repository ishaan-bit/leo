import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * GET /api/pig/[pigId]/moments
 * Fetch all reflection moments for a given pig/user
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { pigId: string } }
) {
  try {
    const { pigId } = params;
    
    if (!pigId) {
      return NextResponse.json(
        { error: 'Missing pigId' },
        { status: 400 }
      );
    }

    console.log('[API /pig/moments] 📡 Fetching moments for pigId:', pigId);

    // Fetch reflection IDs from sorted set (newest first)
    const pigKey = `pig_reflections:${pigId}`;
    console.log('[API /pig/moments] 🔍 Querying key:', pigKey);
    
    const reflectionIds = await kv.zrange(pigKey, 0, -1, { rev: true });
    console.log('[API /pig/moments] 📋 Found reflection IDs:', reflectionIds);
    
    if (!reflectionIds || reflectionIds.length === 0) {
      console.log('[API /pig/moments] 🏜️ No reflections found for this pig');
      return NextResponse.json({
        success: true,
        moments: [],
        count: 0,
      });
    }

    const moments = [];
    
    // Fetch each reflection
    for (const rid of reflectionIds) {
      try {
        const reflectionKey = `reflection:${rid}`;
        console.log('[API /pig/moments] 🔑 Fetching:', reflectionKey);
        
        const reflectionData = await kv.get(reflectionKey);
        
        if (!reflectionData) {
          console.warn('[API /pig/moments] ⚠️ Reflection not found:', reflectionKey);
          continue;
        }
        
        // Parse if it's a string
        const data = typeof reflectionData === 'string' 
          ? JSON.parse(reflectionData) 
          : reflectionData;
        
        console.log('[API /pig/moments] ✅ Loaded reflection:', {
          rid: data.rid,
          hasPost: !!data.post_enrichment,
          hasFinal: !!data.final,
          primaryEmotion: data.final?.wheel?.primary,
          text: data.normalized_text?.slice(0, 50),
        });
        
        // Extract primary zone from final.wheel.primary (e.g., "Scared" → map to fear)
        const primaryEmotion = data.final?.wheel?.primary || 'Peaceful';
        
        // Map Gloria Willcox emotion to PrimaryEmotion type
        // MAPPING: Joyful→joyful, Powerful→powerful, Peaceful→peaceful, Sad→sad, Scared→scared, Mad→mad
        const zoneMapping: Record<string, string> = {
          'Joyful': 'joyful',
          'Playful': 'joyful',
          'Content': 'joyful',
          'Peaceful': 'peaceful',
          'Trusting': 'peaceful',
          'Powerful': 'powerful',
          'Scared': 'scared',
          'Anxious': 'scared',
          'Rejected': 'scared',
          'Sad': 'sad',
          'Lonely': 'sad',
          'Depressed': 'sad',
          'Mad': 'mad',
          'Angry': 'mad',
          'Hurt': 'mad',
          'Disgusted': 'mad',
          'Disapproving': 'mad',
          'Awful': 'mad',
          'Surprised': 'peaceful',
          'Startled': 'peaceful',
          'Confused': 'peaceful',
        };
        
        const zone = zoneMapping[primaryEmotion] || 'peaceful';
        
        // Extract moment data
        const moment = {
          id: data.rid || String(rid),
          text: data.normalized_text || data.raw_text || '',
          zone,
          primaryEmotion,
          secondary: data.final?.wheel?.secondary || '',
          tertiary: data.final?.wheel?.tertiary || '',
          timestamp: data.timestamp || new Date().toISOString(),
          invoked: data.final?.invoked || '',
          expressed: data.final?.expressed || '',
          poems: data.post_enrichment?.poems || [],
          tips: data.post_enrichment?.tips || [],
          closingLine: data.post_enrichment?.closing_line || '',
          valence: data.final?.valence || data.valence || 0.5,
          arousal: data.final?.arousal || data.arousal || 0.5,
        };
        
        moments.push(moment);
        
      } catch (error) {
        console.error('[API /pig/moments] ❌ Error processing reflection:', rid, error);
        continue;
      }
    }
    
    console.log('[API /pig/moments] 📊 Processed moments:', {
      total: moments.length,
      byZone: moments.reduce((acc: Record<string, number>, m: any) => {
        acc[m.zone] = (acc[m.zone] || 0) + 1;
        return acc;
      }, {}),
    });

    // Sort by timestamp descending (newest first)
    moments.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({
      success: true,
      moments,
      count: moments.length,
    });
    
  } catch (error) {
    console.error('[API /pig/moments] ❌ Fatal error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
