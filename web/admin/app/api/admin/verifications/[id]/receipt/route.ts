// Streams the receipt image from the admin API to the review detail page.
// The access token never reaches the browser: this handler attaches it and
// passes the bytes through untouched.

import { cookies } from 'next/headers';
import { BACKEND_API_URL, SESSION_COOKIE } from '@/lib/api';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) {
    return new Response('Receipt not found', { status: 404 });
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) {
    return new Response('Unauthorized', { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${BACKEND_API_URL}/admin/verifications/${params.id}/receipt`, {
      headers: { authorization: `Bearer ${token}`, accept: 'image/*' },
      cache: 'no-store',
    });
  } catch {
    return new Response('Receipt unavailable', { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response('Receipt unavailable', { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'private, max-age=300',
    },
  });
}
