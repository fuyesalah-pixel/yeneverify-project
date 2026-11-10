// Mobile-only. Wraps /auth/* + /onboarding/status endpoints per the
// backend contract (see backend/src/auth/auth.controller.ts).
import 'package:dio/dio.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import 'models/auth_models.dart';

class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  static const _prefix = '/auth';

  /// POST /auth/refresh returns FLAT tokens (no user/device envelope), so it
  /// maps to FlatTokensResponse rather than AuthResponse.
  Future<ApiResult<FlatTokensResponse>> refresh(String refreshToken) async {
    return _post<FlatTokensResponse>(
      '$_prefix/refresh',
      data: {'refreshToken': refreshToken},
      fromJson: FlatTokensResponse.fromJson,
    );
  }

  /// POST /auth/pin/set — Bearer access token required (interceptor supplies
  /// the in-memory token obtained from the Google onboarding/sign-in response
  /// just before this).
  Future<ApiResult<void>> setPin({required String pin}) async {
    return _post<void>(
      '$_prefix/pin/set',
      data: {'pin': pin},
      fromJson: (_) {},
    );
  }

  /// POST /auth/pin/verify — Bearer required. Returns a step-up token.
  Future<ApiResult<StepUpResponse>> verifyPin({required String pin}) async {
    return _post<StepUpResponse>(
      '$_prefix/pin/verify',
      data: {'pin': pin},
      fromJson: StepUpResponse.fromJson,
    );
  }

  /// POST /auth/unlock — body: { refreshToken, device: { fingerprint, platform }
  /// , unlockMethod: 'BIOMETRIC' | 'PIN' }. Replaces /auth/refresh on app open
  /// (per controller docs). Returns FLAT tokens only.
  Future<ApiResult<FlatTokensResponse>> unlock({
    required String refreshToken,
    required Map<String, dynamic> device,
    required UnlockMethod method,
  }) async {
    return _post<FlatTokensResponse>(
      '$_prefix/unlock',
      data: {
        'refreshToken': refreshToken,
        'device': device,
        'unlockMethod': method.value,
      },
      fromJson: FlatTokensResponse.fromJson,
    );
  }

  /// POST /auth/biometric/enable — Bearer + X-Step-Up-Token (from pin/verify).
  Future<ApiResult<void>> enableBiometric({
    required String deviceId,
    required String stepUpToken,
  }) async {
    return _post<void>(
      '$_prefix/biometric/enable',
      data: {'deviceId': deviceId},
      options: Options(headers: {'X-Step-Up-Token': stepUpToken}),
      fromJson: (_) {},
    );
  }

  Future<ApiResult<void>> logout({required String refreshToken}) async {
    return _post<void>(
      '$_prefix/logout',
      data: {'refreshToken': refreshToken},
      fromJson: (_) {},
    );
  }

  Future<ApiResult<User>> me() async {
    return _get<User>('$_prefix/me', fromJson: User.fromJson);
  }

  Future<ApiResult<OnboardingStatus>> onboardingStatus() async {
    return _get<OnboardingStatus>('/onboarding/status', fromJson: OnboardingStatus.fromJson);
  }

  // -- internal ------------------------------------------------------------

  Future<ApiResult<T>> _get<T>(String path,
      {required T Function(Map<String, dynamic>) fromJson}) {
    return _post<T>(path, data: null, method: 'GET', fromJson: fromJson);
  }

  Future<ApiResult<T>> _post<T>(
    String path, {
    required T Function(Map<String, dynamic>) fromJson,
    Map<String, dynamic>? data,
    String method = 'POST',
    Options? options,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        data: data,
        options: (options ?? Options()).copyWith(method: method),
      );
      final body = res.data ?? const <String, dynamic>{};
      final payload = (body['data'] as Map<String, dynamic>?) ?? body;
      return Success(fromJson(payload));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }
}

enum UnlockMethod { biometric, pin }

extension UnlockMethodValue on UnlockMethod {
  String get value =>
      switch (this) { UnlockMethod.biometric => 'BIOMETRIC', UnlockMethod.pin => 'PIN' };
}
