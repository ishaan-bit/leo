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
    
    // Extract poems from Excel data (Poem En 1 / Poem En 2)
    // The HuggingFace API should return these in _dialogue_meta
    // Poems are stored as COMPLETE STRINGS (not split into lines)
    const poemsFromExcel: string[] = [];
    
    // Check if _dialogue_meta contains poem data (try multiple possible key formats)
    // Keys could be: poem_en_1, Poem En 1, poem_1, etc.
    const poem1 = _dialogue_meta?.poem_en_1 
      || _dialogue_meta?.['Poem En 1'] 
      || _dialogue_meta?.poem_1 
      || _dialogue_meta?.poem1;
      
    const poem2 = _dialogue_meta?.poem_en_2 
      || _dialogue_meta?.['Poem En 2'] 
      || _dialogue_meta?.poem_2 
      || _dialogue_meta?.poem2;
    
    if (poem1) {
      poemsFromExcel.push(poem1); // Store complete poem string as-is
    }
    if (poem2) {
      poemsFromExcel.push(poem2); // Store complete poem string as-is
    }
    
    // Fallback: If Excel poems not available, extract from first dialogue tuple (legacy)
    if (poemsFromExcel.length === 0 && _dialogue_meta?.dialogue_tuples?.length > 0) {
      const firstTuple = _dialogue_meta.dialogue_tuples[0];
      if (Array.isArray(firstTuple) && firstTuple.length >= 3) {
        // Use first 2 lines from first tuple as fallback poems
        poemsFromExcel.push(firstTuple[0], firstTuple[1]);
      }
    }
    
    console.log(`[Enrichment Callback] Extracted ${poemsFromExcel.length} poems from Excel data`);
    if (poemsFromExcel.length > 0) {
      console.log(`[Enrichment Callback] Poem 1: ${poemsFromExcel[0]?.substring(0, 80)}...`);
      if (poemsFromExcel[1]) {
        console.log(`[Enrichment Callback] Poem 2: ${poemsFromExcel[1]?.substring(0, 80)}...`);
      }
    }

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
      // NEW: Store dialogue_tuples AND poems from Excel
      post_enrichment: {
        dialogue_tuples: _dialogue_meta?.dialogue_tuples || [],
        poems: poemsFromExcel, // Use actual poems from Excel (Poem En 1 / Poem En 2)
        meta: _dialogue_meta || {},
      },
    };
    
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
      console.log(`[Enrichment Callback]    Dialogue Tuples: ${_dialogue_meta?.dialogue_tuples?.length || 0} tuples`);
      console.log(`[Enrichment Callback]    Poems: ${poemsFromExcel.length} poems from Excel`);
      
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
