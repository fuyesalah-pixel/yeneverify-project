// GET /packages — public catalog. No auth needed, but the shared Dio is
// harmless here (it only attaches a token when a session exists).
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import 'models/package.dart';

class PackagesApi {
  PackagesApi(this._dio);

  final Dio _dio;

  Future<ApiResult<List<Package>>> list() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>('/packages');
      final body = res.data ?? const <String, dynamic>{};
      final raw = body['data'];
      final list = raw is List ? raw : const [];
      return Success(
        list
            .whereType<Map>()
            .map((e) => Package.fromJson(Map<String, dynamic>.from(e)))
            .toList(growable: false),
      );
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }
}

final packagesApiProvider = Provider<PackagesApi>(
  (ref) => PackagesApi(ref.watch(dioProvider)),
);
