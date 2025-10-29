import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * GET /api/pig/[pigId]/moments
 * Fetch all reflection moments for a given pig/user
 * 
 * Cache-Control: no-store to prevent stale data after deletions
 */

// Force dynamic to ensure fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    const staleRids: string[] = []; // Track deleted reflections
    
    // Fetch each reflection
    for (const rid of reflectionIds) {
      try {
        const reflectionKey = `reflection:${rid}`;
        console.log('[API /pig/moments] 🔑 Fetching:', reflectionKey);
        
        const reflectionData = await kv.get(reflectionKey);
        
        if (!reflectionData) {
          console.warn('[API /pig/moments] ⚠️ Reflection not found (deleted):', reflectionKey);
          staleRids.push(String(rid)); // Mark for cleanup
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
          hasImage: !!(data.image_base64 || data.caption?.image_base64),
          imageSize: data.image_base64?.length || data.caption?.image_base64?.length || 0,
        });
        
        // Extract primary zone from final.wheel.primary (e.g., "scared" → scared zone)
        const primaryEmotion = data.final?.wheel?.primary || 'peaceful';
        
        // Map emotion to zone - backend sends LOWERCASE (scared, mad, joyful, powerful, peaceful, sad)
        // CRITICAL: Backend uses Willcox canonical names: happy, angry, fearful, strong, peaceful, sad
        // Frontend uses: joyful, mad, scared, powerful, peaceful, sad
        const zoneMapping: Record<string, string> = {
          // Backend canonical (lowercase) - WILLCOX WHEEL PRIMARIES
          'happy': 'joyful',      // ← CRITICAL MAPPING!
          'angry': 'mad',         // ← CRITICAL MAPPING!
          'fearful': 'scared',    // ← CRITICAL MAPPING!
          'strong': 'powerful',   // ← CRITICAL MAPPING!
          'peaceful': 'peaceful',
          'sad': 'sad',
          
          // Frontend canonical (already mapped correctly)
          'joyful': 'joyful',
          'mad': 'mad',
          'scared': 'scared',
          'powerful': 'powerful',
          
          // Capitalized variants (backwards compatibility)
          'Happy': 'joyful',
          'Angry': 'mad',
          'Fearful': 'scared',
          'Strong': 'powerful',
          'Scared': 'scared',
          'Mad': 'mad',
          'Joyful': 'joyful',
          'Powerful': 'powerful',
          'Peaceful': 'peaceful',
          'Sad': 'sad',
          
          // Secondary emotions (fallback - lowercase)
          'playful': 'joyful',
          'content': 'joyful',
          'trusting': 'peaceful',
          'anxious': 'scared',
          'rejected': 'scared',
          'lonely': 'sad',
          'depressed': 'sad',
          'hurt': 'mad',
          'disgusted': 'mad',
          'disapproving': 'mad',
          'awful': 'mad',
          'surprised': 'peaceful',
          'startled': 'peaceful',
          'confused': 'peaceful',
        };
        
        // Normalize to lowercase for case-insensitive matching
        const zone = zoneMapping[primaryEmotion.toLowerCase()] || 'peaceful';
        
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
          songs: data.songs || null, // Include songs data from enrichment worker
          image_base64: data.image_base64 || data.caption?.image_base64 || undefined, // Include image data if present
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

    // Clean up stale sorted set entries
    if (staleRids.length > 0) {
      console.log(`[API /pig/moments] 🧹 Cleaning up ${staleRids.length} stale references from sorted set`);
      await kv.zrem(pigKey, ...staleRids);
    }

    // Sort by timestamp descending (newest first)
    moments.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Return with no-store cache headers to prevent stale data
    const response = NextResponse.json({
      success: true,
      moments,
      count: moments.length,
    });
    
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
    
  } catch (error) {
    console.error('[API /pig/moments] ❌ Fatal error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch moments', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
