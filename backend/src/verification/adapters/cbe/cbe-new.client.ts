// ============================================================
// Yene Verify — CBE New Receipt Client
//
// CBE's new receipt system exposes a public JSON lookup keyed by
// the short ID printed in the receipt QR code:
//
//   GET https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{SHORT_ID}
//
// No PDF, no account digits. Every field the verifier needs is in
// the response, so the adapter can answer VERIFIED from this call
// alone. All fields are typed optional: the response is an external
// boundary, and the parser decides whether it is usable.
// ============================================================

import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

const CBE_NEW_API_BASE = 'https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail';
const CBE_NEW_TIMEOUT_MS = 5000;

/** Identifiers CBE's own app sends on this public endpoint. */
export const CBE_NEW_HEADERS = {
  'X-App-ID': 'd1292e42-7400-49de-a2d3-9731caa4c819',
  'X-App-Version': '0a01980b-9859-1369-8198-59f403820000',
  Accept: 'application/json',
} as const;

export interface CbeNewReceipt {
  id?: string;
  debitAccountHolder?: string;
  creditAccountHolder?: string;
  amountCredited?: string | number;
  creditCurrency?: string;
  dateTimes?: string[];
}

@Injectable()
export class CbeNewClient {
  constructor(private readonly httpClient: HttpService) {}

  async fetchReceipt(shortId: string): Promise<CbeNewReceipt> {
    const response = await firstValueFrom(
      this.httpClient.get<CbeNewReceipt>(`${CBE_NEW_API_BASE}/${encodeURIComponent(shortId)}`, {
        headers: CBE_NEW_HEADERS,
        timeout: CBE_NEW_TIMEOUT_MS,
      }),
    );
    return response.data;
  }
}
