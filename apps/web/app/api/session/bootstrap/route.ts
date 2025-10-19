/**
 * Session Bootstrap Endpoint
 * Creates or retrieves session for guest users
 * Detects signed-in users and links session to user_id
 * 
 * POST /api/session/bootstrap
 * Writes: session:{sid} with TTL 7 days
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv, logKvOperation, generateSessionId } from '@/lib/kv';
import { getAuth, getSid, kvKeys } from '@/lib/auth-helpers';
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
    const { locale, timezone } = body;

    // Get auth state and session ID
    const auth = await getAuth();
    const sid = await getSid();

    let existing: Session | null = null;

    // Try to retrieve existing session
    const key = kvKeys.session(sid);
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

    // Create new session if none exists
    if (!existing) {
      const now = new Date().toISOString();
      const deviceFingerprint = generateDeviceFingerprint(request);

      const session: Session = {
        sid,
        created_at: now,
        last_active: now,
        pig_id: null,
        user_id: auth?.userId || null,
        auth_state: auth ? 'signed_in' : 'guest',
        device_fingerprint: deviceFingerprint,
        locale: locale || null,
        timezone: timezone || null,
      };

      logKvOperation({ op: 'SETEX', key, phase: 'start', sid });

      try {
        await kv.set(key, JSON.stringify(session), { ex: SESSION_TTL });
        logKvOperation({ op: 'SETEX', key, phase: 'ok', sid });

        console.log('📝 Session created:', {
          sid,
          auth_state: session.auth_state,
          user_id: session.user_id,
        });

        return NextResponse.json({
          ok: true,
          sid,
          created: true,
          auth_state: session.auth_state,
          user_id: session.user_id,
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

    // Update existing session
    const updatedSession: Session = {
      ...existing,
      last_active: new Date().toISOString(),
      // Update auth state if user signed in
      user_id: auth?.userId || existing.user_id,
      auth_state: auth ? 'signed_in' : existing.auth_state,
    };

    logKvOperation({ op: 'SETEX', key, phase: 'start', sid });

    try {
      await kv.set(key, JSON.stringify(updatedSession), { ex: SESSION_TTL });
      logKvOperation({ op: 'SETEX', key, phase: 'ok', sid });

      console.log('📝 Session updated:', {
        sid,
        auth_state: updatedSession.auth_state,
        user_id: updatedSession.user_id,
        was_guest: existing.auth_state === 'guest',
        now_signed_in: updatedSession.auth_state === 'signed_in',
      });

      return NextResponse.json({
        ok: true,
        sid,
        created: false,
        auth_state: updatedSession.auth_state,
        user_id: updatedSession.user_id,
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
