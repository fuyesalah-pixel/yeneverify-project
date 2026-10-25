import { z } from 'zod';
import { Logger } from '@nestjs/common';

// ============================================================
// Yene Verify — Environment Variable Schema
//
// This is the single source of truth for backend environment
// variables. ConfigModule calls validateEnv before the NestJS
// application can serve traffic. Invalid configuration therefore
// fails during boot instead of failing later in production.
//
// Rules:
//   - Add a variable to backend/.env.example in the same change.
//   - Add it to docker/docker-compose.dev.yml when local wiring needs it.
//   - Add it to docs/ops/environment.md (or run gen-env-docs.sh).
//   - Secret values are never printed by validation errors.
//   - Business code must use AppConfigService, never process.env.
// ============================================================

/** Convert common environment boolean spellings to a real boolean. */
const booleanValue = (defaultValue: boolean) =>
  z.preprocess(
    (value: unknown) => {
      if (value === undefined || value === null || value === '') {
        return defaultValue;
      }

      if (typeof value === 'boolean') {
        return value;
      }

      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
        if (['false', '0', 'no', 'off'].includes(normalized)) return false;
      }

      return value;
    },
    z.boolean({
      invalid_type_error:
        'must be true or false (accepted values: true/false, 1/0, yes/no, on/off).',
    }),
  );

/** A bounded integer environment value. */
const integerValue = (minimum: number, maximum: number) =>
  z.coerce
    .number({ invalid_type_error: 'must be a number.' })
    .int('must be an integer.')
    .min(minimum, `must be at least ${minimum}.`)
    .max(maximum, `must be at most ${maximum}.`);

/**
 * PORT tolerates junk ambient values (e.g. a host shell exporting
 * PORT=0): anything missing or outside 1..65535 falls back to 3000
 * instead of failing boot. A valid PORT behaves identically.
 */
const coercePort = z.preprocess((value: unknown) => {
  if (value === undefined || value === null || value === '' || value === 0 || value === '0') {
    return 3000;
  }
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    return 3000;
  }
  return numeric >= 1 && numeric <= 65535 ? numeric : 3000;
}, z.number().int().min(1).max(65535));

const decimalValue = (minimum: number, maximum: number) =>
  z.coerce
    .number({ invalid_type_error: 'must be a number.' })
    .min(minimum, `must be at least ${minimum}.`)
    .max(maximum, `must be at most ${maximum}.`);

const httpUrl = (message = 'must be a valid URL.') => z.string().url(message);

/** A URL that may be omitted in local/mock mode. */
const optionalUrl = (message = 'must be empty or a valid URL.') =>
  z
    .string()
    .optional()
    .default('')
    .refine((value) => value === '' || httpUrl(message).safeParse(value).success, {
      message,
    });

/** An optional secret: empty means "not configured" in local/mock mode. */
const optionalSecret = z
  .string()
  .optional()
  .default('')
  .refine((value) => value === '' || value.length >= 64, {
    message: 'must be empty or at least 64 characters.',
  });

const optionalEmail = z
  .string()
  .optional()
  .default('')
  .refine((value) => value === '' || z.string().email().safeParse(value).success, {
    message: 'must be empty or a valid email address.',
  });

