// Compatibility export: Sentry configuration lives with the logger so the
// redaction implementation has one source of truth.
export {
  buildSentryBeforeSend,
  buildSentryOptions,
  sentryBeforeSend,
} from '../common/logger/sentry.config';
export type { SentryInitOptions } from '../common/logger/sentry.config';
export type { SentryEvent } from '../common/logger/redact';
