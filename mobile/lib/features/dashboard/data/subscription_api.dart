import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import 'models/subscription_me.dart';

/// GET /subscription/me — plan + credit balance.
class SubscriptionApi {
  SubscriptionApi(this._dio);

  final Dio _dio;

  Future<ApiResult<SubscriptionMe>> me() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/subscription/me');
      final body = res.data ?? const <String, dynamic>{};
      final payload = (body['data'] as Map<String, dynamic>?) ?? body;
      return Success(SubscriptionMe.fromJson(payload));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }
}

final subscriptionApiProvider = Provider<SubscriptionApi>(
  (ref) => SubscriptionApi(ref.watch(dioProvider)),
);
