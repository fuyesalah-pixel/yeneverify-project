// ============================================================
// Yene Verify — Firebase FCM Provider (production, Step 15)
//
// Initializes firebase-admin lazily from FCM_PROJECT_ID /
// FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY. The private key arrives
// with ESCAPED newlines ("\n" as two chars) from env / secret
// files, so it is normalized here as defense in depth before
// cert() sees it — cert() fails with a cryptic signature
// otherwise.
//
// Firebase error codes are mapped to the typed FCM errors the
// fan-out loop understands.
// ============================================================

import { Injectable } from '@nestjs/common';
import type { App } from 'firebase-admin/app';
import type { Messaging } from 'firebase-admin/messaging';
import type { AppConfigService } from '../../config/config.service';
import { FcmSendError, FcmTokenInvalidError } from './fcm.errors';
import type { FcmProvider, FcmSendInput, FcmSendResult } from './fcm.provider';

@Injectable()
export class FirebaseFcmProvider implements FcmProvider {
  readonly name = 'firebase' as const;
  private app: App | null = null;
  private messagingClient: Messaging | null = null;

  constructor(private readonly config: AppConfigService) {}

  async send(input: FcmSendInput): Promise<FcmSendResult> {
    const messaging = await this.messaging();
    try {
      const messageId = await messaging.send({
        token: input.token,
        notification: { title: input.title, body: input.body },
        data: input.data,
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
      });
      return { messageId };
    } catch (err) {
      // firebase-admin throws FirebaseError objects carrying a `code`
      // ('messaging/…'); match on BOTH the code prop and the message so
      // surface changes in the SDK do not silently demote revocations
      // to generic send errors.
      const code =
        (err as { code?: string } | undefined)?.code ??
        (err instanceof Error ? err.message : String(err));
      if (code.includes('registration-token-not-registered')) {
        throw new FcmTokenInvalidError();
      }
      if (code.includes('invalid-argument')) {
        throw new FcmSendError(
          `FCM invalid argument: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      throw new FcmSendError(err instanceof Error ? err.message : String(err));
    }
  }

  async health(): Promise<boolean> {
    try {
      await this.messaging();
      return true;
    } catch {
      return false;
    }
  }

  /** Opens the admin app on first use (never at construction → tests safe). */
  private async messaging(): Promise<Messaging> {
    if (!this.app) {
      const { initializeApp, cert } = await import('firebase-admin/app');
      const { getMessaging } = await import('firebase-admin/messaging');
      const fcm = this.config.fcm;
      if (!fcm.projectId || !fcm.clientEmail || !fcm.privateKey) {
        throw new FcmSendError(
          'FCM firebase provider configured without FCM_PROJECT_ID / FCM_CLIENT_EMAIL / FCM_PRIVATE_KEY',
        );
      }
      this.app = initializeApp(
        {
          credential: cert({
            projectId: fcm.projectId,
            clientEmail: fcm.clientEmail,
            // cert() requires the SERVED key: expand escaped newlines
            // that survived both dotenv parsing and secret loaders.
            privateKey: fcm.privateKey.replace(/\\n/g, '\n'),
          }),
        },
        'yene-verify',
      );
      this.messagingClient = getMessaging(this.app);
    }
    // messagingClient is assigned synchronously with app above.
    return this.messagingClient as Messaging;
  }
}
