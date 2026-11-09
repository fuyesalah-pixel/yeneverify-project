// Mobile-only. Wraps /auth/google/* endpoints per the backend contract
// (see backend/src/google-auth/google-auth.controller.ts).
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import 'models/device_account.dart';
import 'models/auth_models.dart';

/// Google ID token payload returned by google_sign_in after successful sign-in.
class GoogleIdTokenResult {
  const GoogleIdTokenResult({
    required this.idToken,
    required this.email,
    required this.displayName,
  });

  final String idToken;
  final String email;
  final String? displayName;
}

class GoogleAuthApi {
  GoogleAuthApi(this._dio);

  final Dio _dio;

  static const _prefix = '/auth/google';

  /// POST /auth/google — sign in with a linked Google account (ID token).
  Future<ApiResult<AuthResponse>> login({
    required String idToken,
    required Map<String, dynamic> device,
  }) async {
    return _post<AuthResponse>(
      _prefix,
      data: {'idToken': idToken, 'device': device},
      fromJson: AuthResponse.fromJson,
    );
  }

  /// POST /auth/google/onboard — first-time Google signup + phone pairing.
  Future<ApiResult<AuthResponse>> onboard({
    required String idToken,
    required String phone,
    required String fullName,
    required Map<String, dynamic> device,
  }) async {
    return _post<AuthResponse>(
      '$_prefix/onboard',
      data: {
        'idToken': idToken,
        'phone': phone,
        'fullName': fullName,
        'device': device,
      },
      fromJson: AuthResponse.fromJson,
    );
  }

  /// POST /auth/google/signin — returning Google user sign-in.
  Future<ApiResult<AuthResponse>> signin({
    required String idToken,
    required Map<String, dynamic> device,
  }) async {
    return _post<AuthResponse>(
      '$_prefix/signin',
      data: {'idToken': idToken, 'device': device},
      fromJson: AuthResponse.fromJson,
    );
  }

  /// GET /auth/device-accounts — list accounts paired to this device.
  Future<ApiResult<List<DeviceAccount>>> deviceAccounts({
    required String deviceFingerprint,
  }) async {
    return _post<List<DeviceAccount>>(
      '$_prefix/device-accounts',
      data: {'deviceFingerprint': deviceFingerprint},
      fromJson: _deviceAccountsFromJson,
    );
  }

  /// POST /auth/device-accounts/:phoneLast4/signout — remove a device binding.
  Future<ApiResult<void>> signoutDeviceAccount({
    required String phoneLast4,
    required String deviceFingerprint,
  }) async {
    return _post<void>(
      '$_prefix/device-accounts/$phoneLast4/signout',
      data: {'deviceFingerprint': deviceFingerprint},
      fromJson: (_) {},
    );
  }

  // -- internal ------------------------------------------------------------

  Future<ApiResult<T>> _post<T>(
    String path, {
    required T Function(Map<String, dynamic>) fromJson,
    Map<String, dynamic>? data,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        data: data,
        options: Options().copyWith(method: 'POST'),
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

  List<DeviceAccount> _deviceAccountsFromJson(Map<String, dynamic> json) {
    final accounts = (json['accounts'] as List?) ?? const <dynamic>[];
    return accounts
        .whereType<Map<String, dynamic>>()
        .map(DeviceAccount.fromJson)
        .toList();
  }
}

final googleAuthApiProvider = Provider<GoogleAuthApi>((ref) {
  return GoogleAuthApi(ref.watch(dioProvider));
});
