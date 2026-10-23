import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';
import { EnvironmentSecretProvider, SecretLoader } from './secret-loader.service';

// ============================================================
// Yene Verify — AppConfigService
//
// Typed wrapper around NestJS ConfigService. Business code uses
// `config.get.database.url` (or the equivalent direct typed getter)
// and never reads process.env or calls raw ConfigService.get('STRING').
// ============================================================

@Injectable()
export class AppConfigService {
  private readonly secretLoaderInstance: SecretLoader;

  constructor(
    private readonly raw: ConfigService<Env, true>,
    @Optional() secretLoader?: SecretLoader,
  ) {
    this.secretLoaderInstance =
      secretLoader ?? new SecretLoader(new EnvironmentSecretProvider(raw));
  }

  private value<K extends keyof Env>(key: K): Env[K] {
    const value = this.raw.get(key);
    if (value === undefined) {
      // Key names are safe to report; values are intentionally omitted.
      throw new Error(`Configuration key ${String(key)} is unavailable.`);
    }
    return value as Env[K];
  }

  // ── Namespace view (preferred access style) ──────────────────────────────
  /** Example: config.get.database.url, config.get.jwt.accessSecret. */
  get get() {
    return {
      runtime: this.runtime,
      app: this.app,
      database: this.database,
      redis: this.redis,
      jwt: this.jwt,
      otp: this.otp,
      phone: this.phone,
      afroMessage: this.afroMessage,
      vision: this.vision,
      r2: this.r2,
      storage: this.storage,
      fcm: this.fcm,
      smtp: this.smtp,
      sentry: this.sentry,
      throttle: this.throttle,
      cors: this.cors,
      features: this.features,
      bankAdapters: this.bankAdapters,
      queue: this.queue,
      adminBootstrap: this.adminBootstrap,
    } as const;
  }

  /** Injectable file-backed secret provider for adapters only. */
  get secrets(): SecretLoader {
    return this.secretLoaderInstance;
  }

  /** Git commit SHA for build/version stamping. Defaults to 'dev'. */
  get gitSha(): string {
    return this.runtime.gitSha;
  }

  // ── Runtime ─────────────────────────────────────────────────────────────
  get runtime() {
    return {
      nodeEnv: this.value('NODE_ENV'),
      port: this.value('PORT'),
      host: this.value('HOST'),
      tz: this.value('TZ'),
      gitSha: this.value('GIT_SHA'),
      logLevel: this.value('LOG_LEVEL'),
      apiPrefix: this.value('API_PREFIX'),
      apiVersion: this.value('API_VERSION'),
      isProd: this.value('NODE_ENV') === 'production',
      isStaging: this.value('NODE_ENV') === 'staging',
      isDev: this.value('NODE_ENV') === 'development' || this.value('NODE_ENV') === 'test',
    } as const;
  }

  // ── App ─────────────────────────────────────────────────────────────────
  get app() {
    return {
      name: this.value('APP_NAME'),
      url: this.value('APP_URL'),
      timezone: this.value('APP_TIMEZONE'),
      currency: this.value('APP_CURRENCY'),
    } as const;
  }

  // ── Database ────────────────────────────────────────────────────────────
  get database() {
    return {
      url: this.value('DATABASE_URL'),
      shadowUrl: this.value('SHADOW_DATABASE_URL'),
      poolMin: this.value('DATABASE_POOL_MIN'),
      poolMax: this.value('DATABASE_POOL_MAX'),
      statementTimeoutMs: this.value('DATABASE_STATEMENT_TIMEOUT_MS'),
    } as const;
  }

  // ── Redis ───────────────────────────────────────────────────────────────
  get redis() {
    return {
      url: this.value('REDIS_URL'),
      prefix: this.value('REDIS_PREFIX'),
    } as const;
  }

