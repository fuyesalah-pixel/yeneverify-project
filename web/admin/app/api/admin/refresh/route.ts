import { NextResponse } from 'next/server';
import { REFRESH_COOKIE, SESSION_COOKIE } from '@/lib/api';
import { refreshAdminSession } from '@/lib/backend';

export const dynamic = 'force-dynamic';

/**
 * Rotates the admin session cookies, then sends the browser back to the page
 * it was trying to render. Used whenever a page hits a 401 — an access token
 * lives 15 minutes, and a render is not allowed to set cookies itself.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = url.searchParams.get('next') ?? '/dashboard';
  const next =
    requested.startsWith('/') && !requested.startsWith('//') && !requested.startsWith('/\\')
      ? requested
      : '/dashboard';

  const refreshed = await refreshAdminSession();

  if (!refreshed) {
    const response = NextResponse.redirect(new URL('/login?expired=1', url.origin));
    for (const name of [SESSION_COOKIE, REFRESH_COOKIE]) {
      response.cookies.set(name, '', { httpOnly: true, path: '/', maxAge: 0 });
    }
    return response;
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
