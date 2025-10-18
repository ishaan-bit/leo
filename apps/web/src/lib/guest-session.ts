/**
 * guest-session.ts
 * Lightweight anonymous session management for guest users
 */

import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

const GUEST_COOKIE_NAME = 'leo_guest_uid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Get or create a guest session UUID
 */
export async function getOrCreateGuestSession(): Promise<string> {
  const cookieStore = await cookies();
  const existingGuest = cookieStore.get(GUEST_COOKIE_NAME);
  
  if (existingGuest?.value) {
    return existingGuest.value;
  }
  
  // Create new guest UUID
  const guestUid = `guest_${randomUUID()}`;
  
  cookieStore.set(GUEST_COOKIE_NAME, guestUid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
  
  return guestUid;
}

/**
 * Get existing guest session (or null)
 */
export async function getGuestSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const existingGuest = cookieStore.get(GUEST_COOKIE_NAME);
  return existingGuest?.value || null;
}

/**
 * Clear guest session (used after Google sign-in migration)
 */
export async function clearGuestSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(GUEST_COOKIE_NAME);
}
