/**
 * Enrichment Callback API
 * Receives enrichment results from HuggingFace Spaces and updates reflection
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { getGuestReflectionKey } from '@/lib/guest-session';

const REFLECTION_TTL = 2592000; // 30 days
const GUEST_TTL = 300; // 5 minutes for guest reflections

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract enrichment data
    const {
      rid,
      sid, // Session ID to determine guest vs authenticated
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
    console.log(`[Enrichment Callback] Session ID from webhook: ${sid || 'NOT PROVIDED'}`);
    
    // Determine if this is a guest reflection
    // Guest sessions have pigId format: sid_{uuid}
    // Authenticated sessions have cookie format: sess_{timestamp}_{random}
    let sessionId = sid;
    let isGuest = sessionId && sessionId.startsWith('sid_');
    let guestUid = isGuest ? sessionId.substring(4) : null;
    
    console.log(`[Enrichment Callback] Session type:`, {
      sid: sessionId,
      isGuest,
      guestUid: guestUid ? guestUid.substring(0, 8) + '...' : null,
    });
    
    // Try guest namespace first if we have a session ID
    let reflectionKey: string = `reflection:${rid}`; // Default to global namespace
    let existingData: any;
    
    if (isGuest && guestUid) {
      reflectionKey = getGuestReflectionKey(guestUid, rid);
      existingData = await kv.get(reflectionKey);
      
      console.log(`[Enrichment Callback] Guest lookup (from webhook sid):`, {
        sid: sessionId,
        guestUid,
        key: reflectionKey,
        found: !!existingData,
      });
    }
    
    if (!existingData) {
      // Fallback to global namespace
      reflectionKey = `reflection:${rid}`;
      existingData = await kv.get(reflectionKey);
      
      console.log(`[Enrichment Callback] Global lookup:`, {
        key: reflectionKey,
        found: !!existingData,
        wasGuestAttempt: isGuest,
      });
      
      // If found in global namespace, check if it's actually a guest reflection
      // (This handles case where webhook didn't provide sid)
      if (existingData) {
        const parsedForCheck = typeof existingData === 'string' 
          ? JSON.parse(existingData) 
          : existingData;
        
        const reflSessionId = parsedForCheck.sid || parsedForCheck.session_id;
        const reflUserId = parsedForCheck.user_id || parsedForCheck.userId;
        
        // If no userId but has session ID starting with sid_, it's a guest
        if (!reflUserId && reflSessionId && reflSessionId.startsWith('sid_')) {
          console.log(`[Enrichment Callback] Detected guest reflection from data:`, {
            reflSessionId,
            reflUserId,
          });
          
          // This reflection should be in guest namespace! Try to move it or update both
          const detectedGuestUid = reflSessionId.substring(4);
          const guestKey = getGuestReflectionKey(detectedGuestUid, rid);
          const guestData = await kv.get(guestKey);
          
          if (guestData) {
            // Guest namespace has the reflection - use that key instead
            reflectionKey = guestKey;
            existingData = guestData;
            isGuest = true;
            guestUid = detectedGuestUid;
            sessionId = reflSessionId;
            
            console.log(`[Enrichment Callback] Switched to guest namespace:`, {
              key: reflectionKey,
            });
          }
        }
      }
    }
    
    if (!existingData) {
      console.error(`[Enrichment Callback] Reflection ${rid} not found in any namespace`);
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
    
    // Extract poem from Excel data (single randomly selected poem from Poem En 1 or Poem En 2)
    // The HuggingFace API returns this in _dialogue_meta.poem
    // Stored as a COMPLETE STRING (multiline poem with preserved line breaks)
    let poemFromExcel: string | null = null;
    
    // Check if _dialogue_meta contains the randomly selected poem
    if (_dialogue_meta?.poem && typeof _dialogue_meta.poem === 'string') {
      poemFromExcel = _dialogue_meta.poem;
      console.log(`[Enrichment Callback] ✅ Found Excel poem (${poemFromExcel.length} chars)`);
      console.log(`[Enrichment Callback] Poem preview: ${poemFromExcel.substring(0, 100)}...`);
    } else {
      console.warn(`[Enrichment Callback] ⚠️ No Excel poem found in _dialogue_meta`);
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
      // Store dialogue_tuples and poem from Excel (no redundant nesting)
      post_enrichment: {
        // Full 3-part tuples: [[Inner Voice, Regulate, Amuse], ...]
        dialogue_tuples: _dialogue_meta?.dialogue_tuples || [],
        
        // Single randomly selected poem from Excel (Poem En 1 or Poem En 2)
        poem: poemFromExcel,
        
        // Metadata for debugging/analytics (without redundant dialogue_tuples)
        meta: {
          source: _dialogue_meta?.source || 'unknown',
          domain_primary: _dialogue_meta?.domain_primary,
          wheel_secondary: _dialogue_meta?.wheel_secondary,
          total_available: _dialogue_meta?.total_available,
          found: _dialogue_meta?.found,
        },
      },
    };
    
    // Add any other enrichment fields (excluding legacy dialogue/poem fields)
    // Legacy fields to exclude: poems, tips, poem (these are now in post_enrichment only)
    const legacyFields = ['poems', 'tips', 'poem'];
    
    Object.keys(rest).forEach(key => {
      if (!reflection.final[key] && !legacyFields.includes(key)) {
        reflection.final[key] = rest[key];
      }
    });
    
    // Update reflection in Upstash with appropriate TTL
    const ttl = isGuest ? GUEST_TTL : REFLECTION_TTL;
    
    try {
      await kv.set(reflectionKey, JSON.stringify(reflection), { ex: ttl });
      
      console.log(`[Enrichment Callback] ✅ Updated ${reflectionKey} with final data`);
      console.log(`[Enrichment Callback]    Type: ${isGuest ? 'GUEST' : 'AUTHENTICATED'}`);
      console.log(`[Enrichment Callback]    TTL: ${ttl}s`);
      console.log(`[Enrichment Callback]    Primary: ${primary}`);
      console.log(`[Enrichment Callback]    Valence: ${valence}`);
      console.log(`[Enrichment Callback]    Dialogue Tuples: ${_dialogue_meta?.dialogue_tuples?.length || 0} tuples`);
      console.log(`[Enrichment Callback]    Poem: ${poemFromExcel ? 'Found' : 'None'} (from Excel)`);
      
      return NextResponse.json({
        success: true,
        rid,
        message: 'Enrichment saved',
        primary,
        isGuest,
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
