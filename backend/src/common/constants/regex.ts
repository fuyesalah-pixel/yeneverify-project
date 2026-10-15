// ============================================================
// Yene Verify — Regex Library
// Centralized patterns for phones, bank references, etc.
// ============================================================

/** Ethiopian mobile phone — E.164 format */
export const REGEX_ETHIOPIAN_PHONE = /^\+251[79]\d{8}$/;

/** CBE reference: FT followed by 11+ digits/chars */
export const REGEX_CBE_REF = /^FT[A-Z0-9]{11,}$/;

/** Telebirr reference: DEV followed by 7 alphanumeric chars */
export const REGEX_TELEBIRR_REF = /^DEV[A-Z0-9]{7}$/;

/** Awash reference: 10chars-6chars pattern */
export const REGEX_AWASH_REF = /^[A-Z0-9]{10}-[A-Z0-9]{6}$/;

/** Abyssinia reference: FT followed by 12 chars */
export const REGEX_ABYSSINIA_REF = /^FT[A-Z0-9]{12}$/;

/** M-Pesa reference: 10 uppercase alphanumeric */
export const REGEX_MPESA_REF = /^[A-Z0-9]{10}$/;

/** Zemen reference: 3 digits + 4 letters + 9 digits */
export const REGEX_ZEMEN_REF = /^[0-9]{3}[A-Z]{4}[0-9]{9}$/;

/** UUID v4 or v7 */
export const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PIN: 4 or 6 digits */
export const REGEX_PIN = /^\d{4}(\d{2})?$/;

/** OTP: exactly 6 digits */
export const REGEX_OTP = /^\d{6}$/;

/** Amount format: optional sign, digits, optional decimal */
export const REGEX_AMOUNT = /^-?\d+(\.\d{1,2})?$/;
