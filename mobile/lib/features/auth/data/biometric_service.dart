// Thin wrapper over `local_auth` (Step 21).
//
// The UI must gate biometric unlock behind a real OS prompt; on debug builds
// running on an emulator with no enrolled fingerprint we allow a mock success
// so the full flow can still be exercised. Release builds never take the
// fallback.
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

class BiometricService {
  BiometricService([LocalAuthentication? auth])
      : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  /// True when the device has biometric hardware and at least one enrolled
  /// modality. Never throws — a missing plugin (tests, unsupported device)
  /// simply reports `false`.
  Future<bool> isAvailable() async {
    try {
      final supported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      return supported && canCheck;
    } on PlatformException {
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Shows the OS biometric prompt. Returns true only when authentication
  /// succeeds. In debug builds with no enrolled biometrics this returns true
  /// without a prompt (emulator fallback).
  Future<bool> authenticate({required String reason}) async {
    try {
      final supported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      if (!supported || !canCheck) return kDebugMode;

      // An emulator reports biometric hardware but has nothing enrolled; the
      // OS prompt then fails with "not enrolled" instead of succeeding. Treat
      // "no enrolled modality" like "no hardware" so debug builds can still
      // exercise the unlock path.
      final enrolled = await _auth.getAvailableBiometrics();
      if (enrolled.isEmpty) return kDebugMode;

      return await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      return false;
    } catch (_) {
      return false;
    }
  }
}

final biometricServiceProvider =
    Provider<BiometricService>((ref) => BiometricService());
