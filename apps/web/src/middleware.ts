/**
 * Next.js Middleware
 * 
 * Ensures __Host-leo_sid cookie exists on all app routes.
 * This runs before every request, providing stable session tracking.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

const SID_COOKIE_NAME = '__Host-leo_sid';
const SID_PREFIX = 'sid_';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Check if __Host-leo_sid cookie exists
  const existingSid = request.cookies.get(SID_COOKIE_NAME)?.value;

  if (!existingSid || !existingSid.startsWith(SID_PREFIX)) {
    // Mint new session ID
    const newSid = `${SID_PREFIX}${randomUUID()}`;

    // Set secure cookie
    // Note: __Host- prefix requires Secure=true, Path=/, no Domain
    response.cookies.set(SID_COOKIE_NAME, newSid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    console.log('[Middleware] Minted new SID:', newSid.substring(0, 12) + '...');
  }

  return response;
}

// Matcher: Run on all routes except static assets, API routes, and health checks
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, etc.)
     * - /api/* (all API routes including auth)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$|api/).*)',
  ],
};
