import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

/**
 * Song Recommendation API Route
 * 
 * Proxies requests to the song-worker service (FastAPI + Ollama phi3)
 * The worker runs locally or on Railway with GPU support.
 * 
 * POST /api/recommend-songs
 * Body: { rid: string, refresh?: boolean }
 */

const SONG_WORKER_URL = process.env.SONG_WORKER_URL || 'http://localhost:5051';

const SONG_WORKER_URL = process.env.SONG_WORKER_URL || 'http://localhost:5051';

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

    // Forward request to song worker
    const response = await fetch(`${SONG_WORKER_URL}/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rid, refresh }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Song worker error: ${response.status} - ${error}`);
    }

    const recommendation = await response.json();
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
