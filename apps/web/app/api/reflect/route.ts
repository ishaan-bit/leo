/**
 * Reflection Storage API
 * POST: Save final reflection with full schema
 * GET: Retrieve reflections by pig or owner
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv, logKvOperation, generateReflectionId } from '@/lib/kv';
import { getAuth, getSid, kvKeys, buildOwnerId } from '@/lib/auth-helpers';
import { processReflectionText } from '@/lib/translation';
import type {
  Reflection,
  ReflectionInput,
  TypingMetrics,
  VoiceMetrics,
  ClientContext,
  BehavioralSignals,
  ConsentFlags,
  ProcessingVersion,
} from '@/types/reflection.types';

const REFLECTION_TTL = 2592000; // 30 days in seconds
const SESSION_RECENT_TTL = 604800; // 7 days in seconds
const RATE_LIMIT_WINDOW = 60; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 reflections per minute
const MAX_RECENT_REFLECTIONS = 25; // Maximum recent reflections to keep


/**
 * Rate limiting check
 */
async function checkRateLimit(sid: string): Promise<{ allowed: boolean; count: number }> {
  const key = `rl:sid:${sid}`;
  
  try {
    const count = await kv.incr(key);
    
    if (count === 1) {
      // First request in window, set TTL
      await kv.expire(key, RATE_LIMIT_WINDOW);
    }
    
    return {
      allowed: count <= RATE_LIMIT_MAX,
      count,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    return { allowed: true, count: 0 }; // Fail open
  }
}

/**
 * Extract behavioral signals from metrics
 */
function extractSignals(
  typingMetrics?: Partial<TypingMetrics>,
  voiceMetrics?: Partial<VoiceMetrics>
): BehavioralSignals {
  const signals: BehavioralSignals = {};

  if (typingMetrics) {
    if (typingMetrics.autocorrect_events && typingMetrics.autocorrect_events > 0) {
      signals.autocorrect = true;
    }
    if (typingMetrics.pauses && typingMetrics.avg_pause_ms && typingMetrics.avg_pause_ms > 2000) {
      signals.hesitation = true;
    }
    if (typingMetrics.wpm && typingMetrics.wpm > 80) {
      signals.rapid_typing = true;
    }
  }

  if (voiceMetrics) {
    if (voiceMetrics.silence_gaps_ms && voiceMetrics.silence_gaps_ms.length > 0) {
      const avgGap = voiceMetrics.silence_gaps_ms.reduce((a, b) => a + b, 0) / voiceMetrics.silence_gaps_ms.length;
      if (avgGap > 1500) {
        signals.silence_gaps = true;
      }
    }
  }

  return signals;
}

/**
 * Validate reflection input
 */
function validateInput(body: any): { valid: boolean; errors: Array<{ field: string; message: string }> } {
  const errors: Array<{ field: string; message: string }> = [];

  if (!body.pigId) {
    errors.push({ field: 'pigId', message: 'Pig ID is required' });
  }

  if (!body.originalText && !body.voiceTranscript) {
    errors.push({ field: 'originalText|voiceTranscript', message: 'Reflection text is required' });
  }

  if (!body.inputType) {
    errors.push({ field: 'inputType', message: 'Input type is required (notebook or voice)' });
  }

  if (!body.timestamp) {
    errors.push({ field: 'timestamp', message: 'Timestamp is required' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ReflectionInput = await request.json();
    
    // 1. Validate input
    const validation = validateInput(body);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
        details: validation.errors,
      }, { status: 400 });
    }

    // 2. Get auth state and session ID
    const auth = await getAuth();
    const sid = await getSid();
    const userId = auth?.userId || null;
    const ownerId = buildOwnerId(userId, sid);

    console.log('🔐 Auth check:', {
      authPresent: !!auth,
      userId,
      sid,
      ownerId,
    });

    // 3. Rate limiting
    const rateCheck = await checkRateLimit(sid);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        details: `Maximum ${RATE_LIMIT_MAX} reflections per minute`,
        count: rateCheck.count,
      }, { status: 429 });
    }

    // 4. Generate reflection ID
    const rid = generateReflectionId();

    // 5. Get raw text and translate/normalize
    const rawText = body.originalText || body.voiceTranscript || '';
    const inputMode = body.inputType === 'voice' ? 'voice' : 'typing';

    // 5a. Process text: detect language + translate to English
    const translationResult = await processReflectionText(rawText);
    const normalizedText = translationResult.normalizedText;
    const langDetected = translationResult.langDetected;

    console.log('🌐 Translation:', {
      rid,
      lang: langDetected,
      translation_used: translationResult.translationUsed,
      translation_error: translationResult.translationError,
      raw_preview: rawText.substring(0, 50),
      normalized_preview: normalizedText.substring(0, 50),
    });

    // 6. Build typing/voice summaries
    // 6. Build typing/voice summaries
    
    let typingSummary: TypingMetrics | null = null;
    let voiceSummary: VoiceMetrics | null = null;

    if (inputMode === 'typing' && body.metrics?.typing) {
      typingSummary = {
        total_chars: rawText.length,
        total_words: rawText.split(/\s+/).length,
        duration_ms: body.metrics.typing.duration_ms || 0,
        wpm: body.metrics.typing.wpm || 0,
        pauses: body.metrics.typing.pauses || [],
        avg_pause_ms: body.metrics.typing.avg_pause_ms || 0,
        autocorrect_events: body.metrics.typing.autocorrect_events || 0,
        backspace_count: body.metrics.typing.backspace_count || 0,
      };
    }

    if (inputMode === 'voice' && body.metrics?.voice) {
      voiceSummary = {
        duration_ms: body.metrics.voice.duration_ms || 0,
        confidence_avg: body.metrics.voice.confidence_avg || 0,
        confidence_min: body.metrics.voice.confidence_min || 0,
        silence_gaps_ms: body.metrics.voice.silence_gaps_ms || [],
        word_count: rawText.split(/\s+/).length,
        lang_detected: langDetected, // Use detected language
      };
    }

    // 7. Extract behavioral signals
    const signals = extractSignals(typingSummary || undefined, voiceSummary || undefined);

    // 8. Build client context
    const clientContext: ClientContext = {
      device: body.deviceInfo?.device || 'desktop',
      os: body.deviceInfo?.os,
      browser: body.deviceInfo?.browser,
      locale: body.deviceInfo?.locale,
      timezone: body.deviceInfo?.timezone,
      viewport: body.deviceInfo?.viewport,
    };

    // 9. Consent flags
    const consentFlags: ConsentFlags = {
      research: body.consentResearch !== false, // Default true
      audio_retention: body.consentAudioRetention === true, // Default false
    };

    // 10. Processing version
    const version: ProcessingVersion = {
      nlp: '1.0.0',
      valence: '1.0.0',
      ui: '1.0.0',
    };

    // 11. Build complete Reflection object
    const reflection: Reflection = {
      // Core IDs
      rid,
      sid,
      timestamp: body.timestamp,
      
      // Pig context
      pig_id: body.pigId,
      pig_name_snapshot: body.pigName || null,
      
      // Content - NOW WITH TRANSLATION
      raw_text: rawText,              // Original input (Hindi/English/Hinglish)
      normalized_text: normalizedText, // Translated to English
      lang_detected: langDetected,     // 'english', 'hindi', 'mixed'
      
      // Input mode
      input_mode: inputMode,
      typing_summary: typingSummary,
      voice_summary: voiceSummary,
      
      // Affect estimation (lightweight from typing/voice features)
      // NOTE: These are quick frontend estimates. Worker adds accurate final.valence/arousal
      valence: body.affect?.valence ?? null,
      arousal: body.affect?.arousal ?? null,
      confidence: body.affect?.cognitiveEffort ?? null,
      
      // Behavioral signals (from typing/voice patterns)
      signals,
      
      // Consent
      consent_flags: consentFlags,
      
      // Context
      client_context: clientContext,
      
      // User identity
      user_id: userId,
      owner_id: ownerId,
      
      // Version
      version,
    };

    // 11. Write reflection:{rid} with TTL 30d
    const reflectionKey = kvKeys.reflection(rid);
    logKvOperation({ op: 'SETEX', key: reflectionKey, phase: 'start', sid, rid });

    try {
      await kv.set(reflectionKey, JSON.stringify(reflection), { ex: REFLECTION_TTL });
      logKvOperation({ op: 'SETEX', key: reflectionKey, phase: 'ok', sid, rid });
    } catch (error) {
      logKvOperation({ op: 'SETEX', key: reflectionKey, phase: 'error', sid, rid, error });
      
      return NextResponse.json({
        error: 'Failed to save reflection',
        code: 'KV_WRITE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown',
      }, { status: 503 });
    }

    // 11b. Push to enrichment worker queue
    try {
      const normalizedPayload = {
        rid,
        sid,
        timestamp: body.timestamp,
        normalized_text: normalizedText,
        lang_detected: langDetected,
        input_mode: inputMode,
        client_context: clientContext,
      };
      
      await kv.rpush('reflections:normalized', JSON.stringify(normalizedPayload));
      console.log(`📤 Pushed ${rid} to enrichment queue`);
    } catch (error) {
      // Non-fatal: reflection is saved, enrichment can be triggered manually
      console.error('Failed to push to enrichment queue:', error);
    }

    // 12. Add to sorted sets (for querying)
    const ownerKey = kvKeys.reflectionsByOwner(ownerId);
    const pigKey = kvKeys.reflectionsByPig(body.pigId);
    const globalKey = kvKeys.reflectionsAll();
    const score = Date.now();

    try {
      await Promise.all([
        kv.zadd(ownerKey, { score, member: rid }),
        kv.zadd(pigKey, { score, member: rid }),
        kv.zadd(globalKey, { score, member: rid }),
      ]);
      
      logKvOperation({ op: 'ZADD', key: ownerKey, phase: 'ok', sid, rid });
    } catch (error) {
      // Non-fatal: reflection is saved, just indexing failed
      console.error('Failed to index reflection:', error);
    }

    // 13. Add to session recent_reflections list (for merge on sign-in)
    const recentKey = kvKeys.sessionRecentReflections(sid);
    try {
      // Get existing list
      const existingData = await kv.get(recentKey);
      const existing: Array<{ rid: string; ts: number }> = existingData 
        ? JSON.parse(existingData as string) 
        : [];
      
      // Add new reflection
      existing.unshift({ rid, ts: score });
      
      // Trim to max 25
      const trimmed = existing.slice(0, MAX_RECENT_REFLECTIONS);
      
      // Write back with TTL
      await kv.set(recentKey, JSON.stringify(trimmed), { ex: SESSION_RECENT_TTL });
      
      logKvOperation({ op: 'SET', key: recentKey, phase: 'ok', sid, rid });
    } catch (error) {
      // Non-fatal
      console.error('Failed to update recent reflections:', error);
    }

    // 14. Delete draft if exists
    try {
      await kv.del(kvKeys.reflectionDraft(sid));
    } catch (error) {
      // Non-fatal
      console.error('Failed to delete draft:', error);
    }

    // 15. Trigger analysis via direct Railway call (bypass Vercel function)
    console.log('🔥 Triggering analysis for rid:', rid);
    
    const railwayUrl = process.env.BEHAVIORAL_API_URL;
    console.log('🔗 Railway URL from env:', railwayUrl);
    
    if (railwayUrl) {
      try {
        const enrichUrl = `${railwayUrl}/enrich/${rid}`;
        console.log('🚀 Calling enrichment endpoint:', enrichUrl);
        
        const enrichResponse = await fetch(enrichUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        console.log('✅ Enrichment response status:', enrichResponse.status);
        
        if (!enrichResponse.ok) {
          const errorText = await enrichResponse.text();
          console.error('❌ Enrichment failed with status', enrichResponse.status, ':', errorText);
        }
      } catch (err) {
        console.error('❌ Railway enrichment error:', err instanceof Error ? err.message : err);
        // Non-fatal - reflection is already saved
      }
    } else {
      console.warn('⚠️ BEHAVIORAL_API_URL not set - skipping enrichment');
    }

    // 16. Trigger micro-dream check (MUST AWAIT to prevent cancellation)
    console.log('🌙 Triggering micro-dream check for owner:', ownerId);
    
    const microDreamUrl = `${process.env.NEXT_PUBLIC_APP_URL || `https://${request.headers.get('host')}`}/api/micro-dream/check`;
    
    try {
      const microDreamResponse = await fetch(microDreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId }),
      });
      
      if (microDreamResponse.ok) {
        console.log('✅ Micro-dream check completed');
      } else {
        console.error(`⚠️ Micro-dream check failed: ${microDreamResponse.status}`);
      }
    } catch (err) {
      console.error('⚠️ Micro-dream trigger error (non-fatal):', err instanceof Error ? err.message : err);
    }

    // 17. Success response
    return NextResponse.json({
      ok: true,
      rid,
      message: 'Reflection saved',
      userLinked: !!userId,
      data: {
        reflectionId: rid,
        ownerId,
        pigId: body.pigId,
        timestamp: body.timestamp,
        ttl_days: 30,
        user_id: userId,
      },
    });

  } catch (error) {
    console.error('❌ Reflection save error:', error);
    
    return NextResponse.json({
      error: 'Failed to save reflection',
      details: error instanceof Error ? error.message : 'Unknown',
      stack_top: error instanceof Error ? error.stack?.split('\n')[0] : undefined,
    }, { status: 500 });
  }
}


