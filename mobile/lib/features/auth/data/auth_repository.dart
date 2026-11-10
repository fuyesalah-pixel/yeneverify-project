// Mobile-only. Orchestrates AuthApi + SecureStorage + SessionStore.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/device_fingerprint.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/storage/session_store.dart';
import 'auth_api.dart';
import 'device_info.dart';
import 'google_auth_api.dart';
import 'models/auth_models.dart';
import 'models/device_account.dart';

class AuthRepository {
  AuthRepository({
    required SessionStore sessionStore,
    required AuthApi api,
    required GoogleAuthApi googleApi,
  })  : _sessionStore = sessionStore,
        _api = api,
        _googleApi = googleApi;

  static const pinLength = 4;

  final SessionStore _sessionStore;
  final AuthApi _api;
  final GoogleAuthApi _googleApi;

  // -- device ----------------------------------------------------------------
  Future<DeviceIdentity> deviceIdentity() async {
    final fingerprint = await getOrCreateFingerprint();
    return collectDeviceInfo(fingerprint);
  }

  /// Public entrypoint used at startup to obtain the stable fingerprint.
  Future<String> getOrCreateFingerprint() async {
    final existing = await _sessionStore.readFingerprint();
    if (existing != null && existing.isNotEmpty) return existing;
    return DeviceFingerprint(_sessionStore).getOrCreate();
  }

  // -- login flow ------------------------------------------------------------

  /// Unlock via /auth/unlock. Backend verifies device + refresh token; the
  /// unlockMethod tells the backend which path was used.
  Future<ApiResult<AuthStateResult>> unlock(
      {required UnlockMethod method}) async {
    final device = await deviceIdentity();
    final refreshToken = await _sessionStore.readRefreshToken();
    if (refreshToken == null) {
      return const Failure(ApiError(
        code: 'AUTH_NO_SESSION',
        message: 'No session on device',
        kind: ApiErrorKind.auth,
      ));
    }
    final result = await _api.unlock(
      refreshToken: refreshToken,
      device: device.toJson(),
      method: method,
    );
    return switch (result) {
      Failure<FlatTokensResponse>() => Failure<AuthStateResult>(result.error),
      Success<FlatTokensResponse>() =>
        await _persistTokensThenFetchUser(result.data.tokens),
    };
  }

  /// Silent refresh via POST /auth/refresh. Used on cold start to restore a
  /// valid session without re-prompting the user. Returns the combined
  /// session result (tokens + user) on success.
  Future<ApiResult<AuthStateResult>> refresh() async {
    final refreshToken = await _sessionStore.readRefreshToken();
    if (refreshToken == null) {
      return const Failure(ApiError(
        code: 'AUTH_NO_SESSION',
        message: 'No session on device',
        kind: ApiErrorKind.auth,
      ));
    }
    final result = await _api.refresh(refreshToken);
    return switch (result) {
      Failure<FlatTokensResponse>() => Failure<AuthStateResult>(result.error),
      Success<FlatTokensResponse>() =>
        await _persistTokensThenFetchUser(result.data.tokens),
    };
  }

  /// PIN unlock: first obtain a session (/auth/unlock with the stored
  /// refresh token), THEN server-verify the PIN via POST /auth/pin/verify
  /// using the fresh access token. Without the second call any 4 digits
  /// would unlock — the /unlock endpoint verifies device + token only.
  Future<ApiResult<AuthStateResult>> unlockWithPin({required String pin}) async {
    final hasPin = await _sessionStore.readHasPin();
    if (!hasPin) {
      return const Failure(ApiError(
        code: 'AUTH_PIN_NOT_SET',
        message: 'No PIN is set on this account',
      ));
    }
    final session = await unlock(method: UnlockMethod.pin);
    if (session is Failure<AuthStateResult>) return session;
    final verify = await _api.verifyPin(pin: pin);
    return switch (verify) {
      Failure<StepUpResponse>() => Failure<AuthStateResult>(verify.error),
      Success<StepUpResponse>() => session,
    };
  }

  Future<ApiResult<StepUpResponse>> verifyPin({required String pin}) {
    return _api.verifyPin(pin: pin);
  }

  /// POST /auth/pin/set, then mirror `has_pin` locally so the next app launch
  /// shows the unlock screen instead of PIN setup.
  Future<ApiResult<void>> setPin({required String pin}) async {
    final result = await _api.setPin(pin: pin);
    if (result is Success<void>) {
      await _sessionStore.setHasPin(true);
    }
    return result;
  }

  /// PIN step-up + biometric enable. The step-up token is bound to the
  /// caller's session/device, and the backend expects the server device row
  /// id (UUID) — not the fingerprint.
  Future<ApiResult<void>> enableBiometric({required String pin}) async {
    final stepUp = await _api.verifyPin(pin: pin);
    if (stepUp is Failure<StepUpResponse>) {
      return Failure<void>(stepUp.error);
    }
    final token = (stepUp as Success<StepUpResponse>).data.stepUpToken;
    return _enableBiometricWithToken(token);
  }

  Future<ApiResult<void>> _enableBiometricWithToken(String stepUpToken) async {
    final deviceId = await _sessionStore.readDeviceId();
    if (deviceId == null || deviceId.isEmpty) {
      return const Failure(ApiError(
        code: 'AUTH_DEVICE_NOT_FOUND',
        message: 'Device is not registered on the server',
      ));
    }
    return _api.enableBiometric(deviceId: deviceId, stepUpToken: stepUpToken);
  }

  Future<bool> markBiometricEnabled() async {
    await _sessionStore.setBiometricEnabled(true);
    return true;
  }

