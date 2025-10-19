/**
 * Reflection Draft Autosave Endpoint
 * Saves in-progress reflection for recovery
 * 
 * POST /api/reflection/draft
 * Writes: reflection:draft:{sid} with TTL 3 hours
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv, logKvOperation } from '@/lib/kv';
import type { ReflectionDraft, TypingMetrics, VoiceMetrics } from '@/types/reflection.types';

const DRAFT_TTL = 10800; // 3 hours in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sid,
      pigId,
      pigName,
      rawText,
      inputMode,
      typingMetrics,
      voiceMetrics,
      valenceEstimate,
      arousalEstimate,
    } = body;

    // Validation
    if (!sid) {
      return NextResponse.json({
        error: 'Missing required field: sid',
        code: 'VALIDATION_FAILED',
        details: [{ field: 'sid', message: 'Session ID is required' }],
      }, { status: 400 });
    }

    if (!pigId) {
      return NextResponse.json({
        error: 'Missing required field: pigId',
        code: 'VALIDATION_FAILED',
        details: [{ field: 'pigId', message: 'Pig ID is required' }],
      }, { status: 400 });
    }

    if (!rawText && !voiceMetrics) {
      return NextResponse.json({
        error: 'Missing content: need rawText or voiceMetrics',
        code: 'VALIDATION_FAILED',
        details: [{ field: 'rawText|voiceMetrics', message: 'Draft needs content' }],
      }, { status: 400 });
    }

    // Build draft object
    const draft: ReflectionDraft = {
      sid,
      pig_id: pigId,
      pig_name_snapshot: pigName || null,
      raw_text: rawText || '',
      input_mode: inputMode === 'voice' ? 'voice' : 'typing',
      typing_summary: typingMetrics || null,
      voice_summary: voiceMetrics || null,
      valence_estimate: valenceEstimate ?? null,
      arousal_estimate: arousalEstimate ?? null,
      last_updated: new Date().toISOString(),
    };

    const key = `reflection:draft:${sid}`;
    logKvOperation({ op: 'SETEX', key, phase: 'start', sid });

    try {
      await kv.set(key, JSON.stringify(draft), { ex: DRAFT_TTL });
      logKvOperation({ op: 'SETEX', key, phase: 'ok', sid });

      return NextResponse.json({
        ok: true,
        message: 'Draft saved',
        key,
        ttl_seconds: DRAFT_TTL,
      });
    } catch (error) {
      logKvOperation({ op: 'SETEX', key, phase: 'error', sid, error });
      
      return NextResponse.json({
        error: 'Failed to save draft',
        code: 'KV_WRITE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown',
      }, { status: 503 });
    }

  } catch (error) {
    console.error('❌ Draft autosave error:', error);
    
    return NextResponse.json({
      error: 'Draft autosave failed',
      details: error instanceof Error ? error.message : 'Unknown',
      stack_top: error instanceof Error ? error.stack?.split('\n')[0] : undefined,
    }, { status: 500 });
  }
}

// GET: Retrieve draft
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sid = searchParams.get('sid');

    if (!sid) {
      return NextResponse.json({
        error: 'Missing sid parameter',
        code: 'VALIDATION_FAILED',
      }, { status: 400 });
    }

    const key = `reflection:draft:${sid}`;
    logKvOperation({ op: 'GET', key, phase: 'start', sid });

    try {
      const data = await kv.get(key);
      
      if (!data) {
        return NextResponse.json({
          ok: true,
          draft: null,
          message: 'No draft found',
        });
      }

      const draft: ReflectionDraft = JSON.parse(data as string);
      logKvOperation({ op: 'GET', key, phase: 'ok', sid });

      return NextResponse.json({
        ok: true,
        draft,
      });
    } catch (error) {
      logKvOperation({ op: 'GET', key, phase: 'error', sid, error });
      
      return NextResponse.json({
        error: 'Failed to retrieve draft',
        code: 'KV_READ_FAILED',
        details: error instanceof Error ? error.message : 'Unknown',
      }, { status: 503 });
    }

  } catch (error) {
    console.error('❌ Draft retrieval error:', error);
    
    return NextResponse.json({
      error: 'Draft retrieval failed',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
