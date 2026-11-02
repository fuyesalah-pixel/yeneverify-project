// Auth state machine + Riverpod Notifier (Step 21). Mobile-only.
//
// All session transitions live here: screens and flow-providers call these
// methods instead of writing `authProvider.notifier.state` directly.
import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/token_store.dart';
import '../data/auth_api.dart';
import '../data/auth_repository.dart';
import '../data/models/auth_models.dart';

enum AuthStatus {
  unknown,
  unauthenticated,
  pinSetup,
  locked,
  unlocked,
}

class AuthState {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.user,
    this.accessToken,
    this.deviceFingerprint,
    this.biometricEnabled = false,
    this.errorMessage,
    this.lastLoginPhone,
  });

  final AuthStatus status;
  final User? user;
  final String? accessToken; // in-memory only — never persisted
  final String? deviceFingerprint;
  final bool biometricEnabled;
  final String? errorMessage;
  final String? lastLoginPhone;

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    String? accessToken,
    String? deviceFingerprint,
    bool? biometricEnabled,
    String? errorMessage,
    String? lastLoginPhone,
    bool clearError = false,
    bool clearAccessToken = false,
    bool clearUser = false,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: clearUser ? null : (user ?? this.user),
        accessToken: clearAccessToken ? null : (accessToken ?? this.accessToken),
        deviceFingerprint: deviceFingerprint ?? this.deviceFingerprint,
        biometricEnabled: biometricEnabled ?? this.biometricEnabled,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
        lastLoginPhone: lastLoginPhone ?? this.lastLoginPhone,
      );
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  AuthRepository get repo => ref.read(authRepositoryProvider);

  @override
  Future<AuthState> build() async {
    // The network layer calls this when a silent refresh fails, so a dead
    // session drops the user back to login without a dangling token.
    ref.read(tokenGatewayProvider).onSessionExpired = () {
      Future.microtask(() async {
        await repo.clearAuthData();
        final fp =
            state.valueOrNull?.deviceFingerprint ?? await repo.getOrCreateFingerprint();
        state = AsyncValue.data(
          AuthState(status: AuthStatus.unauthenticated, deviceFingerprint: fp),
        );
      });
    };

    return _checkStartupState();
  }

  // -- startup ---------------------------------------------------------------
  Future<AuthState> _checkStartupState() async {
    final fingerprint = await repo.getOrCreateFingerprint();
    final hasSession = await repo.hasStoredSession();
    if (!hasSession) {
      return AuthState(
        status: AuthStatus.unauthenticated,
        deviceFingerprint: fingerprint,
      );
    }

    final storedPhone = await repo.readStoredPhone() ?? await repo.readStoredUserId();
    final biometric = await repo.biometricEnabled();
    final hasPin = await repo.hasPin();

    if (!hasPin) {
      return AuthState(
        status: AuthStatus.pinSetup,
        deviceFingerprint: fingerprint,
        biometricEnabled: biometric,
        lastLoginPhone: storedPhone,
      );
    }

    return AuthState(
      status: AuthStatus.locked,
      deviceFingerprint: fingerprint,
      biometricEnabled: biometric,
      lastLoginPhone: storedPhone,
    );
  }

  // -- login / OTP -----------------------------------------------------------

  Future<ApiResult<OtpRequestResponse>> requestOtp(String phone) =>
      repo.requestOtp(phone);

  /// Verifies the OTP, persists the session and moves the state machine to
  /// either `pinSetup` (first login) or `locked` (returning user). Returns the
  /// typed error on failure so the OTP screen can localize it.
  Future<ApiError?> verifyOtp({required String phone, required String code}) async {
    final result = await repo.verifyOtp(phone: phone, code: code);
    switch (result) {
      case Failure<AuthStateResult>(:final error):
        return error;
      case Success<AuthStateResult>(:final data):
        final fingerprint =
            state.valueOrNull?.deviceFingerprint ?? await repo.getOrCreateFingerprint();
        state = AsyncValue.data(
          AuthState(
            status: data.user.needsPinSetup ? AuthStatus.pinSetup : AuthStatus.locked,
            user: data.user,
            accessToken: data.tokens.accessToken,
            deviceFingerprint: fingerprint,
            biometricEnabled: await repo.biometricEnabled(),
            lastLoginPhone: data.user.phone,
          ),
        );
        return null;
    }
  }

  // -- PIN -------------------------------------------------------------------

  /// Persists the PIN server-side and locally. State deliberately stays in
  /// `pinSetup` until [completeEnrollment] runs, so the biometric screen can
  /// be shown without the router racing us to the dashboard.
  Future<ApiError?> setPin(String pin) async {
    final result = await repo.setPin(pin: pin);
    switch (result) {
      case Failure<void>(:final error):
        return error;
      case Success<void>():
        return null;
    }
  }

  /// Called after the optional biometric-enrollment step (enabled OR skipped).
  void completeEnrollment() {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue.data(
      current.copyWith(status: AuthStatus.unlocked, clearError: true),
    );
  }

  Future<ApiError?> unlockWithPin(String pin) async {
    final result = await repo.unlockWithPin(pin: pin);
    return _applyUnlockResult(result);
  }

  Future<ApiError?> unlockWithBiometric() async {
    final result = await repo.unlock(method: UnlockMethod.biometric);
    return _applyUnlockResult(result);
  }

  Future<ApiError?> _applyUnlockResult(ApiResult<AuthStateResult> result) async {
    switch (result) {
      case Failure<AuthStateResult>(:final error):
        return error;
      case Success<AuthStateResult>(:final data):
        final fingerprint =
            state.valueOrNull?.deviceFingerprint ?? await repo.getOrCreateFingerprint();
        state = AsyncValue.data(
          AuthState(
            status: AuthStatus.unlocked,
            user: data.user,
            accessToken: data.tokens.accessToken,
            deviceFingerprint: fingerprint,
            biometricEnabled: await repo.biometricEnabled(),
            lastLoginPhone: data.user.phone,
          ),
        );
        return null;
    }
  }

  // -- biometric enrollment --------------------------------------------------

  Future<ApiError?> enableBiometric({required String pin}) async {
    final result = await repo.enableBiometric(pin: pin);
    switch (result) {
      case Failure<void>(:final error):
        return error;
      case Success<void>():
        await repo.markBiometricEnabled();
        final current = state.valueOrNull;
        if (current != null) {
          state = AsyncValue.data(current.copyWith(biometricEnabled: true));
        }
        return null;
    }
  }

  // -- session -----------------------------------------------------------------

  /// Best-effort backend logout, then always clears local session data and
  /// returns to the login state. Keeps fingerprint + biometric flag.
  Future<void> logout() async {
    try {
      final refreshToken = await repo.getRefreshToken();
      if (refreshToken != null) {
        await repo.logoutApi(refreshToken: refreshToken);
      }
    } catch (_) {
      // Best-effort network call; always clear local state.
    }
    await repo.clearAuthData();
    final fingerprint =
        state.valueOrNull?.deviceFingerprint ?? await repo.getOrCreateFingerprint();
    state = AsyncValue.data(
      AuthState(status: AuthStatus.unauthenticated, deviceFingerprint: fingerprint),
    );
  }

  void clearError() {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue.data(current.copyWith(clearError: true));
  }

  /// Debug-only shortcut used by the login screen's "Dev: skip auth" button so
  /// Steps 22+ can be built without replaying OTP. No-op in release builds.
  void devUnlock({required User user}) {
    if (kReleaseMode) return;
    final current = state.valueOrNull;
    state = AsyncValue.data(
      (current ?? const AuthState()).copyWith(
        status: AuthStatus.unlocked,
        user: user,
        accessToken: 'dev-fake-token',
        clearError: true,
      ),
    );
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);

/// Convenience provider exposing just the status, for ref.listen.
final authStatusProvider = Provider<AuthStatus>((ref) {
  return ref.watch(authProvider).valueOrNull?.status ?? AuthStatus.unknown;
});
