// ============================================================
// Yene Verify — OTP Sender Interface
// ============================================================

import { OtpPurpose } from '../constants';

/** Interface for sending OTP codes via SMS. */
export interface OtpSender {
  send(phone: string, code: string, purpose: OtpPurpose): Promise<void>;
}
