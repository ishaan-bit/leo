/**
 * Micro-Dream Trigger API
 * POST: Check if micro-dream should display and generate if needed
 * Called after each reflection save
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@/lib/kv';
import { getAuth, getSid, buildOwnerId } from '@/lib/auth-helpers';

const PYTHON_AGENT_URL = process.env.BEHAVIORAL_API_URL || 'http://localhost:8080';

/**
 * Check if micro-dream should trigger for this owner
 * Calls Python micro_dream_agent.py via Railway
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId } = body;

    if (!ownerId) {
      return NextResponse.json({
        error: 'Missing ownerId',
        code: 'VALIDATION_FAILED',
      }, { status: 400 });
    }

    console.log('🌙 Checking micro-dream trigger:', { ownerId });

    // Call Python agent via Railway to check if should display
    const agentUrl = `${PYTHON_AGENT_URL}/micro-dream/check`;
    
    try {
      const response = await fetch(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
        }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Micro-dream agent failed:', response.status, errorText);
        
        return NextResponse.json({
          ok: false,
          shouldDisplay: false,
          error: 'Agent unavailable',
        });
      }

      const result = await response.json();
      
      console.log('✅ Micro-dream check result:', result);

      return NextResponse.json({
        ok: true,
        shouldDisplay: result.should_display,
        microDream: result.micro_dream || null,
        signinCount: result.signin_count,
        nextDisplayAt: result.next_display_at,
      });

    } catch (fetchError) {
      console.error('❌ Failed to call micro-dream agent:', fetchError);
      
      // Return graceful fallback - don't break the UX
      return NextResponse.json({
        ok: false,
        shouldDisplay: false,
        error: 'Agent timeout',
      });
    }

  } catch (error) {
    console.error('❌ Micro-dream check error:', error);
    
    return NextResponse.json({
      error: 'Internal error',
      details: error instanceof Error ? error.message : 'Unknown',
    }, { status: 500 });
  }
}