function pointsAtLocalhost(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

// ── Schema ──────────────────────────────────────────────────────────────────

export const envSchema = z
  .object({
    // ── Runtime ───────────────────────────────────────────────────────────
    NODE_ENV: z
      // Jest sets NODE_ENV=test for every worker; accept it so e2e suites
      // can boot the real AppModule. Treated as development everywhere else.
      .enum(['development', 'test', 'staging', 'production'], {
        errorMap: () => ({
          message: 'must be development, test, staging, or production.',
        }),
      })
      .default('development'),
    PORT: coercePort,
    HOST: z.string().min(1, 'must not be empty.').default('0.0.0.0'),
    TZ: z.string().min(1, 'must not be empty.').default('Africa/Addis_Ababa'),
    GIT_SHA: z.string().max(64).default('dev'),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error'], {
        errorMap: () => ({ message: 'must be trace, debug, info, warn, or error.' }),
      })
      .default('info'),
    API_PREFIX: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/i, 'must contain only letters, numbers, and hyphens.')
      .default('api'),
    API_VERSION: z
      .string()
      .regex(/^v\d+(?:\.\d+)?$/, 'must look like v1 or v1.2.')
      .default('v1'),

    // ── App ───────────────────────────────────────────────────────────────
    APP_NAME: z.string().min(1, 'must not be empty.').default('Yene Verify'),
    APP_URL: httpUrl('must be a valid absolute URL.').default('http://localhost:3000'),
    APP_TIMEZONE: z.string().min(1, 'must be an IANA timezone name.').default('Africa/Addis_Ababa'),
    APP_CURRENCY: z
      .string()
      .regex(/^[A-Z]{3}$/, 'must be a three-letter ISO 4217 code.')
      .default('ETB'),

    // ── Database ──────────────────────────────────────────────────────────
    DATABASE_URL: httpUrl('must be a valid PostgreSQL connection URL.').refine(
      (value) => /^postgres(?:ql)?:\/\//i.test(value),
      'must use postgres:// or postgresql://.',
    ),
    // Used by Prisma CLI (`migrate dev`) only; the running API never needs it.
    SHADOW_DATABASE_URL: z
      .string()
      .optional()
      .default('')
      .refine((value) => value === '' || /^postgres(?:ql)?:\/\//i.test(value), {
        message: 'must be empty or a PostgreSQL connection URL.',
      }),
    DATABASE_POOL_MIN: integerValue(1, 50).default(2),
    DATABASE_POOL_MAX: integerValue(1, 100).default(20),
    DATABASE_STATEMENT_TIMEOUT_MS: integerValue(1_000, 60_000).default(15_000),

    // ── Redis ─────────────────────────────────────────────────────────────
    REDIS_URL: z
      .string()
      .min(1, 'must not be empty.')
      .refine((value) => /^rediss?:\/\//i.test(value), 'must use redis:// or rediss://.'),
    REDIS_PREFIX: z.string().min(1, 'must not be empty.').default('yene:'),

    // ── JWT ───────────────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: z.string().min(64, 'must be at least 64 characters.'),
    JWT_ACCESS_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'must use a duration such as 15m, 1h, or 30d.')
      .default('15m'),
    JWT_REFRESH_SECRET: z.string().min(64, 'must be at least 64 characters.'),
    JWT_REFRESH_TTL: z
      .string()
      .regex(/^\d+[smhd]$/, 'must use a duration such as 15m, 1h, or 30d.')
      .default('30d'),
    JWT_ISSUER: z.string().min(1, 'must not be empty.').default('yene-verify'),
    JWT_AUDIENCE: z.string().min(1, 'must not be empty.').default('yene-verify-mobile'),
    // During a rotation the previous key remains valid for verification only.
    // Empty means there is no previous key.
    JWT_ACCESS_PREVIOUS_SECRET: optionalSecret,
    JWT_REFRESH_PREVIOUS_SECRET: optionalSecret,
    JWT_ACCESS_KID: z.string().min(1, 'must not be empty.').default('access-v1'),
    JWT_REFRESH_KID: z.string().min(1, 'must not be empty.').default('refresh-v1'),
    JWT_ACCESS_PREVIOUS_KID: z.string().default(''),
    JWT_REFRESH_PREVIOUS_KID: z.string().default(''),

    // ── OTP ───────────────────────────────────────────────────────────────
    OTP_LENGTH: integerValue(4, 8).default(6),
    OTP_TTL_SECONDS: integerValue(60, 900).default(300),
    OTP_MAX_ATTEMPTS: integerValue(3, 10).default(5),
    OTP_LOCKOUT_SECONDS: integerValue(60, 86_400).default(900),
    OTP_HASH_ROUNDS: integerValue(8, 14).default(10),

    // ── PIN & Biometric (Step 11) ─────────────────────────────────────────
    PIN_HASH_ROUNDS: integerValue(8, 14).default(10),
    PIN_MIN_LENGTH: integerValue(4, 6).default(4),
    PIN_MAX_LENGTH: integerValue(4, 6).default(6),
    PIN_MAX_ATTEMPTS: integerValue(3, 10).default(5),
    PIN_LOCKOUT_SECONDS: integerValue(60, 86_400).default(900),
    PIN_RATE_ATTEMPTS_PER_5MIN: integerValue(1, 50).default(10),
    STEP_UP_TOKEN_TTL_SECONDS: integerValue(30, 600).default(120),
    UNLOCK_RATE_PER_HOUR: integerValue(1, 200).default(60),

    // ── Sub-merchant invites & plan limits ───────────────────────────────
    INVITE_TOKEN_TTL_DAYS: integerValue(1, 90).default(7),
    INVITE_MAX_RESENDS: integerValue(1, 20).default(5),
    INVITE_SMS_SENDER_ID: z
      .string()
      .regex(/^[A-Za-z0-9]{1,11}$/, 'must contain 1–11 alphanumeric characters.')
      .default('YENEVRF'),
    FREE_PLAN_MAX_SUB_MERCHANTS: integerValue(0, 100).default(1),

    // ── Phone ─────────────────────────────────────────────────────────────
    PHONE_DEFAULT_COUNTRY: z
      .string()
      .regex(/^[A-Z]{2}$/, 'must be a two-letter country code.')
      .default('ET'),
    PHONE_DEFAULT_PREFIX: z
      .string()
      .regex(/^\+[1-9]\d{0,3}$/, 'must start with + and contain 1–4 digits.')
      .default('+251'),

    // ── AfroMessage ───────────────────────────────────────────────────────
    AFROMESSAGE_BASE_URL: httpUrl('must be a valid URL.').default(
      'https://api.afromessage.com/api',
    ),
    AFROMESSAGE_API_KEY: z.string().optional().default(''),
    AFROMESSAGE_SENDER_ID: z
      .string()
      .regex(/^[A-Za-z0-9]{1,11}$/, 'must contain 1–11 alphanumeric characters.')
      .default('YENEVRF'),
    AFROMESSAGE_TIMEOUT_MS: integerValue(1_000, 30_000).default(8_000),
    AFROMESSAGE_MOCK: booleanValue(true),

    // ── Google Vision ─────────────────────────────────────────────────────
    VISION_PROJECT_ID: z.string().optional().default(''),
    VISION_CREDENTIALS_JSON: z
      .string()
      .min(1, 'must be a path to a mounted credentials file.')
      .default('/run/secrets/gcp-vision.json'),
    VISION_TIMEOUT_MS: integerValue(1_000, 60_000).default(15_000),
    VISION_MAX_IMAGE_BYTES: integerValue(1_048_576, 20_971_520).default(5_242_880),
    VISION_MOCK: booleanValue(true),

    // ── Cloudflare R2 / local MinIO ───────────────────────────────────────
    R2_ACCOUNT_ID: z.string().optional().default(''),
    R2_ACCESS_KEY_ID: z.string().optional().default(''),
    R2_SECRET_ACCESS_KEY: z.string().optional().default(''),
    R2_BUCKET: z.string().min(1, 'must not be empty.').default('yene-verify-receipts'),
    R2_REGION: z.string().min(1, 'must not be empty.').default('auto'),
    R2_ENDPOINT: httpUrl('must be a valid S3-compatible endpoint URL.').default(
      'http://localhost:9000',
    ),
    R2_PUBLIC_BASE_URL: httpUrl('must be a valid public base URL.').default(
      'http://localhost:9000',
    ),
    R2_PRESIGN_TTL_SECONDS: integerValue(60, 3_600).default(300),
    R2_MAX_UPLOAD_MB: integerValue(1, 20).default(8),
    R2_USE_MINIO: booleanValue(true),
    MINIO_ENDPOINT: optionalUrl('must be a valid URL when provided.'),
    MINIO_ACCESS_KEY: z.string().optional().default(''),
    MINIO_SECRET_KEY: z.string().optional().default(''),

    // ── Storage driver selection ─────────────────────────────────────────
    STORAGE_DRIVER: z
      .enum(['local', 'r2'], {
        errorMap: () => ({ message: 'must be local or r2.' }),
      })
      .default('local'),
    STORAGE_LOCAL_PATH: z.string().min(1, 'must not be empty.').default('./.storage/receipts'),

    // ── OCR provider selection ───────────────────────────────────────────
    OCR_PROVIDER: z
      .enum(['mock', 'google-vision'], {
        errorMap: () => ({ message: 'must be mock or google-vision.' }),
      })
      .default('mock'),

    // ── Firebase Cloud Messaging ─────────────────────────────────────────
    FCM_PROJECT_ID: z.string().optional().default(''),
    FCM_CLIENT_EMAIL: optionalEmail,
    FCM_PRIVATE_KEY: z.string().optional().default(''),
    // Optional file-backed form. If empty, FCM_PRIVATE_KEY is used.
    FCM_PRIVATE_KEY_FILE: z
      .string()
      .optional()
      .default('')
      .refine(
        (value) =>
          value === '' ||
          value.startsWith('/') ||
          value.startsWith('./') ||
          value.startsWith('../'),
        { message: 'must be empty or a mounted-file path.' },
      ),
    FCM_MOCK: booleanValue(true),

    // ── SMTP (transactional email; optional for MVP) ─────────────────────
    SMTP_HOST: z.string().min(1, 'must not be empty.').default('localhost'),
    SMTP_PORT: integerValue(1, 65_535).default(1_025),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    SMTP_FROM: z
      .string()
      .min(1, 'must not be empty.')
      .default('Yene Verify <no-reply@yeneverify.com>'),

    // ── Sentry (backend only) ────────────────────────────────────────────
    SENTRY_DSN: z
      .string()
      .optional()
      .default('')
      .refine(
        (value) => value === '' || /^https:\/\//i.test(value),
        'must be empty or a valid HTTPS DSN.',
      ),
    SENTRY_ENVIRONMENT: z
      .enum(['development', 'staging', 'production'], {
        errorMap: () => ({ message: 'must be development, staging, or production.' }),
      })
      .default('development'),
    SENTRY_TRACES_SAMPLE_RATE: decimalValue(0, 1).default(0.1),

    // ── Rate limiting ────────────────────────────────────────────────────
    THROTTLE_TTL: integerValue(1, 3_600).default(60),
    THROTTLE_LIMIT: integerValue(1, 1_000_000).default(100),
    THROTTLE_OTP_TTL: integerValue(1, 3_600).default(60),
    THROTTLE_OTP_LIMIT: integerValue(1, 100).default(5),

    // ── CORS ─────────────────────────────────────────────────────────────
    CORS_ORIGINS: z
      .string()
      .min(1, 'must contain at least one origin.')
      .default('http://localhost:3000'),

    // ── Feature flags ────────────────────────────────────────────────────
    FF_MANUAL_REVIEW_ENABLED: booleanValue(true),
    FF_BILLING_VERIFICATION_ENABLED: booleanValue(true),
    FF_ML_INSIGHTS_ENABLED: booleanValue(false),

    // ── Bank adapters ────────────────────────────────────────────────────
    BANK_ADAPTER_TIMEOUT_MS: integerValue(1_000, 60_000).default(12_000),
    BANK_ADAPTER_RETRIES: integerValue(0, 5).default(2),
    BANK_ADAPTER_HEADLESS_POOL_SIZE: integerValue(1, 10).default(2),
    BANK_SCRAPE_USER_AGENT: z
      .string()
      .min(1, 'must not be empty.')
      .default('YeneVerify/1.0 (+https://yeneverify.com/bot)'),
    BANK_ADAPTER_MOCK: booleanValue(true),
    TELEBIRR_HEADLESS_ENABLED: booleanValue(true),
    BROWSER_POOL_SIZE: integerValue(1, 10).default(2),
    TELEBIRR_MAX_CONCURRENT: integerValue(1, 10).default(4),
    // Dashen's receipt domain has changed before; CSV of endpoints tried
    // in order so a domain change is an env update, not a code deploy.
    DASHEN_ENDPOINTS: z
      .string()
      .max(1_000)
      .refine(
        (value) =>
          value.trim() === '' ||
          value
            .split(',')
            .map((part) => part.trim())
            .every((url) => httpUrl().safeParse(url).success),
        'must be empty or comma-separated valid URLs.',
      )
      .default(''),
    // Abyssinia's receipt lookup needs reference + account suffix; endpoints
    // stay env-driven for the same reason as DASHEN_ENDPOINTS.
    ABYSSINIA_ENDPOINTS: z
      .string()
      .max(1_000)
      .refine(
        (value) =>
          value.trim() === '' ||
          value
            .split(',')
            .map((part) => part.trim())
            .every((url) => httpUrl().safeParse(url).success),
        'must be empty or comma-separated valid URLs.',
      )
      .default(''),
    // Client-signal flag, not consumed by any adapter: the API exposes it so
    // the mobile app knows Abyssinia needs extra input (13E surfaces it).
    BANK_SUPPLEMENTARY_REQUIRED_ABYSSINIA: booleanValue(true),
    // PDF banks (13D.6+7): M-Pesa returns a base64-wrapped JSON PDF; Zemen
    // streams a PDF directly. CSV lists stay env-driven (13D.4 rule).
    MPESA_ENDPOINTS: z
      .string()
      .max(1_000)
      .refine(
        (value) =>
          value.trim() === '' ||
          value
            .split(',')
            .map((part) => part.trim())
            .every((url) => httpUrl().safeParse(url).success),
        'must be empty or comma-separated valid URLs.',
      )
      .default(''),
    ZEMEN_ENDPOINTS: z
      .string()
      .max(1_000)
      .refine(
        (value) =>
          value.trim() === '' ||
          value
            .split(',')
            .map((part) => part.trim())
            .every((url) => httpUrl().safeParse(url).success),
        'must be empty or comma-separated valid URLs.',
      )
      .default(''),

    // ── Queue ────────────────────────────────────────────────────────────
    QUEUE_VERIFICATION_CONCURRENCY: integerValue(1, 20).default(4),
    QUEUE_NOTIFICATION_CONCURRENCY: integerValue(1, 20).default(8),
    QUEUE_EXPORT_CONCURRENCY: integerValue(1, 10).default(2),
    QUEUE_JOB_ATTEMPTS: integerValue(1, 10).default(3),
    QUEUE_BACKOFF_MS: integerValue(100, 30_000).default(2_000),

    // ── Admin bootstrap (development only) ───────────────────────────────
    ADMIN_BOOTSTRAP_PHONE: z
      .string()
      .default('+251900000000')
      .refine(
        (value) => /^\+251\d{9}$/.test(value),
        'must be an Ethiopian number in +251XXXXXXXXX format.',
      ),
    ADMIN_BOOTSTRAP_NAME: z.string().min(1, 'must not be empty.').default('Fuad'),
  })
  .superRefine((env, ctx) => {
    if (env.DATABASE_POOL_MAX < env.DATABASE_POOL_MIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_POOL_MAX'],
        message: 'must be greater than or equal to DATABASE_POOL_MIN.',
      });
    }

    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message: 'must be different from JWT_ACCESS_SECRET.',
      });
    }

    if (
      env.JWT_ACCESS_PREVIOUS_SECRET !== '' &&
      (env.JWT_ACCESS_PREVIOUS_SECRET === env.JWT_ACCESS_SECRET ||
        env.JWT_ACCESS_PREVIOUS_SECRET === env.JWT_REFRESH_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_ACCESS_PREVIOUS_SECRET'],
        message: 'must differ from both current signing secrets.',
      });
    }

    if (
      env.JWT_REFRESH_PREVIOUS_SECRET !== '' &&
      (env.JWT_REFRESH_PREVIOUS_SECRET === env.JWT_ACCESS_SECRET ||
        env.JWT_REFRESH_PREVIOUS_SECRET === env.JWT_REFRESH_SECRET)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_PREVIOUS_SECRET'],
        message: 'must differ from both current signing secrets.',
      });
    }

    for (const origin of env.CORS_ORIGINS.split(',').map((value) => value.trim())) {
      if (origin !== '*' && !/^https?:\/\//i.test(origin)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'must contain comma-separated http(s) origins or exactly *.',
        });
      }
    }

    // 'test' behaves like development: local hosts and placeholder secrets are
    // expected there, so e2e suites can boot with the checked-in .env.
    if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
      const origins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
      const localOrigin = origins.some((origin) => pointsAtLocalhost(origin));
      if (localOrigin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'must not contain localhost origins outside development.',
        });
      }
      if (env.NODE_ENV === 'production' && origins.includes('*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'must not use a wildcard origin in production.',
        });
      }
    }

    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') return;

    const requiredInHostedEnvironments: Array<keyof typeof env> = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'AFROMESSAGE_API_KEY',
      'VISION_PROJECT_ID',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'FCM_PROJECT_ID',
      'FCM_CLIENT_EMAIL',
      'SENTRY_DSN',
    ];

    for (const key of requiredInHostedEnvironments) {
      if (String(env[key]).trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: 'is required outside development.',
        });
      }
    }

    if (env.FCM_PRIVATE_KEY === '' && env.FCM_PRIVATE_KEY_FILE === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FCM_PRIVATE_KEY'],
        message: 'or FCM_PRIVATE_KEY_FILE is required outside development.',
      });
    }

    if (!/^https:\/\//i.test(env.APP_URL) || pointsAtLocalhost(env.APP_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_URL'],
        message: 'must be an HTTPS public URL outside development.',
      });
    }

    if (pointsAtLocalhost(env.DATABASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'must not point at localhost outside development.',
      });
    }
    if (pointsAtLocalhost(env.REDIS_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message: 'must not point at localhost outside development.',
      });
    }
    // This block only runs outside development/test, so the local disk
    // driver is never acceptable in a hosted environment.
    if (env.STORAGE_DRIVER !== 'r2') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['STORAGE_DRIVER'],
        message: 'must be r2 outside development.',
      });
    }
    // Same rule as the storage driver: the deterministic mock OCR engine is
    // never acceptable in a hosted environment.
    if (env.OCR_PROVIDER !== 'google-vision') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OCR_PROVIDER'],
        message: 'must be google-vision outside development.',
      });
    }
    if (
      env.R2_USE_MINIO ||
      !env.R2_ENDPOINT ||
      !/^https:\/\//i.test(env.R2_ENDPOINT) ||
      pointsAtLocalhost(env.R2_ENDPOINT)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['R2_ENDPOINT'],
        message: 'must be an HTTPS R2 endpoint outside development.',
      });
    }
    if (!/^https:\/\//i.test(env.R2_PUBLIC_BASE_URL) || pointsAtLocalhost(env.R2_PUBLIC_BASE_URL)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['R2_PUBLIC_BASE_URL'],
        message: 'must be an HTTPS URL outside development.',
      });
    }

    if (env.AFROMESSAGE_MOCK) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AFROMESSAGE_MOCK'],
        message: 'must be false outside development.',
      });
    }
    if (env.VISION_MOCK) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['VISION_MOCK'],
        message: 'must be false outside development.',
      });
    }
    if (env.FCM_MOCK) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FCM_MOCK'],
        message: 'must be false outside development.',
      });
    }
    if (env.BANK_ADAPTER_MOCK) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['BANK_ADAPTER_MOCK'],
        message: 'must be false outside development.',
      });
    }
    if (env.R2_USE_MINIO) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['R2_USE_MINIO'],
        message: 'must be false outside development.',
      });
    }

    if (env.SENTRY_ENVIRONMENT !== env.NODE_ENV) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['SENTRY_ENVIRONMENT'],
        message: 'must match NODE_ENV outside development.',
      });
    }
  });

