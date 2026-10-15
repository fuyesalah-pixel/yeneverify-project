// ============================================================
// Yene Verify — Pino Log Redaction Paths
// Applied globally — secrets never appear in any log output.
// Also used by Sentry beforeSend scrubber.
// ============================================================

export const REDACT_PATHS: string[] = [
  // HTTP layer
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  // Request bodies
  'req.body.password',
  'req.body.otp',
  'req.body.pin',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.accessToken',
  // Generic nested
  '*.password',
  '*.otp',
  '*.otpCode',
  '*.pin',
  '*.pinHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.refreshTokenHash',
  '*.apiKey',
  '*.secret',
  '*.secretKey',
  '*.privateKey',
  '*.private_key',
  '*.authorization',
  // Specific env vars that must never appear
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'AFROMESSAGE_API_KEY',
  'R2_SECRET_ACCESS_KEY',
  'FCM_PRIVATE_KEY',
  'SMTP_PASS',
  'MINIO_SECRET_KEY',
];

export const REDACT_CENSOR = '[REDACTED]';

export const pinoRedactConfig = {
  paths: REDACT_PATHS,
  censor: REDACT_CENSOR,
};

/**
 * Deep redaction of secret-looking values in an arbitrary log event.
 * Uses REDACT_PATHS for keyed fields and replaces every occurrence of
 * the provided secret markers anywhere in the serialized output.
 */
export function redactSensitiveData<T>(event: T, secretMarkers: string[] = []): T {
  const CENSOR = REDACT_CENSOR;

  const redactDeep = (value: unknown): unknown => {
    if (typeof value === 'string') {
      let out = value;
      for (const marker of secretMarkers) {
        if (marker && out.includes(marker)) {
          out = out.split(marker).join(CENSOR);
        }
      }
      return out;
    }
    if (Array.isArray(value)) {
      return value.map(redactDeep);
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
        const keyIsSensitive = REDACT_PATHS.some(
          (p) => p === key || p === `*.${key}` || p.endsWith(`.${key}`),
        );
        out[key] = keyIsSensitive && typeof val === 'string' ? CENSOR : redactDeep(val);
      }
      return out;
    }
    return value;
  };

  return redactDeep(event) as T;
}

/**
 * Minimal structural type for Sentry events (avoids importing the SDK;
 * extra fields are preserved via the index signature).
 */
export interface SentryEvent {
  event_id?: string;
  message?: string;
  [key: string]: unknown;
}

/**
 * Builds a Sentry beforeSend callback that scrubs secret-looking values
 * and the configured secret markers from every event.
 */
export function createSentryBeforeSend(secretValues: readonly string[] = []) {
  return (event: SentryEvent): SentryEvent => redactSensitiveData(event, [...secretValues]);
}
