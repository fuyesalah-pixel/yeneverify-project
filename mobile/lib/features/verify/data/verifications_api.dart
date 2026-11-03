// Mobile-only. Wraps the verification lifecycle used by the verify screen:
//
//   POST /verifications                  → enqueue (202) + credit snapshot
//   GET  /verifications/:id              → poll status/result
//   POST /verifications/:id/request-review → escalate a disputed verdict
//
// Retry is not an API call: it re-runs the local pick/upload pipeline.
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

  /// Escalates a verdict to a human reviewer ("Report a problem").
  ///
  /// MERCHANT only — a sub-merchant token gets AUTH_FORBIDDEN, which the
  /// report sheet surfaces through [ApiErrorX.userFacingMessage].
  Future<ApiResult<ReviewRequested>> requestReview(
    String verificationId, {
    required String reason,
  }) async {
    return _request<ReviewRequested>(
      '/verifications/$verificationId/request-review',
      method: 'POST',
      data: {'reason': reason},
      fromJson: ReviewRequested.fromJson,
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
