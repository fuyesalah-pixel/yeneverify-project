// Tests for Google auth API and provider logic.
import 'package:flutter_test/flutter_test.dart';

import '../../../../core/network/api_error.dart';
import '../../data/models/device_account.dart';
import '../../domain/google_auth_provider.dart';

void main() {
  group('DeviceAccount', () {
    test('fromJson parses correctly', () {
      final json = {'phoneLast4': '1234', 'googleEmail': 'user@gmail.com'};
      final account = DeviceAccount.fromJson(json);
      expect(account.phoneLast4, '1234');
      expect(account.googleEmail, 'user@gmail.com');
    });

    test('toJson round-trips', () {
      final account = DeviceAccount(
        phoneLast4: '5678',
        googleEmail: 'test@example.com',
      );
      final json = account.toJson();
      expect(json['phoneLast4'], '5678');
      expect(json['googleEmail'], 'test@example.com');
    });
  });

  group('GoogleAuthState copyWith', () {
    test('preserves fields when not overridden', () {
      final initial = GoogleAuthState(
        status: GoogleAuthStatus.idle,
        deviceAccounts: [
          DeviceAccount(phoneLast4: '0000', googleEmail: 'a@b.com')
        ],
      );
      final updated = initial.copyWith(status: GoogleAuthStatus.signingIn);
      expect(updated.status, GoogleAuthStatus.signingIn);
      expect(updated.deviceAccounts.length, 1);
      expect(updated.deviceAccounts.first.phoneLast4, '0000');
    });

    test('clearError removes error', () {
      final initial = GoogleAuthState(
        status: GoogleAuthStatus.error,
        error: const ApiError(code: 'AUTH_GOOGLE_NO_TOKEN'),
      );
      final cleared = initial.copyWith(clearError: true);
      expect(cleared.error, isNull);
      expect(cleared.status, GoogleAuthStatus.error);
    });
  });
}
