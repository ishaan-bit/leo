import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  
  // Redirect /p/:pigId to /reflect/:pigId
  if (pathname.startsWith('/p/') && pathname !== '/p') {
    const pigId = pathname.slice(3); // Remove '/p/'
    const newUrl = new URL(`/reflect/${pigId}${search}`, request.url);
    
    console.log('[Middleware] route_redirect:', {
      from: pathname,
      to: `/reflect/${pigId}`,
      pigId,
      hasSearch: !!search,
    });
    
    return NextResponse.redirect(newUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: '/p/:path*',
};
