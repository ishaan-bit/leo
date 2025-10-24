/**
 * Dream Gate - Post-authentication router
 * PRODUCTION HOTFIX: Force dream playback for test users
 * Override is at the VERY TOP - bypasses all other logic when force_dream is ON
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth-helpers';
import { Redis } from '@upstash/redis';
import type { PendingDream, DreamState, ReflectionData } from '@/domain/dream/dream.types';
import { buildDream } from '@/domain/dream/dream-builder';
import { isForceDreamEnabled } from '@/lib/feature-flags';

const redis = Redis.fromEnv();

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Get current date in Asia/Kolkata timezone (YYYY-MM-DD)
 */
function getKolkataDate(): string {
  const now = new Date();
  const kolkataTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return kolkataTime.toISOString().split('T')[0];
}

/**
 * Validate pending dream structure
 */
function isValidPendingDream(dream: any): dream is PendingDream {
  return (
    dream &&
    typeof dream.scriptId === 'string' &&
    typeof dream.duration === 'number' &&
    typeof dream.opening === 'string' &&
    Array.isArray(dream.beats) &&
    dream.beats.length >= 1 &&
    dream.beats.every((b: any) => typeof b.t === 'number' && typeof b.kind === 'string')
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pigId = searchParams.get('pigId') || 'new';
  
  console.log('[Dream Gate] ========== ENTRY ==========');
  console.log('[Dream Gate] PigId:', pigId);
  console.log('[Dream Gate] URL:', req.url);
  
  try {
    // Get authenticated user
    const auth = await getAuth();
    console.log('[Dream Gate] Auth result:', auth ? `Authenticated (${auth.userId})` : 'Not authenticated');
    
    if (!auth) {
      console.log('[Dream Gate] No auth, redirecting to reflect');
      return NextResponse.redirect(new URL(`/reflect/${pigId}`, req.url));
    }

    const userId = auth.userId;

    // ========== FORCE DREAM OVERRIDE (TOP OF FUNCTION) ==========
    // Check if force_dream is enabled (cookie, query param, or Redis flag)
    const cookies = req.headers.get('cookie') || '';
    const forceDreamCheck = await isForceDreamEnabled(userId, searchParams, cookies, pigId);
    const forceDream = forceDreamCheck.enabled;
    
    console.log('[Dream Gate] force_dream:', forceDream ? 'ENABLED' : 'disabled');
    console.log('[Dream Gate] force_dream source:', forceDreamCheck.source);
    if (forceDreamCheck.key) {
      console.log('[Dream Gate] force_dream key:', forceDreamCheck.key);
    }

    if (forceDream) {
      // ========== FORCED MODE: ALWAYS BUILD AND PLAY DREAM ==========
      console.log('[Dream Gate] FORCE MODE: Bypassing all gates, building dream now');
      
      const pendingDreamKey = `user:${userId}:pending_dream`;
      let pendingDreamData: PendingDream | null = null;
      let builtNow = false;
      
      // Try to read existing pending dream
      try {
        const existing = await redis.get<PendingDream>(pendingDreamKey);
        
        if (existing && isValidPendingDream(existing)) {
          const expiresAt = new Date(existing.expiresAt).getTime();
          if (Date.now() < expiresAt) {
            pendingDreamData = existing;
            console.log('[Dream Gate] Found valid pending dream:', existing.scriptId);
          } else {
            console.log('[Dream Gate] Pending dream expired, will rebuild');
          }
        } else if (existing) {
          console.log('[Dream Gate] pending_malformed:', { sid: (existing as any)?.scriptId || 'unknown' });
        }
      } catch (error) {
        console.error('[Dream Gate] redis_read_error:', { key: pendingDreamKey, error: String(error) });
      }
      
      // Build dream if none exists or is invalid
      if (!pendingDreamData) {
        builtNow = true;
        console.log('[Dream Gate] Building dream in FORCE MODE...');
        
        // Fetch reflections
        const reflectionsKey = `user:${userId}:refl:idx`;
        let reflectionIds: string[] = [];
        
        try {
          const cutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
          reflectionIds = await redis.zrange(
            reflectionsKey,
            cutoff,
            Date.now(),
            { byScore: true }
          ) as string[];
          
          console.log('[Dream Gate] Reflection IDs found:', reflectionIds?.length || 0);
        } catch (error) {
          console.error('[Dream Gate] redis_read_error:', { key: reflectionsKey, error: String(error) });
          return NextResponse.redirect(new URL(`/reflect/${pigId}?error=storage`, req.url));
        }
        
        if (!reflectionIds || reflectionIds.length === 0) {
          console.log('[Dream Gate] No reflections found (user:refl:idx empty)');
          return NextResponse.redirect(new URL(`/reflect/${pigId}?error=no_reflections`, req.url));
        }

        // Fetch reflection data
        const reflections: ReflectionData[] = [];
        for (const rid of reflectionIds) {
          try {
            const reflData = await redis.get<ReflectionData>(`refl:${rid}`);
            if (reflData && reflData.final?.wheel?.primary) {
              reflections.push(reflData);
            }
          } catch (error) {
            console.error('[Dream Gate] redis_read_error:', { key: `refl:${rid}`, error: String(error) });
          }
        }

        console.log('[Dream Gate] Valid reflections loaded:', reflections.length);
        
        if (reflections.length === 0) {
          console.log('[Dream Gate] No valid reflection data (missing primary wheels)');
          return NextResponse.redirect(new URL(`/reflect/${pigId}?error=no_data`, req.url));
        }

        // Build dream with testMode=true
        const date = getKolkataDate();
        const dreamState = null; // Force as first-time to bypass eligibility
        
        console.log('[Dream Gate] Calling buildDream:', {
          reflections: reflections.length,
          testMode: true,
          date,
        });
        
        try {
          pendingDreamData = await buildDream({
            userId,
            reflections,
            dreamState,
            date,
            testMode: true, // BYPASS ALL GATES
          });
        } catch (error) {
          console.error('[Dream Gate] buildDream error:', String(error));
          return NextResponse.redirect(new URL(`/reflect/${pigId}?error=build_failed`, req.url));
        }

        if (!pendingDreamData) {
          console.error('[Dream Gate] buildDream returned null (should not happen in testMode)');
          return NextResponse.redirect(new URL(`/reflect/${pigId}?error=build_null`, req.url));
        }

        // Validate built dream
        if (!isValidPendingDream(pendingDreamData)) {
          console.error('[Dream Gate] Built dream is malformed:', pendingDreamData);
          return NextResponse.redirect(new URL(`/reflect/${pigId}?error=malformed`, req.url));
        }

        // Log build details
        const K = pendingDreamData.beats.filter(b => b.kind === 'moment').length;
        const primaries = [...new Set(pendingDreamData.beats.filter(b => b.building).map(b => b.building))];
        
        console.log('[Dream Gate] force_dream_build:', {
          sid: pendingDreamData.scriptId,
          K,
          candidate_count: reflections.length,
          primaries_used: primaries,
          beats_count: pendingDreamData.beats.length,
        });

        // Store in Redis
        try {
          await redis.set(pendingDreamKey, pendingDreamData, {
            ex: 14 * 24 * 60 * 60, // 14 days
          });
          console.log('[Dream Gate] Stored pending dream in Redis');
        } catch (error) {
          console.error('[Dream Gate] redis_write_error:', { key: pendingDreamKey, error: String(error) });
          // Continue anyway - dream is built, can still play
        }
      }

      // Clear the fd cookie now that we've used it
      const response = NextResponse.redirect(new URL(`/dream?sid=${pendingDreamData.scriptId}&testMode=1`, req.url));
      response.cookies.set('fd', '', { maxAge: 0, path: '/' });
      
      // Log routing decision
      console.log('[Dream Gate] force_dream_router:', {
        entering: true,
        pending_found: !builtNow,
        built_now: builtNow,
        sid: pendingDreamData.scriptId,
        force_dream: true,
      });
      
      console.log('[Dream Gate] ========== REDIRECTING TO DREAM ==========');
      return response;
    }

    // ========== NORMAL MODE (force_dream disabled) ==========
    console.log('[Dream Gate] Normal mode: Redirecting to reflect');
    return NextResponse.redirect(new URL(`/reflect/${pigId}`, req.url));
    
  } catch (error) {
    console.error('[Dream Gate] Unhandled error:', error);
    return NextResponse.redirect(new URL(`/reflect/${pigId}?error=unknown`, req.url));
  }
}
