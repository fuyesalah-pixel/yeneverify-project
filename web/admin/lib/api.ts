// Server-side API configuration for the admin app.
// Tokens live in httpOnly cookies; the browser never sees them.

export const BACKEND_API_URL =
  process.env.BACKEND_API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'https://verify-api.togttrading.com/api/v1';

export const SESSION_COOKIE = 'yv_admin_at';
export const REFRESH_COOKIE = 'yv_admin_rt';

export const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // 6 months

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ??
  '1042108670897-mvf53pl5jnrqpe7kco0cl75bbgm9vfuh.apps.googleusercontent.com';

interface ApiErrorBody {
  error?: { message?: string };
  message?: string;
}

/** Best-effort message from a backend error envelope. */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const typed = body as ApiErrorBody;
    return typed.error?.message ?? typed.message ?? fallback;
  }
  return fallback;
}