  // ── JWT ─────────────────────────────────────────────────────────────────
  get jwt() {
    return {
      accessSecret: this.value('JWT_ACCESS_SECRET'),
      accessTtl: this.value('JWT_ACCESS_TTL'),
      refreshSecret: this.value('JWT_REFRESH_SECRET'),
      refreshTtl: this.value('JWT_REFRESH_TTL'),
      issuer: this.value('JWT_ISSUER'),
      audience: this.value('JWT_AUDIENCE'),
      previousAccessSecret: this.value('JWT_ACCESS_PREVIOUS_SECRET'),
      previousRefreshSecret: this.value('JWT_REFRESH_PREVIOUS_SECRET'),
      accessKid: this.value('JWT_ACCESS_KID'),
      refreshKid: this.value('JWT_REFRESH_KID'),
      previousAccessKid: this.value('JWT_ACCESS_PREVIOUS_KID'),
      previousRefreshKid: this.value('JWT_REFRESH_PREVIOUS_KID'),
    } as const;
  }

  // ── OTP ─────────────────────────────────────────────────────────────────
  get otp() {
    return {
      length: this.value('OTP_LENGTH'),
      ttlSeconds: this.value('OTP_TTL_SECONDS'),
      maxAttempts: this.value('OTP_MAX_ATTEMPTS'),
      lockoutSeconds: this.value('OTP_LOCKOUT_SECONDS'),
      hashRounds: this.value('OTP_HASH_ROUNDS'),
    } as const;
  }

  // ── Phone ───────────────────────────────────────────────────────────────
  get phone() {
    return {
      defaultCountry: this.value('PHONE_DEFAULT_COUNTRY'),
      defaultPrefix: this.value('PHONE_DEFAULT_PREFIX'),
    } as const;
  }

  // ── AfroMessage ─────────────────────────────────────────────────────────
  get afroMessage() {
    return {
      baseUrl: this.value('AFROMESSAGE_BASE_URL'),
      apiKey: this.value('AFROMESSAGE_API_KEY'),
      senderId: this.value('AFROMESSAGE_SENDER_ID'),
      timeoutMs: this.value('AFROMESSAGE_TIMEOUT_MS'),
      mock: this.value('AFROMESSAGE_MOCK'),
    } as const;
  }

  // ── Google Vision ───────────────────────────────────────────────────────
  get vision() {
    return {
      projectId: this.value('VISION_PROJECT_ID'),
      credentialsPath: this.value('VISION_CREDENTIALS_JSON'),
      // Kept as a compatibility alias; the value is a path, never JSON content.
      credentialsJson: this.value('VISION_CREDENTIALS_JSON'),
      timeoutMs: this.value('VISION_TIMEOUT_MS'),
      maxImageBytes: this.value('VISION_MAX_IMAGE_BYTES'),
      mock: this.value('VISION_MOCK'),
    } as const;
  }

  // ── Cloudflare R2 / MinIO ───────────────────────────────────────────────
  get r2() {
    return {
      accountId: this.value('R2_ACCOUNT_ID'),
      accessKeyId: this.value('R2_ACCESS_KEY_ID'),
      secretAccessKey: this.value('R2_SECRET_ACCESS_KEY'),
      bucket: this.value('R2_BUCKET'),
      region: this.value('R2_REGION'),
      endpoint: this.value('R2_ENDPOINT'),
      publicBaseUrl: this.value('R2_PUBLIC_BASE_URL'),
      presignTtlSecs: this.value('R2_PRESIGN_TTL_SECONDS'),
      maxUploadMb: this.value('R2_MAX_UPLOAD_MB'),
      useMinio: this.value('R2_USE_MINIO'),
      minioEndpoint: this.value('MINIO_ENDPOINT'),
      minioAccessKey: this.value('MINIO_ACCESS_KEY'),
      minioSecretKey: this.value('MINIO_SECRET_KEY'),
    } as const;
  }

  // ── Storage driver selection ─────────────────────────────────────────────
  get storage() {
    return {
      driver: this.value('STORAGE_DRIVER'),
      localPath: this.value('STORAGE_LOCAL_PATH'),
    } as const;
  }

