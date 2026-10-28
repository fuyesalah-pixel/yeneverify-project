// ============================================================
// Yene Verify — FCM Provider Interface (Step 15)
//
// The only seam between the notification domain and Firebase
// Cloud Messaging. Tests inject the mock; production injects
// firebase-admin (FCM_MOCK=false). NotificationsService never
// touches firebase directly.
// ============================================================

export interface FcmSendInput {
  /** The device's FCM registration token (never logged in full). */
  token: string;
  title: string;
  body: string;
  /** String-valued only — FCM data payloads are string maps. */
  data?: Record<string, string>;
}

export interface FcmSendResult {
  messageId: string;
}

export interface FcmProvider {
  readonly name: 'mock' | 'firebase';
  send(input: FcmSendInput): Promise<FcmSendResult>;
  /** Cheap liveness probe (true in practice for the mock). */
  health(): Promise<boolean>;
}

/** Symbol under which the selected FcmProvider is registered in DI. */
export const FCM_PROVIDER = Symbol('FCM_PROVIDER');
