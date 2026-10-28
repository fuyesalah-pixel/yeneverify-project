// ============================================================
// Yene Verify — Mock FCM Provider (dev + tests)
//
// Never throws, always "delivers". Logs a masked token so test
// output proves the push pipe without leaking PII. The e2e suite
// swaps this implementation — or a jest spy — to assert what a
// real provider would have received.
// ============================================================

import { Injectable, Logger } from '@nestjs/common';
import type { FcmProvider, FcmSendInput, FcmSendResult } from './fcm.provider';

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

@Injectable()
export class MockFcmProvider implements FcmProvider {
  readonly name = 'mock' as const;
  private readonly logger = new Logger('MockFcmProvider');

  /** Invocations are recorded so tests/e2e can assert on the payload. */
  readonly sent: FcmSendInput[] = [];

  async send(input: FcmSendInput): Promise<FcmSendResult> {
    this.sent.push(input);
    this.logger.log(
      `push.sent title="${input.title}" token=${maskToken(input.token)} keys=${Object.keys(input.data ?? {}).join(',') || 'none'}`,
    );
    return { messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  }

  async health(): Promise<boolean> {
    return true;
  }
}
