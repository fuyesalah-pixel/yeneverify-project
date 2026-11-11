import { NextResponse } from 'next/server';
import {
  apiErrorMessage,
  BACKEND_API_URL,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE_SECONDS,
  SESSION_COOKIE,
} from '@/lib/api';

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; role: string; status: string };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idToken = typeof body?.idToken === 'string' ? body.idToken : '';

  if (!idToken) {
    return NextResponse.json({ message: 'Missing Google ID token.' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_API_URL}/admin/auth/google/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Cannot reach the admin API. Please try again.' },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      { message: apiErrorMessage(payload, 'Sign-in failed. Please try again.') },
      { status: upstream.status },
    );
  }

  // The API wraps successful responses as { success, data, meta }.
  const result: LoginResult = payload?.data ?? payload;

  if (!result?.accessToken || !result?.refreshToken) {
    return NextResponse.json({ message: 'Unexpected response from the admin API.' }, { status: 502 });
  }

  const response = NextResponse.json({ user: result.user });
  const secure = process.env.NODE_ENV === 'production';

  response.cookies.set(SESSION_COOKIE, result.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(60, result.expiresIn || 900),
  });

  response.cookies.set(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  });

  return response;
}