/** Fully typed environment values after Zod validation. */
export type Env = z.infer<typeof envSchema>;

/**
 * Secret-looking keys are checked separately in hosted environments.
 * This is intentionally based on key names, not values, so the validator
 * never needs to print a value to explain a failure.
 */
export const SECRET_ENV_KEYS: readonly (keyof Env)[] = [
  'DATABASE_URL',
  'SHADOW_DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_PREVIOUS_SECRET',
  'JWT_REFRESH_PREVIOUS_SECRET',
  'AFROMESSAGE_API_KEY',
  'VISION_PROJECT_ID',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
  'R2_PUBLIC_BASE_URL',
  'FCM_PROJECT_ID',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'FCM_CLIENT_EMAIL',
  'FCM_PRIVATE_KEY',
  'FCM_PRIVATE_KEY_FILE',
  'SMTP_USER',
  'SMTP_PASS',
  'SENTRY_DSN',
];

/** Obvious placeholder markers. Values are never included in an error. */
export const PLACEHOLDER_MARKERS: readonly string[] = [
  'change_me',
  'replace_me',
  'placeholder',
  'todo',
  'xxx',
  'yene_dev_password',
  'yeneverify_dev',
  'minio_dev',
  'minioadmin',
];

export function looksLikePlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker));
}

