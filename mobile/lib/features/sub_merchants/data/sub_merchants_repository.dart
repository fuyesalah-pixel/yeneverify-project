// Repository boundary for sub-merchant management so providers stay
// testable against a fake instead of a live Dio.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import 'models/invite_request.dart';
import 'models/invite_response.dart';
import 'models/sub_merchant_detail.dart';
import 'models/sub_merchant_summary.dart';
import 'sub_merchants_api.dart';

class SubMerchantsRepository {
  SubMerchantsRepository(this._api);

  final SubMerchantsApi _api;

  Future<ApiResult<SubMerchantPage>> list({int page = 1, int pageSize = 50}) =>
      _api.list(page: page, pageSize: pageSize);

  Future<ApiResult<InviteResponse>> invite(InviteRequest request) =>
      _api.invite(request);

  Future<ApiResult<InviteResponse>> resendInvite(String inviteId) =>
      _api.resendInvite(inviteId);

  Future<ApiResult<SubMerchantDetail>> getById(String id) => _api.getById(id);

  Future<ApiResult<void>> updateBranch(String id, String? branchLabel) =>
      _api.updateBranch(id, branchLabel);

  Future<ApiResult<void>> remove(String id) => _api.remove(id);
}

final subMerchantsRepositoryProvider = Provider<SubMerchantsRepository>(
  (ref) => SubMerchantsRepository(ref.watch(subMerchantsApiProvider)),
);
