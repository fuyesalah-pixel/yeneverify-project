/// Build-time application configuration.
///
/// Flutter applications do not read backend environment files at runtime.
/// CI/release builds inject these values with `--dart-define`. Values here
/// are public client configuration only: the mobile app must never contain an
/// API key, signing key, database URL, bank credential, or other secret.
library;

enum AppEnvironment {
  development,
  staging,
  production;

  static AppEnvironment fromValue(String value) {
    switch (value) {
      case 'staging':
        return AppEnvironment.staging;
      case 'production':
        return AppEnvironment.production;
      case 'development':
      default:
        return AppEnvironment.development;
    }
  }
}

/// Typed access to the values supplied at build time.
class AppEnv {
  const AppEnv._();

  static const String env = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );
  /// API root for the versioned backend (`/api/v1`). The app only ever
  /// calls endpoints beneath this path.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );

  /// Origin used for ops/monitoring probes (`/health`, `/health/ready`).
  /// Health lives OUTSIDE the version prefix, so it is a separate URL and is
  /// not consumed by the app itself.
  static const String healthBaseUrl = String.fromEnvironment(
    'HEALTH_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
  static const int apiTimeoutMs = int.fromEnvironment(
    'API_TIMEOUT_MS',
    defaultValue: 20000,
  );

  /// Sentry's DSN is a public client identifier, not a server secret.
  /// It is empty in development and is never used to authenticate API calls.
  static const String sentryDsn = String.fromEnvironment('SENTRY_DSN');
  static const bool enableAnalyticsLogs = bool.fromEnvironment(
    'ENABLE_ANALYTICS_LOGS',
    defaultValue: true,
  );
  static const bool enableBiometric = bool.fromEnvironment(
    'ENABLE_BIOMETRIC',
    defaultValue: true,
  );
  static const bool enableDevTools = bool.fromEnvironment(
    'ENABLE_DEV_TOOLS',
    defaultValue: true,
  );
  static const String buildFlavor = String.fromEnvironment(
    'BUILD_FLAVOR',
    defaultValue: 'dev',
  );
  static const int pinMinLength = int.fromEnvironment(
    'PIN_MIN_LENGTH',
    defaultValue: 4,
  );
  static const int pinMaxLength = int.fromEnvironment(
    'PIN_MAX_LENGTH',
    defaultValue: 6,
  );
  static const int stepUpTokenTtlSeconds = int.fromEnvironment(
    'STEP_UP_TOKEN_TTL_SECONDS',
    defaultValue: 120,
  );

  static AppEnvironment get environment => AppEnvironment.fromValue(env);

  static bool get isDev => environment == AppEnvironment.development;
  static bool get isStaging => environment == AppEnvironment.staging;
  static bool get isProd => environment == AppEnvironment.production;

  /// Development builds can use verbose logs and local tools. Staging and
  /// production builds should explicitly disable those capabilities.
  static bool get telemetryEnabled => !isDev && sentryDsn.isNotEmpty;

  /// Validate build-time configuration before the first frame.
  /// This method never prints a value because the mobile app has no secrets.
  static void validate() {
    if (apiTimeoutMs <= 0) {
      throw StateError('API_TIMEOUT_MS must be positive.');
    }
    if (!apiBaseUrl.startsWith('http://') &&
        !apiBaseUrl.startsWith('https://')) {
      throw StateError('API_BASE_URL must be an HTTP(S) URL.');
    }
    if (isProd && !apiBaseUrl.startsWith('https://')) {
      throw StateError('Production API_BASE_URL must use HTTPS.');
    }
    if (!const ['development', 'staging', 'production'].contains(env)) {
      throw StateError('APP_ENV must be development, staging, or production.');
    }
    if (!const ['dev', 'staging', 'prod'].contains(buildFlavor)) {
      throw StateError('BUILD_FLAVOR must be dev, staging, or prod.');
    }
    if (isProd && buildFlavor != 'prod') {
      throw StateError('Production builds require BUILD_FLAVOR=prod.');
    }
    if (isStaging && buildFlavor != 'staging') {
      throw StateError('Staging builds require BUILD_FLAVOR=staging.');
    }
    if (isDev && sentryDsn.isNotEmpty) {
      throw StateError('SENTRY_DSN must be empty in development builds.');
    }
    if (!isDev && enableDevTools) {
      throw StateError('ENABLE_DEV_TOOLS must be false outside development.');
    }
  }
}
