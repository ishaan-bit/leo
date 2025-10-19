/**
 * Session Bootstrap Endpoint
 * Creates or retrieves session for guest users
 * 
 * POST /api/session/bootstrap
 * Writes: session:{sid} with TTL 7 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv, logKvOperation, generateSessionId } from '@/lib/kv';
import type { Session } from '@/types/reflection.types';
import { createHash } from 'crypto';

const SESSION_TTL = 604800; // 7 days in seconds

/**
 * Generate device fingerprint from IP + user agent
 * Hashed for privacy
 */
function generateDeviceFingerprint(request: NextRequest): string {
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  // Hash to protect PII
  const raw = `${ip}:${userAgent}`;
  return createHash('sha256').update(raw).digest('hex').substring(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sid: providedSid, locale, timezone } = body;

    let sid = providedSid;
    let existing: Session | null = null;

    // If sid provided, try to retrieve existing session
    if (sid) {
      const key = `session:${sid}`;
      logKvOperation({ op: 'GET', key, phase: 'start', sid });
      
      try {
        const data = await kv.get(key);
        if (data) {
          existing = JSON.parse(data as string);
          logKvOperation({ op: 'GET', key, phase: 'ok', sid });
        }
      } catch (error) {
        logKvOperation({ op: 'GET', key, phase: 'error', sid, error });
      }
    }

    // Create new session if none exists
    if (!existing) {
      sid = generateSessionId();
      const now = new Date().toISOString();
      const deviceFingerprint = generateDeviceFingerprint(request);

      const session: Session = {
        sid,
        created_at: now,
        last_active: now,
        pig_id: null,
        user_id: null,
        device_fingerprint: deviceFingerprint,
        locale: locale || null,
        timezone: timezone || null,
      };

      const key = `session:${sid}`;
      logKvOperation({ op: 'SETEX', key, phase: 'start', sid });

      try {
        await kv.set(key, JSON.stringify(session), { ex: SESSION_TTL });
        logKvOperation({ op: 'SETEX', key, phase: 'ok', sid });

        return NextResponse.json({
          ok: true,
          sid,
          created: true,
          session,
        });
      } catch (error) {
        logKvOperation({ op: 'SETEX', key, phase: 'error', sid, error });
        
        return NextResponse.json({
          error: 'Failed to create session',
          code: 'KV_WRITE_FAILED',
          details: error instanceof Error ? error.message : 'Unknown',
        }, { status: 503 });
      }
    }

    // Update last_active for existing session
    const updatedSession: Session = {
      ...existing,
      last_active: new Date().toISOString(),
    };

    const key = `session:${sid}`;
    logKvOperation({ op: 'SETEX', key, phase: 'start', sid });

    try {
      await kv.set(key, JSON.stringify(updatedSession), { ex: SESSION_TTL });
      logKvOperation({ op: 'SETEX', key, phase: 'ok', sid });

      return NextResponse.json({
        ok: true,
        sid,
        created: false,
        session: updatedSession,
      });
    } catch (error) {
      logKvOperation({ op: 'SETEX', key, phase: 'error', sid, error });
      
      return NextResponse.json({
        error: 'Failed to update session',
        code: 'KV_WRITE_FAILED',
        details: error instanceof Error ? error.message : 'Unknown',
      }, { status: 503 });
    }

  } catch (error) {
    console.error('❌ Session bootstrap error:', error);
    
    return NextResponse.json({
      error: 'Session bootstrap failed',
      details: error instanceof Error ? error.message : 'Unknown',
      stack_top: error instanceof Error ? error.stack?.split('\n')[0] : undefined,
    }, { status: 500 });
  }
}
