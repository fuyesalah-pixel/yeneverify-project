// Auth state machine + Riverpod Notifier (Step 21).
//
// All session transitions live here: screens and flow-providers call these
// methods instead of writing `authProvider.notifier.state` directly.
import 'dart:async';

import 'package:flutter/foundation.dart' show debugPrint, kDebugMode, kReleaseMode;
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
    this.needsOnboarding = false,
    this.onboardingStep,
    this.pendingInvite,
    this.businessName,
  });

  final AuthStatus status;
  final User? user;
  final String? accessToken; // in-memory only — never persisted
  final String? deviceFingerprint;
  final bool biometricEnabled;
  final String? errorMessage;
  final String? lastLoginPhone;

  /// Onboarding routing flags, fetched from GET /onboarding/status once the
  /// session unlocks. Never derived from /auth/me.
  final bool needsOnboarding;
  final String? onboardingStep;
  final PendingInvite? pendingInvite;

  /// Business name from the create-merchant response. Transient: used by the
  /// dashboard right after onboarding; not persisted across cold starts yet.
  final String? businessName;

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    String? accessToken,
    String? deviceFingerprint,
    bool? biometricEnabled,
    String? errorMessage,
    String? lastLoginPhone,
    bool? needsOnboarding,
    String? onboardingStep,
    PendingInvite? pendingInvite,
    String? businessName,
    bool clearError = false,
    bool clearAccessToken = false,
    bool clearUser = false,
    bool clearPendingInvite = false,
  }) =>
      AuthState(
        status: status ?? this.status,
        user: clearUser ? null : (user ?? this.user),
        accessToken: clearAccessToken ? null : (accessToken ?? this.accessToken),
        deviceFingerprint: deviceFingerprint ?? this.deviceFingerprint,
        biometricEnabled: biometricEnabled ?? this.biometricEnabled,
        errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
        lastLoginPhone: lastLoginPhone ?? this.lastLoginPhone,
        needsOnboarding: needsOnboarding ?? this.needsOnboarding,
        onboardingStep: onboardingStep ?? this.onboardingStep,
        pendingInvite:
            clearPendingInvite ? null : (pendingInvite ?? this.pendingInvite),
        businessName: businessName ?? this.businessName,
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

  /// Resolves the cold-start auth state, with a hard timeout and a catch so
  /// the splash can never hang forever on a slow/hanging secure-storage or
  /// device-info plugin.
  Future<AuthState> _checkStartupState() async {
    try {
      return await _doCheckStartupState().timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          debugPrint(
            'YV: startup auth check timed out after 5s — falling back to unauthenticated',
          );
          return _fallbackStartupState(reason: 'timeout');
        },
      );
    } catch (e, st) {
      debugPrint(
        'YV: startup auth check failed: $e\n$st\n— falling back to unauthenticated',
      );
      return _fallbackStartupState(reason: 'error');
    }
  }

  Future<AuthState> _doCheckStartupState() async {
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

  /// Safe landing when the startup check times out or throws. Tries to keep
  /// any persisted session context (refresh token / PIN flag), but on
  /// failure it always resolves to a known state instead of `unknown`.
  AuthState _fallbackStartupState({required String reason}) {
    // Best-effort: if secure storage is responsive enough to tell us whether
    // a refresh token exists, preserve that much context. Otherwise force
    // the user to the login screen.
    const fingerprint = 'unverified-device';
    if (kDebugMode) {
      debugPrint(
        'YV: startup auth check ${reason == 'timeout' ? 'timed out' : 'failed'} '
        '- falling back to unauthenticated',
      );
    }
    return AuthState(
      status: AuthStatus.unauthenticated,
      deviceFingerprint: fingerprint,
      errorMessage: 'Startup check ${reason == 'timeout' ? 'timed out' : 'failed'}. Please log in again.',
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
  /// Fetches /onboarding/status before flipping to `unlocked` so the router
  /// never briefly shows the dashboard to a merchant who still needs
  /// onboarding.
  Future<void> completeEnrollment() async {
    final current = state.valueOrNull;
    if (current == null) return;
    final onboarding = await _loadOnboardingStatus();
    state = AsyncValue.data(
      current.copyWith(
        status: AuthStatus.unlocked,
        needsOnboarding:
            onboarding?.needsOnboarding ?? current.needsOnboarding,
        onboardingStep: onboarding?.step ?? current.onboardingStep,
        pendingInvite: onboarding?.pendingInvite,
        clearPendingInvite: onboarding?.pendingInvite == null,
        clearError: true,
      ),
    );
  }

  /// Stores the business name returned by onboarding so the dashboard can
  /// greet the merchant immediately (transient, not persisted).
  void setBusinessName(String name) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncValue.data(current.copyWith(businessName: name));
  }

  /// Fetches GET /onboarding/status (single source of truth for onboarding
  /// routing) and stores it on [AuthState]. Returns the typed error when the
  /// call fails; callers that only want best-effort hydration ignore it.
  Future<ApiError?> refreshOnboardingStatus() async {
    final result = await repo.onboardingStatus();
    switch (result) {
      case Failure<OnboardingStatus>(:final error):
        return error;
      case Success<OnboardingStatus>(:final data):
        final current = state.valueOrNull;
        if (current == null) return null;
        state = AsyncValue.data(
          current.copyWith(
            needsOnboarding: data.needsOnboarding,
            onboardingStep: data.step,
            pendingInvite: data.pendingInvite,
            clearPendingInvite: data.pendingInvite == null,
          ),
        );
        return null;
    }
  }

  /// Best-effort onboarding hydration for the unlock paths. A failure leaves
  /// the previous flags in place; the dashboard's dev refresh can retry.
  Future<OnboardingStatus?> _loadOnboardingStatus() async {
    final result = await repo.onboardingStatus();
    return result is Success<OnboardingStatus> ? result.data : null;
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
        final onboarding = await _loadOnboardingStatus();
        state = AsyncValue.data(
          AuthState(
            status: AuthStatus.unlocked,
            user: data.user,
            accessToken: data.tokens.accessToken,
            deviceFingerprint: fingerprint,
            biometricEnabled: await repo.biometricEnabled(),
            lastLoginPhone: data.user.phone,
            needsOnboarding: onboarding?.needsOnboarding ?? false,
            onboardingStep: onboarding?.step,
            pendingInvite: onboarding?.pendingInvite,
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
