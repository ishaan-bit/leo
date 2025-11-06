/**
 * Enrichment Callback API
 * Receives enrichment results from HuggingFace Spaces and updates reflection
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

const REFLECTION_TTL = 2592000; // 30 days

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract enrichment data
    const {
      rid,
      primary,
      secondary,
      tertiary,
      valence,
      arousal,
      event_valence,
      domain,
      control,
      polarity,
      confidence,
      poems,
      tips,
      _dialogue_meta,
      ...rest
    } = body;
    
    if (!rid) {
      return NextResponse.json({
        error: 'Missing reflection ID (rid)',
        code: 'MISSING_RID',
      }, { status: 400 });
    }
    
    console.log(`[Enrichment Callback] Received enrichment for ${rid}`);
    console.log(`[Enrichment Callback] Primary: ${primary}, Valence: ${valence}, Arousal: ${arousal}`);
    
    // Get existing reflection
    const reflectionKey = `reflection:${rid}`;
    const existingData = await kv.get(reflectionKey);
    
    if (!existingData) {
      console.error(`[Enrichment Callback] Reflection ${rid} not found in Upstash`);
      return NextResponse.json({
        error: 'Reflection not found',
        code: 'REFLECTION_NOT_FOUND',
        rid,
      }, { status: 404 });
    }
    
    // Parse existing reflection
    const reflection = typeof existingData === 'string'
      ? JSON.parse(existingData)
      : existingData;
    
    // Add 'final' field with enrichment data
    reflection.final = {
      wheel: {
        primary,
        secondary,
        tertiary,
      },
      valence,
      arousal,
      event_valence,
      domain,
      control,
      polarity,
      confidence,
      // Store poems/tips in post_enrichment subfield for BreathingSequence
      post_enrichment: {
        poems: poems || [],
        tips: tips || [],
        closing_line: '', // Optional closing cue
        tip_moods: [], // Optional mood tags for tips
      },
    };
    
    // Add dialogue metadata if present
    if (_dialogue_meta) {
      reflection.final._dialogue_meta = _dialogue_meta;
    }
    
    // Add any other enrichment fields
    Object.keys(rest).forEach(key => {
      if (!reflection.final[key]) {
        reflection.final[key] = rest[key];
      }
    });
    
    // Update reflection in Upstash
    try {
      await kv.set(reflectionKey, JSON.stringify(reflection), { ex: REFLECTION_TTL });
      
      console.log(`[Enrichment Callback] ✅ Updated ${reflectionKey} with final data`);
      console.log(`[Enrichment Callback]    Primary: ${primary}`);
      console.log(`[Enrichment Callback]    Valence: ${valence}`);
      console.log(`[Enrichment Callback]    Poems: ${poems?.length || 0} lines`);
      console.log(`[Enrichment Callback]    Tips: ${tips?.length || 0} windows`);
      
      return NextResponse.json({
        success: true,
        rid,
        message: 'Enrichment saved',
        primary,
      });
      
    } catch (updateError) {
      console.error(`[Enrichment Callback] Failed to update ${reflectionKey}:`, updateError);
      return NextResponse.json({
        error: 'Failed to update reflection',
        code: 'UPDATE_FAILED',
        details: updateError instanceof Error ? updateError.message : 'Unknown error',
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('[Enrichment Callback] Error:', error);
    return NextResponse.json({
      error: 'Callback processing failed',
      code: 'CALLBACK_ERROR',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
