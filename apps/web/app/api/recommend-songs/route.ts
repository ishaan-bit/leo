import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Song Recommendation Worker (1960-1975 Era) - LLM-Powered
 * 
 * Uses Ollama phi3 with GPU acceleration to generate fresh song suggestions
 * based on emotional context (valence, arousal, invoked, expressed).
 * 
 * Runs in parallel with Stage-2 enrichment.
 * 
 * POST /api/recommend-songs
 * Body: { rid: string, refresh?: boolean }
 */

interface SongPick {
  title: string;
  artist: string;
  year: number;
  youtube_search: string; // Search query for YouTube
  youtube_url?: string; // Generated YouTube URL
  source_confidence: 'high' | 'medium' | 'low';
  why: string;
}

interface SongRecommendation {
  rid: string;
  moment_id: string;
  lang_default: 'en' | 'hi';
  tracks: {
    en: SongPick;
    hi: SongPick;
  };
  embed: {
    mode: 'youtube_iframe';
    embed_when_lang_is: {
      en: string;
      hi: string;
    };
  };
  meta: {
    valence_bucket: 'negative' | 'neutral' | 'positive';
    arousal_bucket: 'low' | 'medium' | 'high';
    mood_cell: string;
    picked_at: string;
    version: string;
  };
}

/**
 * Generate song recommendations using Ollama phi3
 */
async function generateSongsWithLLM(
  valence: number,
  arousal: number,
  invoked: string,
  expressed: string
): Promise<{ en: SongPick; hi: SongPick }> {
  
  const prompt = `You are a music curator with encyclopedic knowledge of 1960-1975 songs. Suggest TWO real, verifiable songs that match this emotion:

EMOTION DATA:
- Valence: ${valence.toFixed(2)} (-1=very negative, 0=neutral, +1=very positive)
- Arousal: ${arousal.toFixed(2)} (0=calm/low-energy, 1=excited/high-energy)
- What they felt: "${invoked}"
- How they described it: "${expressed}"

STRICT REQUIREMENTS:
1. ONE English song - must be a REAL song from 1960-1975 (The Beatles, Rolling Stones, Dylan, Simon & Garfunkel, etc.)
2. ONE Hindi song - must be a REAL Bollywood/ghazal from 1960-1975 (Lata, Kishore, Rafi, Asha, etc.)
3. Songs must match the valence (emotion positivity/negativity) and arousal (energy level)
4. Only suggest songs you are CERTAIN exist - no invented titles
5. If you don't know the exact YouTube ID, you MUST omit the "youtube_id" field entirely

OUTPUT (JSON only):
{
  "en": {
    "title": "Exact Song Title",
    "artist": "Exact Artist Name",
    "year": 1970,
    "why": "How this matches the emotion (2 sentences max)"
  },
  "hi": {
    "title": "Song Title in English script (e.g., 'Lag Jaa Gale')",
    "artist": "Artist Name",
    "year": 1970,
    "why": "How this matches the emotion (2 sentences max)"
  }
}`;

  try {
    // Call Ollama API (local GPU-accelerated)
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3:latest',
        prompt,
        stream: false,
        options: {
          temperature: 0.8, // Some creativity, not too random
          top_p: 0.9,
          num_predict: 500, // Limit response length
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const rawResponse = data.response;

    // Parse JSON from LLM response (extract from code blocks if needed)
    let jsonText = rawResponse.trim();
    const jsonMatch = rawResponse.match(/```json\s*(\{[\s\S]*?\})\s*```/) || 
                     rawResponse.match(/(\{[\s\S]*\})/);
    
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonText);

    // Generate YouTube search URLs (LLM rarely knows exact video IDs)
    const enSearch = `${parsed.en.title} ${parsed.en.artist} official`;
    const hiSearch = `${parsed.hi.title} ${parsed.hi.artist} original`;

    return {
      en: {
        title: parsed.en.title,
        artist: parsed.en.artist,
        year: parseInt(parsed.en.year),
        youtube_search: enSearch,
        youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(enSearch)}`,
        source_confidence: 'high',
        why: parsed.en.why,
      },
      hi: {
        title: parsed.hi.title,
        artist: parsed.hi.artist,
        year: parseInt(parsed.hi.year),
        youtube_search: hiSearch,
        youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(hiSearch)}`,
        source_confidence: 'high',
        why: parsed.hi.why,
      },
    };

  } catch (error) {
    console.error('[LLM Song Generation Error]', error);
    
    // Fallback to a neutral song if LLM fails
    return {
      en: {
        title: 'Here Comes the Sun',
        artist: 'The Beatles',
        year: 1969,
        youtube_search: 'Here Comes the Sun The Beatles 1969',
        youtube_url: 'https://www.youtube.com/watch?v=KQetemT1sWc',
        source_confidence: 'medium',
        why: 'Fallback: Gentle, hopeful melody (LLM unavailable)',
      },
      hi: {
        title: 'Lag Jaa Gale',
        artist: 'Lata Mangeshkar',
        year: 1964,
        youtube_search: 'Lag Jaa Gale Lata Mangeshkar 1964',
        youtube_url: 'https://www.youtube.com/watch?v=Q8Pk5Bq1IVo',
        source_confidence: 'medium',
        why: 'Fallback: Tender ghazal (LLM unavailable)',
      },
    };
  }
}

