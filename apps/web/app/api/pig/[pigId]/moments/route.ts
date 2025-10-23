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
    const reflectionKeys = await kv.keys(`reflection:${pigId}:*`);
    
    const moments = [];
    
    for (const key of reflectionKeys) {
      const reflection = await kv.get(key);
      
      if (reflection && typeof reflection === 'object') {
        const data = reflection as any;
        
        // Extract moment data
        const moment = {
          id: key.split(':')[2] || key, // Extract reflection ID
          text: data.original || data.normalized || '',
          zone: data.final?.wheel?.primary || 'joy',
          timestamp: data.timestamp || new Date().toISOString(),
          excerpt: (data.original || data.normalized || '').slice(0, 100) + '...',
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
