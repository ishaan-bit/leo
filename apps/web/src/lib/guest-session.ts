/**
 * Guest Session Management
 * 
 * Centralized module for handling guest mode sessions with strict isolation.
 * Ensures no cross-user data leakage and proper localStorage management.
 * 
 * Key Principles:
 * - Every guest has: leo_guest_uid (UUID), pig_id (sid_xxx), pig_name
 * - localStorage is source of truth (never overwrite existing session)
 * - URL restore works ONCE (only if localStorage empty)
 * - All Upstash keys namespaced: guest:{guestUid}:*
 * - 5-minute TTL on all guest data
 */

import { v4 as uuidv4 } from 'uuid';

export interface GuestSession {
  guestUid: string;      // UUID for this guest
  pigId: string;         // sid_{guestUid}
  pigName: string;       // User-chosen pig name
  createdAt: string;     // ISO timestamp
}

// localStorage keys
const KEYS = {
  GUEST_UID: 'leo_guest_uid',
  PIG_NAME: 'leo_pig_name_local',
  SESSION_ID: 'guestSessionId', // Legacy - maps to guestUid
} as const;

/**
 * Generate a new guest session
 * Creates UUID, pig ID, and returns session object
 */
export function createGuestSession(pigName: string): GuestSession {
  const guestUid = uuidv4();
  const pigId = `sid_${guestUid}`;
  const createdAt = new Date().toISOString();
  
  const session: GuestSession = {
    guestUid,
    pigId,
    pigName,
    createdAt,
  };
  
  console.log('[GuestSession] 🆕 Created new session:', {
    guestUid,
    pigId,
    pigName,
  });
  
  return session;
}

/**
 * Save guest session to localStorage
 * This is the ONLY way to persist guest sessions
 */
export function saveGuestSession(session: GuestSession): void {
  if (typeof window === 'undefined') {
    console.warn('[GuestSession] ⚠️ Cannot save session (SSR)');
    return;
  }
  
  localStorage.setItem(KEYS.GUEST_UID, session.guestUid);
  localStorage.setItem(KEYS.SESSION_ID, session.guestUid); // Legacy support
  localStorage.setItem(KEYS.PIG_NAME, session.pigName);
  
  console.log('[GuestSession] 💾 Saved to localStorage:', {
    guestUid: session.guestUid,
    pigId: session.pigId,
    pigName: session.pigName,
  });
}

/**
 * Load guest session from localStorage
 * Returns null if no session exists or if running in SSR
 */
export function loadGuestSession(): GuestSession | null {
  if (typeof window === 'undefined') {
    console.warn('[GuestSession] ⚠️ Cannot load session (SSR)');
    return null;
  }
  
  const guestUid = localStorage.getItem(KEYS.GUEST_UID);
  const pigName = localStorage.getItem(KEYS.PIG_NAME);
  
  if (!guestUid) {
    console.log('[GuestSession] 🏜️ No existing session found');
    return null;
  }
  
  const pigId = `sid_${guestUid}`;
  
  console.log('[GuestSession] ✅ Loaded existing session:', {
    guestUid,
    pigId,
    pigName,
  });
  
  return {
    guestUid,
    pigId,
    pigName: pigName || 'Guest',
    createdAt: new Date().toISOString(), // Unknown - set to now
  };
}

/**
 * Restore guest session from URL
 * ONLY works if localStorage is empty (one-time restore)
 * 
 * @param pigIdFromUrl - The sid_xxx from URL query param
 * @param pigNameFromUrl - Optional pig name from URL
 * @returns true if session was restored, false if localStorage already had session
 */
export function restoreFromUrl(pigIdFromUrl: string, pigNameFromUrl?: string): boolean {
  if (typeof window === 'undefined') {
    console.warn('[GuestSession] ⚠️ Cannot restore from URL (SSR)');
    return false;
  }
  
  // GUARD: If localStorage already has a session, DO NOT overwrite
  const existingSession = loadGuestSession();
  if (existingSession) {
    console.log('[GuestSession] 🚫 Session already exists in localStorage, ignoring URL restore');
    return false;
  }
  
  // Extract guestUid from pigId (format: sid_{uuid})
  if (!pigIdFromUrl.startsWith('sid_')) {
    console.error('[GuestSession] ❌ Invalid pigId format:', pigIdFromUrl);
    return false;
  }
  
  const guestUid = pigIdFromUrl.replace('sid_', '');
  
  const session: GuestSession = {
    guestUid,
    pigId: pigIdFromUrl,
    pigName: pigNameFromUrl || 'Guest',
    createdAt: new Date().toISOString(),
  };
  
  saveGuestSession(session);
  
  console.log('[GuestSession] 🔄 Restored session from URL:', {
    guestUid,
    pigId: pigIdFromUrl,
    pigName: pigNameFromUrl,
  });
  
  return true;
}

/**
 * Clear guest session from localStorage
 * Used after TTL expiry or when user explicitly wants to start fresh
 */
export function clearGuestSession(): void {
  if (typeof window === 'undefined') {
    console.warn('[GuestSession] ⚠️ Cannot clear session (SSR)');
    return;
  }
  
  localStorage.removeItem(KEYS.GUEST_UID);
  localStorage.removeItem(KEYS.SESSION_ID);
  localStorage.removeItem(KEYS.PIG_NAME);
  
  console.log('[GuestSession] 🧹 Cleared guest session');
}

/**
 * Validate that pigId matches current localStorage session
 * Used to detect session mismatches (e.g., stale URL)
 */
export function validatePigId(pigId: string): boolean {
  const session = loadGuestSession();
  
  if (!session) {
    console.warn('[GuestSession] ⚠️ No session to validate against');
    return false;
  }
  
  const matches = session.pigId === pigId;
  
  console.log('[GuestSession] 🔍 Validation:', {
    urlPigId: pigId,
    sessionPigId: session.pigId,
    matches,
  });
  
  return matches;
}

/**
 * Get Upstash namespace for guest data
 * All guest keys MUST use this prefix
 */
export function getGuestNamespace(guestUid: string): string {
  return `guest:${guestUid}`;
}

/**
 * Extract guestUid from pigId
 * Guest pigIds are formatted as: sid_{guestUid}
 */
export function extractGuestUidFromPigId(pigId: string): string | null {
  if (!pigId?.startsWith('sid_')) {
    return null;
  }
  return pigId.substring(4); // Remove 'sid_' prefix
}

/**
 * Get full Upstash key for guest reflection
 */
export function getGuestReflectionKey(guestUid: string, rid: string): string {
  return `${getGuestNamespace(guestUid)}:reflection:${rid}`;
}

/**
 * Get full Upstash key for guest reflections sorted set
 */
export function getGuestReflectionsSetKey(guestUid: string): string {
  return `${getGuestNamespace(guestUid)}:reflections`;
}

/**
 * Check if we're in guest mode (no NextAuth session)
 */
export function isGuestMode(session: any): boolean {
  return !session || session.user === undefined;
}
