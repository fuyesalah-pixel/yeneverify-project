// REST client for the merchant's verification bank accounts.
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../../core/network/dio_client.dart';
import 'models/verification_accounts.dart';

class VerificationAccountsApi {
  VerificationAccountsApi(this._dio);

  final Dio _dio;

  Future<ApiResult<VerificationAccounts>> get() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/merchants/me/verification-accounts',
      );
      return Success(VerificationAccounts.fromJson(_payload(res.data)));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }

  Future<ApiResult<VerificationAccounts>> update({
    required VerificationAccounts accounts,
    required String stepUpToken,
  }) async {
    try {
      final res = await _dio.put<Map<String, dynamic>>(
        '/merchants/me/verification-accounts',
        data: accounts.toPatch(),
        options: Options(headers: {'X-Step-Up-Token': stepUpToken}),
      );
      return Success(VerificationAccounts.fromJson(_payload(res.data)));
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }

  Map<String, dynamic> _payload(Map<String, dynamic>? body) {
    if (body == null) return const <String, dynamic>{};
    return (body['data'] as Map<String, dynamic>?) ?? body;
  }
}

final verificationAccountsApiProvider = Provider<VerificationAccountsApi>(
  (ref) => VerificationAccountsApi(ref.watch(dioProvider)),
);
