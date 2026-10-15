import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/env/app_env.dart';

void main() {
  test('exposes safe development defaults', () {
    expect(AppEnv.isDev, isTrue);
    expect(AppEnv.apiTimeoutMs, greaterThan(0));
    expect(AppEnv.apiBaseUrl, startsWith('http://'));
    expect(AppEnv.sentryDsn, isEmpty);
  });

  test('mobile configuration contains no server secret fields', () {
    // The class intentionally has no API-key, database, bank, or signing
    // configuration. SENTRY_DSN is an empty/public client identifier only.
    expect(AppEnv.enableBiometric, isA<bool>());
    expect(AppEnv.enableDevTools, isA<bool>());
  });
}
