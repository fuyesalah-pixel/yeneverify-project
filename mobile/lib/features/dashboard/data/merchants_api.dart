import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import 'models/merchant_me.dart';

/// GET /merchants/me. Critical for the dashboard: everything else is
/// decoration on top of the merchant identity.
class MerchantsApi {
  MerchantsApi(this._dio);

  final Dio _dio;

  Future<ApiResult<MerchantMe>> getMe() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/merchants/me');
      final body = res.data ?? const <String, dynamic>{};
      final payload = (body['data'] as Map<String, dynamic>?) ?? body;
      return Success(MerchantMe.fromJson(payload));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }
}

final merchantsApiProvider = Provider<MerchantsApi>(
  (ref) => MerchantsApi(ref.watch(dioProvider)),
);
