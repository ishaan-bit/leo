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

    // Fetch all reflections for this pig
    // Pattern: reflection:pig_id:reflection_id or reflections:enriched:reflection_id
    const reflectionKeys = await kv.keys(`reflection:${pigId}:*`);
    const enrichedKeys = await kv.keys(`reflections:enriched:refl_*`);
    
    const allKeys = [...new Set([...reflectionKeys, ...enrichedKeys])];
    
    const moments = [];
    
    for (const key of allKeys) {
      const reflection = await kv.get(key);
      
      if (reflection && typeof reflection === 'object') {
        const data = reflection as any;
        
        // Skip if not for this pig
        if (data.pig_id && data.pig_id !== pigId) {
          continue;
        }
        
        // Extract primary zone from final.wheel.primary (e.g., "Scared" → map to fear)
        const primaryEmotion = data.final?.wheel?.primary || 'Peaceful';
        
        // Map Gloria Willcox emotion to zone
        const zoneMapping: Record<string, string> = {
          'Joyful': 'joy',
          'Playful': 'joy',
          'Content': 'joy',
          'Peaceful': 'trust',
          'Trusting': 'trust',
          'Powerful': 'trust',
          'Scared': 'fear',
          'Anxious': 'fear',
          'Rejected': 'fear',
          'Sad': 'sadness',
          'Lonely': 'sadness',
          'Depressed': 'sadness',
          'Mad': 'anger',
          'Angry': 'anger',
          'Hurt': 'anger',
          'Disgusted': 'disgust',
          'Disapproving': 'disgust',
          'Awful': 'disgust',
          'Surprised': 'surprise',
          'Startled': 'surprise',
          'Confused': 'surprise',
        };
        
        const zone = zoneMapping[primaryEmotion] || 'trust';
        
        // Extract moment data
        const moment = {
          id: data.rid || key.split(':').pop() || key,
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
      }
    }
    
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
    console.error('[API /pig/moments] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
