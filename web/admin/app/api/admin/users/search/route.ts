// Proxy the admin user search for the notification composer's picker.
// Session cookies stay server-side; the browser only sees the trimmed rows.

import { NextResponse } from 'next/server';
import { apiCall } from '@/lib/backend';
import type { UserListResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim();
  if (query.length < 2) return NextResponse.json({ users: [] });

  const result = await apiCall<UserListResponse>(
    `/admin/users?page=1&pageSize=8&search=${encodeURIComponent(query)}`,
  );

  if (!result.ok) {
    return NextResponse.json({ users: [], error: result.message }, { status: result.status });
  }

  return NextResponse.json({
    users: result.data.users
      .filter((user) => user.role !== 'ADMIN')
      .map((user) => ({
        id: user.id,
        fullName: user.fullName,
        googleEmail: user.googleEmail,
        phone: user.phone,
        merchant: user.merchant?.businessName ?? null,
        status: user.status,
      })),
  });
}
