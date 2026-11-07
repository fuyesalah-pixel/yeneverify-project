// POST /billing/initiate | /billing/submit, GET /billing/:id | /billing
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import 'models/billing_session.dart';
import 'models/billing_verification.dart';

class BillingApi {
  BillingApi(this._dio);

  final Dio _dio;

  Future<ApiResult<BillingSession>> initiate(String packageCode) async {
    return _request<BillingSession>(
      '/billing/initiate',
      method: 'POST',
      data: {'packageCode': packageCode},
      fromJson: BillingSession.fromJson,
    );
  }

  Future<ApiResult<BillingSubmitted>> submit({
    required String billingSessionId,
    required String receiptId,
  }) async {
    return _request<BillingSubmitted>(
      '/billing/submit',
      method: 'POST',
      data: {
        'billingSessionId': billingSessionId,
        'receiptId': receiptId,
      },
      fromJson: BillingSubmitted.fromJson,
    );
  }

  Future<ApiResult<BillingVerification>> getById(String billingId) async {
    return _request<BillingVerification>(
      '/billing/$billingId',
      method: 'GET',
      fromJson: BillingVerification.fromJson,
    );
  }

  Future<ApiResult<BillingPage>> list({int page = 1, int pageSize = 20}) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/billing',
        queryParameters: {'page': page, 'pageSize': pageSize},
      );
      final body = res.data ?? const <String, dynamic>{};
      final inner = body['data'];
      final payload = inner is Map<String, dynamic> ? inner : body;
      return Success(BillingPage.fromJson(payload));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
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

final billingApiProvider = Provider<BillingApi>(
  (ref) => BillingApi(ref.watch(dioProvider)),
);