/** A safe, value-free representation of validation issues. */
export function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map(
      (issue) =>
        `  ✗ ${issue.path.length > 0 ? issue.path.join('.') : 'environment'}: ${issue.message}`,
    )
    .join('\n');
}

function printConfigurationError(message: string): never {
  new Logger('EnvSchema').error(
    '\n╔══════════════════════════════════════════════════════╗\n' +
      '║       YENE VERIFY — CONFIGURATION ERROR              ║\n' +
      '╚══════════════════════════════════════════════════════╝\n' +
      `${message}\n\n` +
      'Only variable names are shown. Values are never printed.\n' +
      'See backend/.env.example and docs/ops/environment.md.\n',
  );
  process.exit(1);
}

/**
 * Validate process environment values without exposing their contents.
 * This is the callback passed to NestJS ConfigModule.forRoot().
 */
export function validateEnv(rawEnv: Record<string, unknown>): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    printConfigurationError(
      `The following variables are missing or invalid:\n\n${formatEnvIssues(result.error)}`,
    );
  }

  const env = result.data;

  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') {
    const placeholderKeys = SECRET_ENV_KEYS.filter((key) => {
      const value = env[key];
      return typeof value === 'string' && looksLikePlaceholder(value);
    });

    if (placeholderKeys.length > 0) {
      printConfigurationError(
        'The following variables still contain placeholder values:\n\n' +
          placeholderKeys.map((key) => `  ✗ ${key}`).join('\n'),
      );
    }
  }

  return env;
}