function getBuckets(valence: number, arousal: number) {
  const valenceBucket: 'negative' | 'neutral' | 'positive' = 
    valence <= -0.15 ? 'negative' : 
    valence >= 0.15 ? 'positive' : 
    'neutral';
  
  const arousalBucket: 'low' | 'medium' | 'high' = 
    arousal <= 0.33 ? 'low' : 
    arousal >= 0.67 ? 'high' : 
    'medium';
  
  return { valenceBucket, arousalBucket };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rid, refresh = false } = body;

    if (!rid) {
      return NextResponse.json(
        { error: 'rid is required' },
        { status: 400 }
      );
    }

    // Check cache first (unless refresh requested)
    const cacheKey = `songs:${rid}`;
    if (!refresh) {
      const cached = await kv.get<SongRecommendation>(cacheKey);
      if (cached) {
        return NextResponse.json(cached);
      }
    }

    // Fetch reflection data from Upstash
    const reflection = await kv.get<any>(`reflection:${rid}`);
    
    if (!reflection) {
      return NextResponse.json(
        { error: 'Reflection not found' },
        { status: 404 }
      );
    }

    // Extract Stage-1 emotion data
    const valence = reflection.valence ?? 0;
    const arousal = reflection.arousal ?? 0.5;
    const invoked = reflection.invoked_emotion || '';
    const expressed = reflection.expressed_emotion || '';
    
    // Calculate mood buckets for metadata
    const { valenceBucket, arousalBucket } = getBuckets(valence, arousal);
    const moodCell = `${valenceBucket}-${arousalBucket}`;
    
    // Generate songs using LLM
    const songs = await generateSongsWithLLM(valence, arousal, invoked, expressed);
    
    // Determine default language from locale (if available)
    const locale = reflection.client_context?.locale || 'en-US';
    const langDefault: 'en' | 'hi' = locale.startsWith('hi') ? 'hi' : 'en';
    
    // Build response
    const recommendation: SongRecommendation = {
      rid,
      moment_id: rid,
      lang_default: langDefault,
      tracks: {
        en: songs.en,
        hi: songs.hi,
      },
      embed: {
        mode: 'youtube_iframe',
        embed_when_lang_is: {
          en: songs.en.youtube_url || '',
          hi: songs.hi.youtube_url || '',
        },
      },
      meta: {
        valence_bucket: valenceBucket,
        arousal_bucket: arousalBucket,
        mood_cell: moodCell,
        picked_at: new Date().toISOString(),
        version: 'song-worker-v2-llm',
      },
    };
    
    // Cache for 24 hours
    await kv.set(cacheKey, recommendation, { ex: 24 * 60 * 60 });
    
    return NextResponse.json(recommendation);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[RECOMMEND-SONGS]', errorMessage);
    
    return NextResponse.json(
      { error: 'Failed to generate song recommendations', details: errorMessage },
      { status: 500 }
    );
  }
}
