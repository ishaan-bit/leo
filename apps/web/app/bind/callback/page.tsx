/**
 * Bind Callback - Post-Authentication Handler
 * 
 * Route: /bind/callback?next=<redirect>
 * 
 * After user successfully signs in (email or Google), this page:
 * 1. Promotes guest pig to authenticated user (if applicable)
 * 2. Redirects to the intended destination
 */

import { redirect } from 'next/navigation';
import { resolveIdentity, promoteGuestPig } from '@/lib/identity-resolver';
import { cookies } from 'next/headers';

// Force dynamic rendering (uses cookies and auth session)
export const dynamic = 'force-dynamic';

interface BindCallbackProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function BindCallbackPage({ searchParams }: BindCallbackProps) {
  const params = await searchParams;
  const next = params.next || '/city';

  // 1. Resolve current identity (should now be authenticated)
  const identity = await resolveIdentity();

  if (!identity.authId) {
    // User somehow isn't authenticated - redirect to bind page
    console.error('[Bind Callback] No authId found after sign-in');
    redirect(`/bind?next=${encodeURIComponent(next)}`);
  }

  // 2. Attempt to promote guest pig if it exists
  // The sid from the cookie represents the guest session before auth
  const cookieStore = await cookies();
  const sid = cookieStore.get('__Host-leo_sid')?.value;

  if (sid && sid.startsWith('sid_')) {
    const result = await promoteGuestPig(sid, identity.authId);

    if (result.migrated) {
      console.log('[Bind Callback] ✅ Guest pig promoted to user');
    } else {
      console.log('[Bind Callback] No guest pig to promote or user already has pig');
    }
  }

  // 3. Redirect to intended destination
  console.log('[Bind Callback] Redirecting to:', next);
  redirect(next);
}
