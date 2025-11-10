/**
 * Universal QR Entry Point
 * 
 * Route: /enter?t=<token>
 * 
 * Flow:
 * 1. Resolve identity (sid, authId, pigName)
 * 2. Lookup QR token metadata (optional)
 * 3. If pig exists → redirect to main scene
 * 4. Else → redirect to /name-me
 * 
 * Handles requested_mode from QR token:
 * - 'auto' (default): Use resolver as-is
 * - 'guest': Force guest mode (don't prompt sign-in)
 * - 'auth': Require authentication before proceeding
 */

import { redirect } from 'next/navigation';
import { resolveIdentity } from '@/lib/identity-resolver';
import { kv } from '@vercel/kv';

// Force dynamic rendering (uses cookies)
export const dynamic = 'force-dynamic';

type QRTokenMetadata = {
  campaign?: string;
  requested_mode?: 'auto' | 'guest' | 'auth';
  redirect?: string;
  created_at?: string;
};

interface EnterPageProps {
  searchParams: Promise<{ t?: string }>;
}

export default async function EnterPage({ searchParams }: EnterPageProps) {
  const params = await searchParams;
  const token = params.t;

  // 1. Resolve identity
  const identity = await resolveIdentity();

  // Log entry event (observability)
  console.log('[Entry] QR scan:', {
    token: token?.substring(0, 8) + '...',
    sid: identity.sid.substring(0, 12) + '...',
    auth: !!identity.authId,
    effectiveScope: identity.effectiveScope,
    hasPig: !!identity.pigName,
  });

  // 2. Lookup QR token metadata (optional)
  let qrMeta: QRTokenMetadata | null = null;
  if (token) {
    try {
      qrMeta = await kv.get<QRTokenMetadata>(`qr:${token}`);
    } catch (error) {
      console.error('[Entry] Error reading QR metadata:', error);
    }
  }

  const requestedMode = qrMeta?.requested_mode || 'auto';
  const defaultRedirect = qrMeta?.redirect || '/city';

  // 3. Handle requested_mode='auth' - require authentication
  if (requestedMode === 'auth' && !identity.authId) {
    // User must sign in before proceeding
    const returnUrl = `/enter${token ? `?t=${token}` : ''}`;
    redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(returnUrl)}`);
  }

  // 4. If pig exists → go to main scene
  if (identity.pigName) {
    console.log('[Entry] ✅ Pig exists, redirecting to main scene:', identity.pigName);
    redirect(defaultRedirect);
  }

  // 5. First touch → name your pig
  console.log('[Entry] 🆕 First touch, redirecting to /name-me');
  redirect('/name-me');
}
