// Pure redirect-matrix tests for the auth + onboarding routing seam.
//
// Mirrors the contract:
//   unknown         -> splash
//   unauthenticated -> login
//   pinSetup        -> pin-setup
//   locked          -> unlock
//   unlocked        -> need onboarding ? /onboarding : app screens
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/router/auth_redirect.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';

String? _redirect(
  AuthStatus status,
  String path, {
  bool needsOnboarding = false,
}) {
  return authRedirect(
    AuthState(status: status, needsOnboarding: needsOnboarding),
    path,
  );
}

void main() {
  group('unknown', () {
    test('stays on the splash', () {
      expect(_redirect(AuthStatus.unknown, '/'), isNull);
    });

    test('any other route bounces to the splash', () {
      expect(_redirect(AuthStatus.unknown, '/dashboard'), '/');
      expect(_redirect(AuthStatus.unknown, '/login'), '/');
    });
  });

  group('unauthenticated', () {
    test('login, otp, splash and design-system are reachable', () {
      expect(_redirect(AuthStatus.unauthenticated, '/login'), isNull);
      expect(_redirect(AuthStatus.unauthenticated, '/otp'), isNull);
      expect(_redirect(AuthStatus.unauthenticated, '/'), isNull);
      expect(_redirect(AuthStatus.unauthenticated, '/design-system'), isNull);
    });

    test('app screens redirect to login', () {
      expect(_redirect(AuthStatus.unauthenticated, '/dashboard'), '/login');
      expect(_redirect(AuthStatus.unauthenticated, '/verify'), '/login');
      expect(_redirect(AuthStatus.unauthenticated, '/onboarding'), '/login');
    });
  });

  group('pinSetup', () {
    test('pin-setup and biometric-enroll are reachable', () {
      expect(_redirect(AuthStatus.pinSetup, '/pin-setup'), isNull);
      expect(_redirect(AuthStatus.pinSetup, '/biometric-enroll'), isNull);
      expect(_redirect(AuthStatus.pinSetup, '/'), isNull);
    });

    test('login and dashboard redirect to pin-setup', () {
      expect(_redirect(AuthStatus.pinSetup, '/login'), '/pin-setup');
      expect(_redirect(AuthStatus.pinSetup, '/dashboard'), '/pin-setup');
    });
  });

  group('locked', () {
    test('unlock, login and splash are reachable', () {
      expect(_redirect(AuthStatus.locked, '/unlock'), isNull);
      expect(_redirect(AuthStatus.locked, '/login'), isNull);
      expect(_redirect(AuthStatus.locked, '/'), isNull);
    });

    test('app screens redirect to unlock', () {
      expect(_redirect(AuthStatus.locked, '/dashboard'), '/unlock');
      expect(_redirect(AuthStatus.locked, '/verify'), '/unlock');
      expect(_redirect(AuthStatus.locked, '/onboarding'), '/unlock');
    });
  });

  group('unlocked + needsOnboarding', () {
    test('onboarding and design-system are reachable', () {
      expect(
        _redirect(AuthStatus.unlocked, '/onboarding', needsOnboarding: true),
        isNull,
      );
      expect(
        _redirect(AuthStatus.unlocked, '/design-system',
            needsOnboarding: true),
        isNull,
      );
    });

    test('dashboard redirects to onboarding', () {
      expect(
        _redirect(AuthStatus.unlocked, '/dashboard', needsOnboarding: true),
        '/onboarding',
      );
    });

    test('verify redirects to onboarding', () {
      expect(
        _redirect(AuthStatus.unlocked, '/verify', needsOnboarding: true),
        '/onboarding',
      );
    });

    test('auth flow screens redirect to onboarding', () {
      expect(
        _redirect(AuthStatus.unlocked, '/login', needsOnboarding: true),
        '/onboarding',
      );
      expect(
        _redirect(AuthStatus.unlocked, '/otp', needsOnboarding: true),
        '/onboarding',
      );
    });

    test('splash redirects to onboarding', () {
      expect(
        _redirect(AuthStatus.unlocked, '/', needsOnboarding: true),
        '/onboarding',
      );
    });
  });

  group('unlocked + onboarding complete', () {
    test('dashboard and verify are reachable', () {
      expect(_redirect(AuthStatus.unlocked, '/dashboard'), isNull);
      expect(_redirect(AuthStatus.unlocked, '/verify'), isNull);
      expect(_redirect(AuthStatus.unlocked, '/design-system'), isNull);
    });

    test('auth flow screens redirect to dashboard', () {
      expect(_redirect(AuthStatus.unlocked, '/login'), '/dashboard');
      expect(_redirect(AuthStatus.unlocked, '/otp'), '/dashboard');
      expect(_redirect(AuthStatus.unlocked, '/pin-setup'), '/dashboard');
      expect(_redirect(AuthStatus.unlocked, '/unlock'), '/dashboard');
    });

    test('splash redirects to dashboard', () {
      expect(_redirect(AuthStatus.unlocked, '/'), '/dashboard');
    });

    test('onboarding redirects to dashboard once complete', () {
      expect(_redirect(AuthStatus.unlocked, '/onboarding'), '/dashboard');
    });

    test('other authenticated routes are allowed', () {
      expect(_redirect(AuthStatus.unlocked, '/receipts/123'), isNull);
      expect(_redirect(AuthStatus.unlocked, '/settings'), isNull);
    });
  });
}
