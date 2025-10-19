/**
 * Auth Merge Endpoint
 * Merges guest session data into signed-in user account
 * Called automatically after successful sign-in
 * 
 * POST /api/auth/merge
 * - Moves pig:session:{sid} → pig:{uid}
 * - Relinks reflections from guest:{sid} → user:{uid}
 * - Creates user:{uid} cache
 * - Updates session:{sid} with user_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv, logKvOperation } from '@/lib/kv';
import { getAuth, getSid, kvKeys, buildOwnerId } from '@/lib/auth-helpers';
import type { Reflection, Session } from '@/types/reflection.types';

const USER_TTL = 2592000; // 30 days
const REFLECTION_TTL = 2592000; // 30 days

export async function POST(request: NextRequest) {
  const mergeLog: any = {
    operation: 'auth_merge',
    timestamp: new Date().toISOString(),
    merged_reflections: 0,
    pig_moved: false,
    user_created: false,
    session_updated: false,
    errors: [],
  };

  try {
    // 1. Get auth state and session ID
    const auth = await getAuth();
    const sid = await getSid();

    if (!auth) {
      return NextResponse.json({
        error: 'Not authenticated',
        code: 'AUTH_REQUIRED',
      }, { status: 401 });
    }

    const { userId, email, name, provider } = auth;
    mergeLog.user_id = userId;
    mergeLog.sid = sid;

    console.log('🔄 Starting auth merge:', { userId, sid });

    // 2. Create or update user:{uid} cache
    const userKey = kvKeys.user(userId);
    logKvOperation({ op: 'GET', key: userKey, phase: 'start', sid });

    let userCache: any = null;
    try {
      const existing = await kv.get(userKey);
      userCache = existing ? JSON.parse(existing as string) : null;
    } catch (error) {
      console.error('Failed to fetch user cache:', error);
    }

    if (!userCache) {
      // Create new user cache
      userCache = {
        user_id: userId,
        email,
        name,
        provider,
        created_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      };
      mergeLog.user_created = true;
    } else {
      // Update last login
      userCache.last_login_at = new Date().toISOString();
    }

    logKvOperation({ op: 'SETEX', key: userKey, phase: 'start', sid });
    try {
      await kv.set(userKey, JSON.stringify(userCache), { ex: USER_TTL });
      logKvOperation({ op: 'SETEX', key: userKey, phase: 'ok', sid });
      console.log('✅ User cache updated:', userKey);
    } catch (error) {
      logKvOperation({ op: 'SETEX', key: userKey, phase: 'error', sid, error });
      mergeLog.errors.push({ step: 'user_cache', error: (error as Error).message });
    }

    // 3. Move pig:session:{sid} → pig:{uid} (if exists)
    const pigSessionKey = kvKeys.pigSession(sid);
    const pigUserKey = kvKeys.pigUser(userId);

    logKvOperation({ op: 'GET', key: pigSessionKey, phase: 'start', sid });
    
    try {
      const pigData = await kv.get(pigSessionKey);
      
      if (pigData) {
        const pigSession = JSON.parse(pigData as string);
        
        // Copy to user pig key
        logKvOperation({ op: 'SETEX', key: pigUserKey, phase: 'start', sid });
        await kv.set(pigUserKey, JSON.stringify({
          ...pigSession,
          owner_id: buildOwnerId(userId, sid),
          user_id: userId,
        }), { ex: USER_TTL });
        logKvOperation({ op: 'SETEX', key: pigUserKey, phase: 'ok', sid });
        
        // Delete session pig key
        await kv.del(pigSessionKey);
        logKvOperation({ op: 'DEL', key: pigSessionKey, phase: 'ok', sid });
        
        mergeLog.pig_moved = true;
        console.log('✅ Pig moved from session to user:', pigSession.pig_id);
      }
    } catch (error) {
      console.error('Failed to move pig:', error);
      mergeLog.errors.push({ step: 'pig_move', error: (error as Error).message });
    }

    // 4. Relink reflections from guest session
    const recentKey = kvKeys.sessionRecentReflections(sid);
    logKvOperation({ op: 'GET', key: recentKey, phase: 'start', sid });
    
    try {
      const recentData = await kv.get(recentKey);
      
      if (recentData) {
        const recent: Array<{ rid: string; ts: number }> = JSON.parse(recentData as string);
        console.log(`📝 Found ${recent.length} recent reflections to relink`);
        
        for (const { rid } of recent) {
          try {
            const reflectionKey = kvKeys.reflection(rid);
            const reflectionData = await kv.get(reflectionKey);
            
            if (reflectionData) {
              const reflection: Reflection = JSON.parse(reflectionData as string);
              
              // Only relink if it's a guest reflection from this session
              if (reflection.user_id === null && reflection.sid === sid) {
                // Update user_id and owner_id
                reflection.user_id = userId;
                reflection.owner_id = buildOwnerId(userId, sid);
                
                // Write back with same TTL
                await kv.set(reflectionKey, JSON.stringify(reflection), { ex: REFLECTION_TTL });
                
                mergeLog.merged_reflections++;
                console.log(`✅ Relinked reflection: ${rid}`);
              }
            }
          } catch (error) {
            console.error(`Failed to relink reflection ${rid}:`, error);
            mergeLog.errors.push({ step: 'relink_reflection', rid, error: (error as Error).message });
          }
        }
        
        logKvOperation({ op: 'GET', key: recentKey, phase: 'ok', sid });
      }
    } catch (error) {
      console.error('Failed to relink reflections:', error);
      mergeLog.errors.push({ step: 'relink_reflections', error: (error as Error).message });
    }

    // 5. Update session:{sid} with user_id and auth_state
    const sessionKey = kvKeys.session(sid);
    logKvOperation({ op: 'GET', key: sessionKey, phase: 'start', sid });
    
    try {
      const sessionData = await kv.get(sessionKey);
      
      if (sessionData) {
        const session: Session = JSON.parse(sessionData as string);
        session.user_id = userId;
        session.auth_state = 'signed_in';
        session.last_active = new Date().toISOString();
        
        await kv.set(sessionKey, JSON.stringify(session), { ex: 604800 }); // 7 days
        logKvOperation({ op: 'SETEX', key: sessionKey, phase: 'ok', sid });
        
        mergeLog.session_updated = true;
        console.log('✅ Session updated with user_id');
      }
    } catch (error) {
      console.error('Failed to update session:', error);
      mergeLog.errors.push({ step: 'session_update', error: (error as Error).message });
    }

    // 6. Log final merge summary
    console.log('🎉 MERGE_COMPLETE', JSON.stringify(mergeLog));

    return NextResponse.json({
      ok: true,
      message: 'Auth merge complete',
      summary: {
        user_id: userId,
        merged_reflections: mergeLog.merged_reflections,
        pig_moved: mergeLog.pig_moved,
        user_created: mergeLog.user_created,
        session_updated: mergeLog.session_updated,
        errors: mergeLog.errors.length,
      },
    });

  } catch (error) {
    console.error('❌ Auth merge error:', error);
    mergeLog.errors.push({
      step: 'general',
      error: error instanceof Error ? error.message : 'Unknown',
    });
    
    return NextResponse.json({
      error: 'Auth merge failed',
      details: error instanceof Error ? error.message : 'Unknown',
      stack_top: error instanceof Error ? error.stack?.split('\n')[0] : undefined,
      summary: mergeLog,
    }, { status: 500 });
  }
}