  // ── Firebase Cloud Messaging ────────────────────────────────────────────
  get fcm() {
    return {
      projectId: this.value('FCM_PROJECT_ID'),
      clientEmail: this.value('FCM_CLIENT_EMAIL'),
      // The loader expands escaped newlines only at the adapter boundary.
      privateKey: this.secretLoaderInstance.fcmPrivateKey(),
      privateKeyFile: this.value('FCM_PRIVATE_KEY_FILE'),
      mock: this.value('FCM_MOCK'),
    } as const;
  }

  // ── SMTP ────────────────────────────────────────────────────────────────
  get smtp() {
    return {
      host: this.value('SMTP_HOST'),
      port: this.value('SMTP_PORT'),
      user: this.value('SMTP_USER'),
      pass: this.value('SMTP_PASS'),
      from: this.value('SMTP_FROM'),
    } as const;
  }

  // ── Sentry ──────────────────────────────────────────────────────────────
  get sentry() {
    return {
      dsn: this.value('SENTRY_DSN'),
      environment: this.value('SENTRY_ENVIRONMENT'),
      tracesSampleRate: this.value('SENTRY_TRACES_SAMPLE_RATE'),
    } as const;
  }

  // ── Rate limiting ───────────────────────────────────────────────────────
  get throttle() {
    return {
      ttl: this.value('THROTTLE_TTL'),
      limit: this.value('THROTTLE_LIMIT'),
      otpTtl: this.value('THROTTLE_OTP_TTL'),
      otpLimit: this.value('THROTTLE_OTP_LIMIT'),
    } as const;
  }

  // ── CORS ────────────────────────────────────────────────────────────────
  get cors() {
    return {
      origins: this.value('CORS_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    } as const;
  }

  // ── Feature flags ───────────────────────────────────────────────────────
  get features() {
    return {
      manualReviewEnabled: this.value('FF_MANUAL_REVIEW_ENABLED'),
      billingVerificationEnabled: this.value('FF_BILLING_VERIFICATION_ENABLED'),
      mlInsightsEnabled: this.value('FF_ML_INSIGHTS_ENABLED'),
    } as const;
  }

  // ── Bank adapters ───────────────────────────────────────────────────────
  get bankAdapters() {
    return {
      timeoutMs: this.value('BANK_ADAPTER_TIMEOUT_MS'),
      retries: this.value('BANK_ADAPTER_RETRIES'),
      headlessPoolSize: this.value('BANK_ADAPTER_HEADLESS_POOL_SIZE'),
      userAgent: this.value('BANK_SCRAPE_USER_AGENT'),
      mock: this.value('BANK_ADAPTER_MOCK'),
    } as const;
  }

  // ── Queue ───────────────────────────────────────────────────────────────
  get queue() {
    return {
      verificationConcurrency: this.value('QUEUE_VERIFICATION_CONCURRENCY'),
      notificationConcurrency: this.value('QUEUE_NOTIFICATION_CONCURRENCY'),
      exportConcurrency: this.value('QUEUE_EXPORT_CONCURRENCY'),
      jobAttempts: this.value('QUEUE_JOB_ATTEMPTS'),
      backoffMs: this.value('QUEUE_BACKOFF_MS'),
    } as const;
  }

  // ── Sub-merchant invites & plan limits ──────────────────────────────
  get invites() {
    return {
      tokenTtlDays: this.value('INVITE_TOKEN_TTL_DAYS'),
      maxResends: this.value('INVITE_MAX_RESENDS'),
      smsSenderId: this.value('INVITE_SMS_SENDER_ID'),
      freePlanMaxSubMerchants: this.value('FREE_PLAN_MAX_SUB_MERCHANTS'),
    } as const;
  }

  // ── Step-up tokens ───────────────────────────────────────────────────────
  get stepUp() {
    return {
      tokenTtlSeconds: this.value('STEP_UP_TOKEN_TTL_SECONDS'),
    } as const;
  }

  // ── Admin bootstrap ─────────────────────────────────────────────────────
  get adminBootstrap() {
    return {
      phone: this.value('ADMIN_BOOTSTRAP_PHONE'),
      name: this.value('ADMIN_BOOTSTRAP_NAME'),
    } as const;
  }
}
