// Mobile-only. Wraps the verification lifecycle used by the verify screen:
//
//   POST /verifications       → enqueue (202) + credit snapshot
//   GET  /verifications/:id   → poll status/result
//
// Retry / request-review are Part 2 concerns and live on the verdict screen.
import 'package:dio/dio.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import 'models/verification_result.dart';

class VerificationsApi {
  VerificationsApi(this._dio);

  final Dio _dio;

  /// Enqueues a TRANSACTION verification for a completed receipt upload.
  Future<ApiResult<VerificationSubmitted>> submit({
    required String receiptId,
    String source = 'TRANSACTION',
  }) async {
    return _request<VerificationSubmitted>(
      '/verifications',
      method: 'POST',
      data: {'receiptId': receiptId, 'source': source},
      fromJson: VerificationSubmitted.fromJson,
    );
  }

  Future<ApiResult<VerificationResult>> getById(String verificationId) async {
    return _request<VerificationResult>(
      '/verifications/$verificationId',
      method: 'GET',
      fromJson: VerificationResult.fromJson,
    );
  }

  Future<ApiResult<T>> _request<T>(
    String path, {
    required String method,
    required T Function(Map<String, dynamic>) fromJson,
    Map<String, dynamic>? data,
  }) async {
    try {
      final res = await _dio.request<Map<String, dynamic>>(
        path,
        data: data,
        options: Options(method: method),
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
