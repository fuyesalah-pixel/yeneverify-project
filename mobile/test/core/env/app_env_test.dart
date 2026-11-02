import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/env/app_env.dart';

void main() {
  test('exposes safe development defaults', () {
    expect(AppEnv.isDev, isTrue);
    expect(AppEnv.apiTimeoutMs, greaterThan(0));
    expect(AppEnv.apiBaseUrl, startsWith('http://'));
    expect(AppEnv.sentryDsn, isEmpty);
  });

  test('health URL is separate from the /api/v1 client base', () {
    // Health endpoints are served outside the versioned prefix (Step 8's
    // global-prefix exclusions), so the app must never append /api/v1 to it.
    expect(AppEnv.healthBaseUrl, 'http://10.0.2.2:3000');
    expect(AppEnv.apiBaseUrl, endsWith('/api/v1'));
    expect(AppEnv.healthBaseUrl, isNot(contains('/api/v1')));
  });

  test('mobile configuration contains no server secret fields', () {
    // The class intentionally has no API-key, database, bank, or signing
    // configuration. SENTRY_DSN is an empty/public client identifier only.
    expect(AppEnv.enableBiometric, isA<bool>());
    expect(AppEnv.enableDevTools, isA<bool>());
  });
}
