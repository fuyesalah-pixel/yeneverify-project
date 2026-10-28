// ============================================================
// Yene Verify — FCM typed errors (Step 15)
//
// FcmTokenInvalidError carries the special revocation signal:
// a registration token that FCM no longer knows can never
// succeed again — the device is revoked, never retried.
// ============================================================

export class FcmTokenInvalidError extends Error {
  constructor() {
    super('FCM registration token is no longer valid.');
    this.name = 'FcmTokenInvalidError';
  }
}

export class FcmSendError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'FcmSendError';
  }
}