// Get reflections by pig
async function getReflectionsByPig(pigId: string, limit: number = 50) {
  const reflectionIds = await kv.zrange(`pig_reflections:${pigId}`, 0, limit - 1, { rev: true }) as string[];
  const reflections = await Promise.all(
    reflectionIds.map(async (id: string) => {
      const data = await kv.get(`reflection:${id}`);
      return data ? JSON.parse(data as string) : null;
    })
  );
  return reflections.filter(Boolean);
}

// Get reflections by owner
async function getReflectionsByOwner(ownerId: string, limit: number = 50) {
  const reflectionIds = await kv.zrange(`reflections:${ownerId}`, 0, limit - 1, { rev: true }) as string[];
  const reflections = await Promise.all(
    reflectionIds.map(async (id: string) => {
      const data = await kv.get(`reflection:${id}`);
      return data ? JSON.parse(data as string) : null;
    })
  );
  return reflections.filter(Boolean);
}

// Get reflections for a pig or user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pigId = searchParams.get('pigId');
    const ownerId = searchParams.get('ownerId');
    
    if (!pigId && !ownerId) {
      return NextResponse.json(
        { error: 'Missing pigId or ownerId parameter' },
        { status: 400 }
      );
    }
    
    let reflections: any[] = [];
    if (pigId) {
      reflections = await getReflectionsByPig(pigId, 50);
    } else if (ownerId) {
      reflections = await getReflectionsByOwner(ownerId, 50);
    }
    
    return NextResponse.json({
      success: true,
      reflections,
      count: reflections.length,
    });
  } catch (error) {
    console.error('❌ Error fetching reflections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reflections', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
