// Campaign detail (delivery stats) for the history modal.

import { NextResponse } from 'next/server';
import { apiCall } from '@/lib/backend';
import type { NotificationDetailResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!UUID.test(params.id)) {
    return NextResponse.json({ error: 'Notification not found.' }, { status: 404 });
  }

  const result = await apiCall<NotificationDetailResponse>(
    `/admin/notifications/history/${params.id}`,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
