/**
 * session.ts
 * Session context detection and persistence helpers
 */

import type { EntryContext } from '@/providers/SceneStateProvider';

const HAS_VISITED_KEY = 'leo.awakening.hasVisited';
const LAST_AFFECT_KEY = 'leo.awakening.affect.last';

/**
 * Determine entry context based on auth state and visit history
 * @param isAuthenticated - whether user is signed in
 * @returns 'firstTime' | 'returning' | 'guest'
 */
export function getEntryContext(isAuthenticated: boolean): EntryContext {
  if (typeof window === 'undefined') return 'guest';
  
  const hasVisited = localStorage.getItem(HAS_VISITED_KEY) === 'true';
  
  if (!isAuthenticated) {
    return 'guest';
  }
  
  if (!hasVisited) {
    return 'firstTime';
  }
  
  return 'returning';
}

/**
 * Mark that user has completed awakening scene
 * Should be called after authenticated users finish the ritual
 */
export function markVisited(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HAS_VISITED_KEY, 'true');
}

/**
 * Check if user has visited before (local flag)
 */
export function hasVisited(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(HAS_VISITED_KEY) === 'true';
}

/**
 * Persist affect vector to localStorage (for guests or backup)
 */
export function persistAffectLocal(affect: any): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_AFFECT_KEY, JSON.stringify(affect));
}

/**
 * Retrieve last affect vector from localStorage
 */
export function getLastAffectLocal(): any | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(LAST_AFFECT_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear stored affect data
 */
export function clearAffectLocal(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LAST_AFFECT_KEY);
}