  Future<ApiResult<User>> me() => _api.me();

  Future<ApiResult<OnboardingStatus>> onboardingStatus() =>
      _api.onboardingStatus();

  Future<ApiResult<void>> logoutApi({required String refreshToken}) =>
      _api.logout(refreshToken: refreshToken);

  // -- Google auth -----------------------------------------------------------

  /// Persists a Google-auth session directly (tokens + user from
  /// POST /auth/google/onboard or /auth/google/signin).
  Future<ApiResult<AuthStateResult>> persistGoogleSession({
    required AuthTokens tokens,
    required User user,
  }) async {
    try {
      _sessionStore.setAccessToken(tokens.accessToken);
      await _sessionStore.setRefreshToken(tokens.refreshToken);
      final deviceId = user.id;
      if (deviceId.isNotEmpty) {
        await _sessionStore.setDeviceId(deviceId);
      }
      await _sessionStore.touchUnlock();
      await _sessionStore.setUserId(user.id);
      await _sessionStore.setUserPhone(user.phone);
      await _sessionStore.setHasPin(!user.needsPinSetup);
      return Success(AuthStateResult(user: user, tokens: tokens));
    } catch (e) {
      return Failure(ApiError(message: 'Storage write failed: $e'));
    }
  }

  /// GET-equivalent (POST with body): list accounts paired to this device.
  Future<ApiResult<List<DeviceAccount>>> googleDeviceAccounts({
    required String deviceFingerprint,
  }) async {
    return _googleApi.deviceAccounts(deviceFingerprint: deviceFingerprint);
  }

  /// POST /auth/device-accounts/:phoneLast4/signout.
  Future<ApiResult<void>> googleSignoutDeviceAccount({
    required String phoneLast4,
    required String deviceFingerprint,
  }) async {
    return _googleApi.signoutDeviceAccount(
      phoneLast4: phoneLast4,
      deviceFingerprint: deviceFingerprint,
    );
  }

  // -- startup / storage ------------------------------------------------------
  Future<bool> hasStoredSession() async =>
      await _sessionStore.readRefreshToken() != null;

  Future<bool> biometricEnabled() => _sessionStore.readBiometricEnabled();

  Future<bool> hasPin() => _sessionStore.readHasPin();

  Future<bool> readPinSkipped() => _sessionStore.readPinSkipped();

  Future<void> touchRefresh() => _sessionStore.touchRefresh();

  Future<void> setPinSkipped(bool value) => _sessionStore.setPinSkipped(value);

  Future<String?> getRefreshToken() => _sessionStore.readRefreshToken();

  Future<String?> readStoredPhone() => _sessionStore.readUserPhone();

  Future<String?> readStoredUserId() => _sessionStore.readUserId();

  Future<void> clearAuthData() => _sessionStore.logout();

  /// Unlock/refresh responses carry FLAT tokens without user data; after
  /// persisting them we fetch the user via GET /auth/me (the new access
  /// token authorizes it) and surface the combined session result.
  Future<ApiResult<AuthStateResult>> _persistTokensThenFetchUser(
    AuthTokens tokens,
  ) async {
    try {
      _sessionStore.setAccessToken(tokens.accessToken);
      await _sessionStore.setRefreshToken(tokens.refreshToken);
      final meResult = await _meOrLocalFallback();
      switch (meResult) {
        case Failure<User>():
          // Tokens persisted (next cold start will re-unlock); surface the
          // /me failure so the flow shows a real error instead of hanging.
          return Failure<AuthStateResult>(meResult.error);
        case Success<User>():
          final user = meResult.data;
          await _sessionStore.setUserId(user.id);
          await _sessionStore.setUserPhone(user.phone);
          await _sessionStore.setHasPin(!user.needsPinSetup);
          await _sessionStore.touchUnlock();
          return Success(AuthStateResult(user: user, tokens: tokens));
      }
    } catch (e) {
      return Failure(ApiError(message: 'Storage write failed: $e'));
    }
  }

  /// GET /auth/me is the only endpoint that reports the real PIN state. Older
  /// backend builds guarded it with the onboarding check, so a merchant
  /// without a profile could get a 403 `MERCHANT_NOT_ONBOARDED`; that is fixed
  /// on the backend (@SkipOnboarding), but the local-session fallback stays
  /// for resilience. Onboarding flags themselves now come from
  /// /onboarding/status — never from `/me`.
  Future<ApiResult<User>> _meOrLocalFallback() async {
    final result = await me();
    if (result is Success<User>) return result;

    final error = (result as Failure<User>).error;
    final blockedByOnboarding =
        error.httpStatus == 403 || error.code == 'MERCHANT_NOT_ONBOARDED';
    if (!blockedByOnboarding) return result;

    final hasPin = await _sessionStore.readHasPin();
    final id = await _sessionStore.readUserId();
    if (id == null || id.isEmpty) return result;
    return Success(
      User(
        id: id,
        phone: await _sessionStore.readUserPhone() ?? '',
        fullName: '',
        role: 'MERCHANT',
        status: 'ACTIVE',
        needsPinSetup: !hasPin,
        // Not used for routing; /onboarding/status is the only source.
        needsOnboarding: false,
      ),
    );
  }
}

class AuthStateResult {
  const AuthStateResult({required this.user, required this.tokens});
  final User user;
  final AuthTokens tokens;
}

final authApiProvider = Provider<AuthApi>((ref) {
  return AuthApi(ref.watch(dioProvider));
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    sessionStore: ref.watch(sessionStoreProvider),
    api: ref.watch(authApiProvider),
    googleApi: ref.watch(googleAuthApiProvider),
  );
});
