// REST client for /sub-merchants (merchant side).
//
// Endpoints: list, invite, resend invite, detail, patch branch label, remove.
// The backend masks phone numbers; this layer never sees raw numbers.
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import 'models/invite_request.dart';
import 'models/invite_response.dart';
import 'models/sub_merchant_detail.dart';
import 'models/sub_merchant_summary.dart';

class SubMerchantsApi {
  SubMerchantsApi(this._dio);

  final Dio _dio;

  Future<ApiResult<SubMerchantPage>> list({
    String? status,
    int page = 1,
    int pageSize = 50,
  }) {
    return _guard(() async {
      final res = await _dio.get<Map<String, dynamic>>(
        '/sub-merchants',
        queryParameters: {
          'page': page,
          'pageSize': pageSize,
          if (status != null) 'status': status,
        },
      );
      return SubMerchantPage.fromJson(_payload(res.data));
    });
  }

  Future<ApiResult<InviteResponse>> invite(InviteRequest request) {
    return _guard(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        '/sub-merchants/invite',
        data: request.toJson(),
      );
      return InviteResponse.fromJson(_payload(res.data));
    });
  }

  Future<ApiResult<InviteResponse>> resendInvite(String inviteId) {
    return _guard(() async {
      final res = await _dio.post<Map<String, dynamic>>(
        '/sub-merchants/invites/$inviteId/resend',
      );
      return InviteResponse.fromJson(_payload(res.data));
    });
  }

  Future<ApiResult<SubMerchantDetail>> getById(String id) {
    return _guard(() async {
      final res = await _dio.get<Map<String, dynamic>>('/sub-merchants/$id');
      return SubMerchantDetail.fromJson(_payload(res.data));
    });
  }

  Future<ApiResult<void>> updateBranch(String id, String? branchLabel) {
    return _guard(() async {
      await _dio.patch<Map<String, dynamic>>(
        '/sub-merchants/$id',
        data: {'branchLabel': branchLabel},
      );
    });
  }

  Future<ApiResult<void>> remove(String id) {
    return _guard(() async {
      await _dio.delete<Map<String, dynamic>>('/sub-merchants/$id');
    });
  }

  Future<ApiResult<T>> _guard<T>(Future<T> Function() call) async {
    try {
      return Success(await call());
    } on DioException catch (e) {
      return Failure(apiErrorFromDio(e));
    } catch (e) {
      return Failure(ApiError(message: e.toString()));
    }
  }

  /// The response may be wrapped once (`{success, data}`) or returned flat.
  Map<String, dynamic> _payload(Map<String, dynamic>? body) {
    final raw = body ?? const <String, dynamic>{};
    final data = raw['data'];
    return data is Map ? Map<String, dynamic>.from(data) : raw;
  }
}

final subMerchantsApiProvider = Provider<SubMerchantsApi>(
  (ref) => SubMerchantsApi(ref.watch(dioProvider)),
);
