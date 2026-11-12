// Fingerprint detail (every verification that used the receipt) for the modal.

import { NextResponse } from 'next/server';
import { apiCall } from '@/lib/backend';
import type { FraudDuplicateDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FINGERPRINT = /^[0-9a-f]{64}$/i;

export async function GET(
  _request: Request,
  { params }: { params: { fingerprint: string } },
) {
  if (!FINGERPRINT.test(params.fingerprint)) {
    return NextResponse.json({ error: 'Fingerprint not found.' }, { status: 404 });
  }

  const result = await apiCall<FraudDuplicateDetail>(
    `/admin/fraud/duplicates/${params.fingerprint.toLowerCase()}`,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
