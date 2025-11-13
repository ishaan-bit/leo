/**
 * Identity Resolver
 * 
 * Server-only utility that provides the single source of truth for:
 * - Stable session ID (__Host-leo_sid)
 * - Authenticated user ID (NextAuth)
 * - Effective identity (user:<authId> or sid:<sid>)
 * - Pig profile (name, created_at)
 * 
 * CRITICAL: This module MUST run server-side only.
 */

import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { kv } from '@vercel/kv';
import { randomUUID } from 'crypto';

const SID_COOKIE_NAME = '__Host-leo_sid';
const SID_PREFIX = 'sid_';
const USER_PREFIX = 'user_';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Identity resolution result
 */
export type ResolvedIdentity = {
  sid: string;                    // Stable session ID from cookie
  authId: string | null;          // NextAuth user ID (null if not signed in)
  effectiveId: string;            // user:<authId> or sid:<sid>
  effectiveScope: 'user' | 'sid'; // Which scope is active
  pigName: string | null;         // Pig name from profile (null if not named)
  createdAt: string | null;       // When pig was created
};

/**
 * Pig profile stored in Redis
 */
type PigProfile = {
  pig_name: string;
  created_at: string;
};

/**
 * Get or create stable session ID from cookie
 * SIDE EFFECT: Mints cookie if missing
 */
async function getOrCreateSid(): Promise<string> {
  const cookieStore = await cookies();
  const existingSid = cookieStore.get(SID_COOKIE_NAME)?.value;

  if (existingSid && existingSid.startsWith(SID_PREFIX)) {
    return existingSid;
  }

  // Generate new session ID
  const newSid = `${SID_PREFIX}${randomUUID()}`;

  // Set secure cookie
  // Note: __Host- prefix requires Secure, Path=/, no Domain
  cookieStore.set(SID_COOKIE_NAME, newSid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });

  console.log('[Identity] Minted new SID:', newSid.substring(0, 12) + '...');
  return newSid;
}

/**
 * Get authenticated user ID from NextAuth session
 */
async function getAuthId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return null;
    }

    // Extract user ID from session (various providers use different fields)
    const userId = (session.user as any).id || (session.user as any).sub;
    if (!userId) {
      console.warn('[Identity] ⚠️ Session exists but no user ID found');
      return null;
    }

    return userId;
  } catch (error) {
    console.error('[Identity] ❌ Error reading auth session:', error);
    return null;
  }
}

/**
 * Read pig profile from Redis
 */
async function readPigProfile(key: string): Promise<PigProfile | null> {
  try {
    const data = await kv.get<PigProfile>(key);
    return data;
  } catch (error) {
    console.error(`[Identity] ❌ Error reading profile ${key}:`, error);
    return null;
  }
}

/**
 * Resolve the effective identity and pig profile
 * 
 * This is the SINGLE SOURCE OF TRUTH for identity in the app.
 * All routes/components should call this (or /api/effective) instead of
 * trying to determine identity client-side.
 * 
 * @returns ResolvedIdentity with sid, authId, effectiveId, and pigName
 */
export async function resolveIdentity(): Promise<ResolvedIdentity> {
  // 1. Ensure sid exists (mints if missing)
  const sid = await getOrCreateSid();

  // 2. Read NextAuth session (may be null)
  const authId = await getAuthId();

  // 3. Compute effective identity
  const effectiveScope: 'user' | 'sid' = authId ? 'user' : 'sid';
  // For guest sessions, sid already has 'sid_' prefix, so strip it when building effectiveId
  const strippedSid = sid.startsWith(SID_PREFIX) ? sid.substring(SID_PREFIX.length) : sid;
  const effectiveId = authId ? `${USER_PREFIX}${authId}` : `sid:${strippedSid}`;

  // 4. Read pig profile from the appropriate scope
  const profileKey = authId
    ? `user:${authId}:profile`
    : `sid:${strippedSid}:profile`;

  const profile = await readPigProfile(profileKey);

  // 5. Log resolution (for observability)
  console.log('[Identity] Resolved:', {
    sid: sid.substring(0, 12) + '...',
    authId: authId ? authId.substring(0, 12) + '...' : null,
    effectiveScope,
    hasPig: !!profile?.pig_name,
  });

  return {
    sid,
    authId,
    effectiveId,
    effectiveScope,
    pigName: profile?.pig_name || null,
    createdAt: profile?.created_at || null,
  };
}

