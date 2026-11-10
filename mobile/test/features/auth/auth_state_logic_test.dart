// Pure-function tests for redirect rules + error mapping (Step 21).
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/router/auth_redirect.dart';
import 'package:yene_verify/features/auth/data/models/auth_models.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';

void main() {
  group('authRedirect', () {
    test('unknown user stays on splash', () {
      expect(
        authRedirect(const AuthState(status: AuthStatus.unknown), '/'),
        isNull,
      );
      expect(
        authRedirect(const AuthState(status: AuthStatus.unknown), '/login'),
        '/',
      );
    });

    test('unauthenticated users go to login', () {
      const auth = AuthState(status: AuthStatus.unauthenticated);
      // Splash is a transient flow route, so it is allowed to render while
      // its timer navigates to /login.
      expect(authRedirect(auth, '/'), isNull);
      expect(authRedirect(auth, '/dashboard'), '/login');
      expect(authRedirect(auth, '/login'), isNull);
      expect(authRedirect(auth, '/phone-pairing'), isNull);
      expect(authRedirect(auth, '/design-system'), isNull);
    });

    test('pinSetup redirects to pin-setup', () {
      const auth = AuthState(status: AuthStatus.pinSetup);
      expect(authRedirect(auth, '/login'), '/pin-setup');
      expect(authRedirect(auth, '/pin-setup'), isNull);
    });

    test('locked redirects to unlock', () {
      const auth = AuthState(status: AuthStatus.locked);
      expect(authRedirect(auth, '/dashboard'), '/unlock');
      expect(authRedirect(auth, '/unlock'), isNull);
    });

    test('unlocked leaves app screens; bounce back auth screens', () {
      const auth = AuthState(status: AuthStatus.unlocked);
      expect(authRedirect(auth, '/dashboard'), isNull);
      expect(authRedirect(auth, '/verify'), isNull);
      expect(authRedirect(auth, '/login'), '/dashboard');
      expect(authRedirect(auth, '/unlock'), '/dashboard');
    });
  });

  group('User.fromJson', () {
    test('reads PIN state from raw /auth/me without deriving onboarding', () {
      final user = User.fromJson({
        'id': 'u1',
        'phone': '+251911555001',
        'fullName': '',
        'role': 'MERCHANT',
        'status': 'ACTIVE',
        'pinHash': null,
        'pinSetAt': null,
        'ownedMerchant': null,
      });

      expect(user.needsPinSetup, isTrue);
      // /auth/me is identity + PIN state only; /onboarding/status decides
      // onboarding routing.
      expect(user.needsOnboarding, isFalse);
    });

    test('parses a pending sub-merchant invite from /onboarding/status', () {
      final status = OnboardingStatus.fromJson({
        'needsOnboarding': true,
        'step': 'SUB_MERCHANT_ACCEPT',
        'pendingInvite': {
          'id': 'inv-1',
          'merchantName': 'Kebede Trading',
          'branchLabel': 'Bole',
        },
      });

      expect(status.needsOnboarding, isTrue);
      expect(status.step, 'SUB_MERCHANT_ACCEPT');
      expect(status.pendingInvite?.id, 'inv-1');
      expect(status.pendingInvite?.merchantName, 'Kebede Trading');
      expect(status.pendingInvite?.branchLabel, 'Bole');
    });

    test('honours an explicit needsPinSetup from the auth DTO', () {
      final user = User.fromJson({
        'id': 'u1',
        'phone': '+251911555001',
        'needsPinSetup': false,
        'needsOnboarding': true,
      });

      expect(user.needsPinSetup, isFalse);
    });

    test('copyWith can override the PIN flag for the onboarding-403 fallback',
        () {
      const dto = User(
        id: 'u1',
        phone: '+251911555001',
        fullName: '',
        role: 'MERCHANT',
        status: 'ACTIVE',
        needsPinSetup: false,
        needsOnboarding: true,
      );

      expect(dto.copyWith(needsPinSetup: true).needsPinSetup, isTrue);
    });
  });

  group('ApiError.userFacingMessage', () {
    test('maps wrong PIN to incorrect-PIN message', () {
      const err = ApiError(code: 'AUTH_PIN_INVALID');
      expect(err.userFacingMessage(), contains('Incorrect PIN'));
    });

    test('maps rate limiting without retryAfter to the wait message', () {
      const err = ApiError(code: 'AUTH_RATE_LIMITED');
      expect(err.userFacingMessage(), contains('Too many attempts'));
    });

    test('maps lockout with retryAfter to minutes message', () {
      const err = ApiError(
        code: 'AUTH_PIN_LOCKED',
        retryAfterSeconds: 900,
      );
      expect(err.userFacingMessage(), contains('15 minutes'));
    });

    test('maps AUTH_WEAK_PIN to the PIN strength message', () {
      const err = ApiError(code: 'AUTH_WEAK_PIN');
      expect(err.userFacingMessage(), contains('too weak'));
      expect(err.userFacingMessage(), contains('sequential'));
    });

    test('maps bare network errors to the generic network message', () {
      const err = ApiError(kind: ApiErrorKind.network);
      expect(err.userFacingMessage(), contains('Network problem'));
    });

    test('unknown codes fall back to generic message', () {
      const err = ApiError(code: 'SOMETHING_ELSE');
      expect(err.userFacingMessage(), isNotNull);
    });
  });
}
