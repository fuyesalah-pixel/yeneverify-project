// Startup-state timeout + fallback coverage (splash fix).
//
// The real _checkStartupState path is exercised end-to-end through
// AuthNotifier.build() with a stubbed AuthRepository:
//  - a hanging secure-storage read must resolve to `unauthenticated`
//    via the 5s timeout (verified with the tester's fake clock, so the
//    test itself doesn't wait 5 wall-clock seconds),
//  - a throwing repository must land on `unauthenticated` via the catch,
//  - a stored session + PIN must land on `locked`,
//  - no stored session must land on `unauthenticated`.
import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/token_store.dart';
import 'package:yene_verify/core/storage/secure_storage.dart';
import 'package:yene_verify/core/storage/session_store.dart';
import 'package:yene_verify/features/auth/data/auth_api.dart';
import 'package:yene_verify/features/auth/data/auth_repository.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';

class _StubRepo extends AuthRepository {
  _StubRepo()
      : super(
          sessionStore: SessionStore(SecureStorage(), InMemoryTokenStore()),
          api: AuthApi(Dio()),
        );

  Future<String> Function() getOrCreateFingerprintImpl = () async => 'fp-1';
  Future<bool> Function() hasStoredSessionImpl = () async => false;
  Future<bool> Function() hasPinImpl = () async => false;

  @override
  Future<String> getOrCreateFingerprint() => getOrCreateFingerprintImpl();

  @override
  Future<bool> hasStoredSession() => hasStoredSessionImpl();

  @override
  Future<bool> biometricEnabled() async => false;

  @override
  Future<bool> hasPin() => hasPinImpl();

  @override
  Future<String?> readStoredPhone() async => '+251911000000';

  @override
  Future<String?> readStoredUserId() async => 'user-1';
}

void main() {
  late _StubRepo repo;
  late ProviderContainer container;

  setUp(() {
    repo = _StubRepo();
    container = ProviderContainer(overrides: [
      authRepositoryProvider.overrideWith((ref) => repo),
    ]);
    addTearDown(container.dispose);
  });

  /// Kicks off AuthNotifier.build (the real startup path) and returns the
  /// AuthState once the build future resolves. Fake timers are driven with
  /// [tester], so the built-in 5s timeout never costs wall-clock seconds.
  /// Bails out after ~10 fake seconds so a future regression fails instead
  /// of hanging the runner.
  Future<AuthState> resolveStartup(
    WidgetTester tester, {
    Duration step = const Duration(milliseconds: 100),
    int maxTicks = 100,
  }) async {
    final future = container.read(authProvider.future);
    final done = Completer<AuthState>();
    future.then(done.complete, onError: done.completeError);

    var ticks = 0;
    while (!done.isCompleted && ticks++ < maxTicks) {
      await tester.pump(step);
    }
    return done.future;
  }

  group('startup auth check (@checkStartupState end-to-end)', () {
    testWidgets(
        'a hanging secure-storage read falls back to unauthenticated via the 5s timeout',
        (tester) async {
      repo.getOrCreateFingerprintImpl = () => Completer<String>().future;

      final state = await resolveStartup(tester);

      expect(state.status, AuthStatus.unauthenticated);
      expect(state.deviceFingerprint, 'unverified-device');
      expect(state.errorMessage, contains('timed out'));
    });

    testWidgets('a throwing repository falls back to unauthenticated',
        (tester) async {
      repo.getOrCreateFingerprintImpl = () async =>
          throw StateError('secure storage blew up');

      final state = await resolveStartup(tester);

      expect(state.status, AuthStatus.unauthenticated);
      expect(state.errorMessage, contains('failed'));
    });

    testWidgets('a stored session with a PIN lands on locked', (tester) async {
      repo.hasStoredSessionImpl = () async => true;
      repo.hasPinImpl = () async => true;

      final state = await resolveStartup(tester);

      expect(state.status, AuthStatus.locked);
      expect(state.deviceFingerprint, 'fp-1');
      expect(state.lastLoginPhone, '+251911000000');
      expect(state.errorMessage, isNull);
    });

    testWidgets('a stored session without a PIN lands on pinSetup',
        (tester) async {
      repo.hasStoredSessionImpl = () async => true;
      repo.hasPinImpl = () async => false;

      final state = await resolveStartup(tester);

      expect(state.status, AuthStatus.pinSetup);
    });

    testWidgets('no stored session lands on unauthenticated', (tester) async {
      final state = await resolveStartup(tester);

      expect(state.status, AuthStatus.unauthenticated);
      expect(state.deviceFingerprint, 'fp-1');
      expect(state.errorMessage, isNull);
    });
  });

  group('AuthStatus', () {
    test('contains all known startup states', () {
      expect(
        AuthStatus.values,
        containsAll([
          AuthStatus.unknown,
          AuthStatus.unauthenticated,
          AuthStatus.pinSetup,
          AuthStatus.locked,
          AuthStatus.unlocked,
        ]),
      );
    });
  });
}
