import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/api';

export function middleware(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/users/:path*',
    '/reports/:path*',
    '/notifications/:path*',
    '/review-queue/:path*',
    '/fraud/:path*',
    '/subscriptions/:path*',
    '/audit/:path*',
    '/health/:path*',
    '/admins/:path*',
    '/settings/:path*',
  ],
};
