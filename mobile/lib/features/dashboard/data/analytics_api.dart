import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import 'models/analytics_summary.dart';
import 'models/analytics_trend.dart';

/// /analytics/* — MERCHANT-only. A sub-merchant token gets 403, which the
/// dashboard treats as "insights unavailable" rather than an error.
///
/// `from`/`to` are optional: the backend defaults to the last 30 days and
/// rejects ranges longer than 365 days.
class AnalyticsApi {
  AnalyticsApi(this._dio);

  final Dio _dio;

  Future<ApiResult<AnalyticsSummary>> summary({
    DateTime? from,
    DateTime? to,
  }) {
    return _request(
      '/analytics/summary',
      from: from,
      to: to,
      fromJson: AnalyticsSummary.fromJson,
    );
  }

  Future<ApiResult<AnalyticsTrend>> trend({
    DateTime? from,
    DateTime? to,
  }) {
    return _request(
      '/analytics/trend',
      from: from,
      to: to,
      fromJson: AnalyticsTrend.fromJson,
    );
  }

  Future<ApiResult<T>> _request<T>(
    String path, {
    DateTime? from,
    DateTime? to,
    required T Function(Map<String, dynamic>) fromJson,
  }) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: {
          if (from != null) 'from': from.toUtc().toIso8601String(),
          if (to != null) 'to': to.toUtc().toIso8601String(),
        },
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

final analyticsApiProvider = Provider<AnalyticsApi>(
  (ref) => AnalyticsApi(ref.watch(dioProvider)),
);
