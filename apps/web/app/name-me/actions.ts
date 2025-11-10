/**
 * Server Actions for Name Me page
 */

'use server';

import { resolveIdentity, savePigName } from '@/lib/identity-resolver';
import { redirect } from 'next/navigation';

/**
 * Validate pig name
 */
function validatePigName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();

  if (trimmed.length < 2) {
    return { valid: false, error: 'Name must be at least 2 characters' };
  }

  if (trimmed.length > 24) {
    return { valid: false, error: 'Name must be 24 characters or less' };
  }

  // Allow letters, numbers, spaces, hyphens, underscores
  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmed)) {
    return { valid: false, error: 'Name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  return { valid: true };
}

/**
 * Submit pig name (server action)
 */
export async function submitPigName(name: string): Promise<{
  success: boolean;
  error?: string;
  isGuest?: boolean;
  redirectTo?: string;
}> {
  try {
    // 1. Validate name
    const validation = validatePigName(name);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const trimmed = name.trim();

    // 2. Resolve identity
    const identity = await resolveIdentity();

    // 3. Save pig name (idempotent)
    const saveResult = await savePigName(identity.effectiveId, trimmed);

    if (!saveResult.success) {
      return { success: false, error: saveResult.error };
    }

    // 4. Log success (observability)
    console.log('[Name Me] ✅ Pig named:', {
      scope: identity.effectiveScope,
      pigLength: trimmed.length,
      isGuest: identity.effectiveScope === 'sid',
    });

    // 5. Return success with metadata for client
    return {
      success: true,
      isGuest: identity.effectiveScope === 'sid',
      redirectTo: '/city',
    };
  } catch (error) {
    console.error('[Name Me] ❌ Error saving pig name:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
}
