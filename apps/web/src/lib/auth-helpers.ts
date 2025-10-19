/**
 * Authentication & Session Helpers
 * Centralized utilities for user auth and session management
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { cookies } from 'next/headers';

/**
 * User authentication data from NextAuth session
 */
export type AuthUser = {
  userId: string;
  email: string;
  name: string | null;
  image: string | null;
  provider?: string;
};

/**
 * Get authenticated user from NextAuth session
 * Server-side only (uses getServerSession)
 */
export async function getAuth(): Promise<AuthUser | null> {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return null;
    }

    // Extract user ID from session
    const userId = (session.user as any).id || (session.user as any).sub;
    
    if (!userId) {
      console.warn('⚠️ Session exists but no user ID found');
      return null;
    }

    return {
      userId,
      email: session.user.email || '',
      name: session.user.name || null,
      image: session.user.image || null,
      provider: (session as any).provider || 'google',
    };
  } catch (error) {
    console.error('❌ getAuth error:', error);
    return null;
  }
}

/**
 * Get or create stable session ID from cookie
 * Returns existing sid from cookie, or generates new one
 * Server-side only (uses cookies())
 */
export async function getSid(): Promise<string> {
  const cookieStore = cookies();
  const existingSid = cookieStore.get('leo_sid')?.value;

  if (existingSid && existingSid.startsWith('sess_')) {
    return existingSid;
  }

  // Generate new session ID
  const newSid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // Set cookie (7 days expiry)
  cookieStore.set('leo_sid', newSid, {
    maxAge: 604800, // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return newSid;
}

/**
 * KV key namespace utilities
 * Centralized key pattern management
 */
export const kvKeys = {
  // Session keys
  session: (sid: string) => `session:${sid}`,
  sessionRecentReflections: (sid: string) => `session:${sid}:recent_reflections`,
  
  // User keys
  user: (uid: string) => `user:${uid}`,
  userRecentReflections: (uid: string) => `user:${uid}:recent_reflections`,
  
  // Pig keys
  pigSession: (sid: string) => `pig:session:${sid}`,
  pigUser: (uid: string) => `pig:${uid}`,
  pig: (pigId: string) => `pig:${pigId}`,
  
  // Reflection keys
  reflection: (rid: string) => `reflection:${rid}`,
  reflectionDraft: (sid: string) => `reflection:draft:${sid}`,
  reflectionsByOwner: (ownerId: string) => `reflections:${ownerId}`,
  reflectionsByPig: (pigId: string) => `pig_reflections:${pigId}`,
  reflectionsAll: () => `reflections:all`,
  
  // Rate limit keys
  rateLimit: (sid: string) => `rl:sid:${sid}`,
  
  // Admin keys
  sanity: () => `sanity:app`,
  sanityTtl: () => `sanity:ttl`,
};

/**
 * Build owner_id from user/session
 */
export function buildOwnerId(userId: string | null, sid: string): string {
  return userId ? `user:${userId}` : `guest:${sid}`;
}

/**
 * Parse owner_id into type and id
 */
export function parseOwnerId(ownerId: string): { type: 'user' | 'guest'; id: string } {
  const [type, id] = ownerId.split(':');
  return {
    type: type as 'user' | 'guest',
    id: id || '',
  };
}
