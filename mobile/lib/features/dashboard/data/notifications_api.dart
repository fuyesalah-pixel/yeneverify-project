import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';

/// GET /notifications/unread-count — scoped to the signed-in USER, so it is
/// the one dashboard call a sub-merchant can always make.
class NotificationsApi {
  NotificationsApi(this._dio);

  final Dio _dio;

  Future<ApiResult<int>> unreadCount() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/notifications/unread-count',
      );
      final body = res.data ?? const <String, dynamic>{};
      final payload = (body['data'] as Map<String, dynamic>?) ?? body;
      return Success((payload['count'] as num?)?.toInt() ?? 0);
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }
}

final notificationsApiProvider = Provider<NotificationsApi>(
  (ref) => NotificationsApi(ref.watch(dioProvider)),
);