/**
 * Write pig name to profile (idempotent)
 * Only writes if pig_name doesn't already exist
 */
export async function savePigName(
  effectiveId: string,
  pigName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Determine profile key from effectiveId
    let profileKey: string;
    if (effectiveId.startsWith(USER_PREFIX)) {
      const userId = effectiveId.substring(USER_PREFIX.length);
      profileKey = `user:${userId}:profile`;
    } else if (effectiveId.startsWith('sid:')) {
      const sid = effectiveId.substring(4);
      profileKey = `sid:${sid}:profile`;
    } else {
      return { success: false, error: 'Invalid effectiveId format' };
    }

    // Check if pig already exists (idempotent)
    const existing = await readPigProfile(profileKey);
    if (existing?.pig_name) {
      console.log('[Identity] Pig already named:', existing.pig_name);
      return { success: true }; // Idempotent success
    }

    // Write new profile
    const profile: PigProfile = {
      pig_name: pigName,
      created_at: new Date().toISOString(),
    };

    await kv.set(profileKey, profile);

    console.log('[Identity] ✅ Saved pig name:', {
      scope: effectiveId.startsWith(USER_PREFIX) ? 'user' : 'sid',
      pigLength: pigName.length,
    });

    return { success: true };
  } catch (error) {
    console.error('[Identity] ❌ Error saving pig name:', error);
    return { success: false, error: 'Database error' };
  }
}

/**
 * Promote guest pig to authenticated user
 * Called after bind flow (email/OTP sign-in)
 * 
 * @param sid - Session ID with guest pig
 * @param authId - Authenticated user ID to promote to
 * @returns Success status and whether migration occurred
 */
export async function promoteGuestPig(
  sid: string,
  authId: string
): Promise<{ success: boolean; migrated: boolean; error?: string }> {
  try {
    const guestProfileKey = `sid:${sid}:profile`;
    const userProfileKey = `user:${authId}:profile`;

    // Read both profiles
    const guestProfile = await readPigProfile(guestProfileKey);
    const userProfile = await readPigProfile(userProfileKey);

    // If user already has a pig, don't overwrite
    if (userProfile?.pig_name) {
      console.log('[Identity] User already has pig, skipping promotion');
      return { success: true, migrated: false };
    }

    // If no guest pig to promote, nothing to do
    if (!guestProfile?.pig_name) {
      console.log('[Identity] No guest pig to promote');
      return { success: true, migrated: false };
    }

    // Promote guest pig to user
    await kv.set(userProfileKey, guestProfile);

    console.log('[Identity] ✅ Promoted guest pig to user:', {
      fromSid: sid.substring(0, 12) + '...',
      toUser: authId.substring(0, 12) + '...',
      pigName: guestProfile.pig_name,
    });

    // Optional: Migrate moments (future enhancement)
    // await migrateMoments(sid, authId);

    return { success: true, migrated: true };
  } catch (error) {
    console.error('[Identity] ❌ Error promoting guest pig:', error);
    return { success: false, migrated: false, error: 'Database error' };
  }
}

/**
 * Get pig profile key for given identity
 */
export function getProfileKey(effectiveId: string): string {
  if (effectiveId.startsWith(USER_PREFIX)) {
    const userId = effectiveId.substring(USER_PREFIX.length);
    return `user:${userId}:profile`;
  } else if (effectiveId.startsWith('sid:')) {
    const sid = effectiveId.substring(4);
    return `sid:${sid}:profile`;
  }
  throw new Error(`Invalid effectiveId: ${effectiveId}`);
}
