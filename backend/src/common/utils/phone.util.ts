import { REGEX_ETHIOPIAN_PHONE } from '../constants/regex';

/**
 * Normalize an Ethiopian phone number to E.164 format (+251XXXXXXXXX).
 * Handles: 09XXXXXXXX → +25109XXXXXXXX, 9XXXXXXXX → +2519XXXXXXXX.
 * Returns null if the input cannot be normalized.
 */
export function normalizePhone(input: string, defaultPrefix = '+251'): string | null {
  const clean = input.replace(/[\s\-().]/g, '');

  if (clean.startsWith('+251')) {
    return REGEX_ETHIOPIAN_PHONE.test(clean) ? clean : null;
  }

  if (clean.startsWith('251')) {
    const normalized = '+' + clean;
    return REGEX_ETHIOPIAN_PHONE.test(normalized) ? normalized : null;
  }

  if (clean.startsWith('0')) {
    const normalized = defaultPrefix + clean.slice(1);
    return REGEX_ETHIOPIAN_PHONE.test(normalized) ? normalized : null;
  }

  if (/^[79]\d{8}$/.test(clean)) {
    const normalized = defaultPrefix + clean;
    return REGEX_ETHIOPIAN_PHONE.test(normalized) ? normalized : null;
  }

  return null;
}

export function isValidEthiopianPhone(phone: string): boolean {
  return REGEX_ETHIOPIAN_PHONE.test(phone);
}

/** Mask a phone for safe logging: +251911111111 → +2519*****11 */
export function maskPhone(phone: string): string {
  if (phone.length < 8) return '***';
  return phone.slice(0, 5) + '*'.repeat(phone.length - 7) + phone.slice(-2);
}
