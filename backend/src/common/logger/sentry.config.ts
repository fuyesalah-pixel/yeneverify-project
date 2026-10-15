import { createSentryBeforeSend, redactSensitiveData, type SentryEvent } from './redact';

/**
 * Sentry integration options.
 *
 * The actual Sentry SDK is initialized by the application module. Keeping the
 * callback here makes scrubbing testable and ensures telemetry follows the
 * same typed configuration boundary as the rest of the backend.
 */
export interface SentryInitOptions {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  sendDefaultPii: false;
  beforeSend: (event: SentryEvent) => SentryEvent;
  beforeBreadcrumb: (breadcrumb: Record<string, unknown>) => Record<string, unknown> | null;
}

function configuredSecretValues(source: {
  database: { url: string; shadowUrl: string };
  redis: { url: string };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    previousAccessSecret: string;
    previousRefreshSecret: string;
  };
  afroMessage: { apiKey: string };
  r2: { accountId: string; accessKeyId: string; secretAccessKey: string; minioSecretKey: string };
  smtp: { pass: string };
  sentry: { dsn: string };
}): string[] {
  return [
    source.database.url,
    source.database.shadowUrl,
    source.redis.url,
    source.jwt.accessSecret,
    source.jwt.refreshSecret,
    source.jwt.previousAccessSecret,
    source.jwt.previousRefreshSecret,
    source.afroMessage.apiKey,
    source.r2.accountId,
    source.r2.accessKeyId,
    source.r2.secretAccessKey,
    source.r2.minioSecretKey,
    source.smtp.pass,
    source.sentry.dsn,
  ].filter((value) => value.length > 0);
}

/** Build a scrubber that also removes configured values under generic keys. */
export function buildSentryBeforeSend(secretValues: readonly string[] = []) {
  return (event: SentryEvent): SentryEvent => {
    try {
      return createSentryBeforeSend(secretValues)(event);
    } catch {
      // Telemetry must never break the request path. Return a minimal safe
      // event if a third-party object contains an unusual value.
      return {
        event_id: typeof event.event_id === 'string' ? event.event_id : undefined,
        message: '[Event scrubbed after redaction error]',
      };
    }
  };
}

export function buildSentryOptions(
  source: Parameters<typeof configuredSecretValues>[0] & {
    sentry: { environment: string; tracesSampleRate: number };
  },
  release?: string,
): SentryInitOptions {
  const beforeSend = buildSentryBeforeSend(configuredSecretValues(source));
  const beforeBreadcrumb = (breadcrumb: Record<string, unknown>) => {
    const scrubbed = redactSensitiveData(breadcrumb, configuredSecretValues(source));
    // A breadcrumb with no useful data is not worth sending.
    return Object.keys(scrubbed).length > 0 ? scrubbed : null;
  };

  return {
    dsn: source.sentry.dsn,
    environment: source.sentry.environment,
    tracesSampleRate: source.sentry.tracesSampleRate,
    sendDefaultPii: false,
    beforeSend,
    beforeBreadcrumb,
    ...(release ? { release } : {}),
  } as SentryInitOptions;
}

/** Default callback for environments that do not inject provider values. */
export const sentryBeforeSend = buildSentryBeforeSend();
