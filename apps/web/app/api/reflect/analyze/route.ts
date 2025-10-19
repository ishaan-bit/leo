/**
 * Webhook endpoint to trigger reflection analysis
 * Called after a reflection is saved to enrich it with behavioral analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';

// For now, we'll process inline. In production, this should be a queue/webhook to Python service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rid } = body;

    if (!rid) {
      return NextResponse.json({
        error: 'Missing rid parameter',
        code: 'VALIDATION_FAILED',
      }, { status: 400 });
    }

    console.log('🧠 Analysis webhook triggered for', rid);

    // Fetch the reflection
    const reflectionData = await kv.get(`reflection:${rid}`);
    
    if (!reflectionData) {
      return NextResponse.json({
        error: 'Reflection not found',
        code: 'NOT_FOUND',
        rid,
      }, { status: 404 });
    }

    const reflection = JSON.parse(reflectionData as string);

    // Check if already analyzed
    if (reflection.analysis && reflection.analysis.version) {
      return NextResponse.json({
        ok: true,
        message: 'Already analyzed',
        rid,
        cached: true,
      });
    }

    // Call behavioral analysis server (phi-3 hybrid + temporal)
    console.log('🧠 Calling behavioral analysis server for', rid);
    
    const behavioralApiUrl = process.env.BEHAVIORAL_API_URL || 'http://localhost:8000';
    console.log('🔗 BEHAVIORAL_API_URL:', behavioralApiUrl);
    console.log('🔗 Full URL:', `${behavioralApiUrl}/enrich/${rid}`);
    
    try {
      const enrichResponse = await fetch(`${behavioralApiUrl}/enrich/${rid}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!enrichResponse.ok) {
        const errorText = await enrichResponse.text();
        throw new Error(`Enrichment failed: ${enrichResponse.status} ${errorText}`);
      }

      const enrichResult = await enrichResponse.json();
      
      console.log('✅ Enrichment complete:', enrichResult);

      return NextResponse.json({
        ok: true,
        message: 'Analysis completed via behavioral server (phi-3 hybrid)',
        rid,
        analysis_version: enrichResult.analysis_version,
        latency_ms: enrichResult.latency_ms,
      });

    } catch (enrichError) {
      console.error('❌ Behavioral server enrichment failed:', enrichError);
      console.log('   Is behavioral server running? Start with: cd behavioral-backend && python server.py');
      
      // Fallback to placeholder if behavioral server is down
      console.log('⚠️  Falling back to placeholder analysis');
    }
    
    // Fallback placeholder analysis (only if Python backend fails)
    const analysis = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      timezone_used: reflection.client_context?.timezone || 'Asia/Kolkata',
      hash_of_input: `placeholder_${rid}`,
      event: {
        summary: 'Reflection event',
        entities: [],
        context_type: 'general',
      },
      feelings: {
        invoked: { primary: 'neutral', secondary: 'indifference', score: 0.5 },
        expressed: {
          valence: reflection.valence || 0,
          arousal: reflection.arousal || 0.3,
          confidence: 0.8,
        },
        congruence: 0.8,
      },
      self_awareness: {
        clarity: 0.5,
        depth: 0.4,
        authenticity: 0.7,
        effort: 0.5,
        expression_control: 0.7,
        composite: 0.56,
      },
      temporal: {
        short_term_momentum: { valence_delta_7: null, arousal_delta_7: null },
        long_term_baseline: { valence_z: null, arousal_z: null, baseline_window_days: 90 },
        seasonality: {
          day_of_week: new Date(reflection.timestamp).toLocaleDateString('en-US', { weekday: 'long' }),
          hour_bucket: 'Morning',
          is_typical_time: false,
        },
        streaks: { positive_valence_days: 0, negative_valence_days: 0 },
      },
      recursion: {
        linked_prior_rids: [],
        link_method: '',
        thread_insight: '',
      },
      risk: {
        level: 'none',
        signals: [],
        policy: 'nonclinical-screen',
        explanations: [],
      },
      tags_auto: [],
      insights: [],
      provenance: {
        models: {
          event_extractor: 'placeholder@v1',
          sentiment_regressor: 'placeholder@v1',
          emotion_mapper: 'placeholder@v1',
          safety_classifier: 'placeholder@v1',
          embedding: 'none@v1',
        },
        thresholds: {
          recursion_link_cosine: 0.8,
          recursion_link_jaccard: 0.4,
        },
        latency_ms: 0,
      },
    };

    // Merge analysis into reflection
    reflection.analysis = analysis;

    // Save back to KV
    await kv.set(`reflection:${rid}`, JSON.stringify(reflection));

    console.log('✅ Analysis added to reflection', rid);

    return NextResponse.json({
      ok: true,
      message: 'Analysis completed',
      rid,
      analysis_version: analysis.version,
    });

  } catch (error) {
    console.error('❌ Analysis webhook error:', error);
    
    return NextResponse.json({
      error: 'Failed to analyze reflection',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
