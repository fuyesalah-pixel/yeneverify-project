// Mobile-only. Wraps the onboarding + sub-merchant invite endpoints.
// Contracts: backend/src/onboarding/* and backend/src/sub-merchants/*.
import 'package:dio/dio.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import 'models/create_merchant_request.dart';
import 'models/create_merchant_response.dart';

class OnboardingApi {
  OnboardingApi(this._dio);

  final Dio _dio;

  /// POST /onboarding/merchant (201).
  Future<ApiResult<CreateMerchantResponse>> createMerchant(
    CreateMerchantRequest request,
  ) {
    return _post<CreateMerchantResponse>(
      '/onboarding/merchant',
      data: request.toJson(),
      fromJson: CreateMerchantResponse.fromJson,
    );
  }

  /// POST /sub-merchants/accept (200) — Bearer required, token in body.
  Future<ApiResult<AcceptInviteResponse>> acceptInvite(String token) {
    return _post<AcceptInviteResponse>(
      '/sub-merchants/accept',
      data: {'token': token},
      fromJson: AcceptInviteResponse.fromJson,
    );
  }

  /// POST /sub-merchants/decline (200, public/token-only, idempotent).
  Future<ApiResult<bool>> declineInvite(String token) {
    return _post<bool>(
      '/sub-merchants/decline',
      data: {'token': token},
      fromJson: (json) => json['declined'] as bool? ?? true,
    );
  }

  Future<ApiResult<T>> _post<T>(
    String path, {
    required T Function(Map<String, dynamic>) fromJson,
    Map<String, dynamic>? data,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(method: 'POST'),
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
