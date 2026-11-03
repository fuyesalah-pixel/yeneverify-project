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
import 'models/verification_summary.dart';

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

  /// Lists the tenant's verifications, newest first by default.
  ///
  /// The page envelope nests once deeper than the other endpoints
  /// (`data.data`), so the payload is unwrapped here rather than in the
  /// model.
  Future<ApiResult<VerificationPage>> list({
    int page = 1,
    int pageSize = 20,
    String? status,
    String? bankCode,
    DateTime? from,
    DateTime? to,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/verifications',
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
          'sortBy': sortBy,
          'sortOrder': sortOrder,
          if (status != null && status.isNotEmpty) 'status': status,
          if (bankCode != null && bankCode.isNotEmpty) 'bankCode': bankCode,
          if (from != null) 'from': from.toUtc().toIso8601String(),
          if (to != null) 'to': to.toUtc().toIso8601String(),
        },
      );
      final body = res.data ?? const <String, dynamic>{};
      final inner = body['data'];
      final payload = inner is Map<String, dynamic> ? inner : body;
      return Success(VerificationPage.fromJson(payload));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
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
