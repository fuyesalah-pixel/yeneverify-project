// Team list state: active members + pending invites, plus the plan seat cap.
//
// Every mutation refreshes the list from the server — the backend owns
// ordering (invites first), masking and the seat count.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../dashboard/data/subscription_api.dart';
import '../../data/models/invite_request.dart';
import '../../data/models/invite_response.dart';
import '../../data/models/sub_merchant_detail.dart';
import '../../data/models/sub_merchant_summary.dart';
import '../../data/sub_merchants_repository.dart';
import '../../domain/plan_limits.dart';

class SubMerchantsState {
  const SubMerchantsState({
    required this.items,
    required this.packageCode,
    this.total = 0,
  });

  final List<SubMerchantSummary> items;
  final String packageCode;
  final int total;

  List<SubMerchantSummary> get members =>
      items.where((item) => !item.isInvite).toList(growable: false);

  List<SubMerchantSummary> get invites =>
      items.where((item) => item.isInvite).toList(growable: false);

  bool get isEmpty => items.isEmpty;

  /// Seats the backend counts against the cap: ACTIVE + INVITED memberships.
  int get usedSeats => items
      .where((item) =>
          item.status == SubMerchantStatus.active ||
          item.status == SubMerchantStatus.invited ||
          item.status == SubMerchantStatus.suspended)
      .length;

  PlanCap get cap => PlanCap(packageCode: packageCode, used: usedSeats);
}

class SubMerchantsNotifier extends AsyncNotifier<SubMerchantsState> {
  @override
  Future<SubMerchantsState> build() async {
    return _load();
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await ref.read(subMerchantsProvider.future);
  }

  /// Sends an invite. On success the list is refreshed so the pending
  /// invite shows up immediately.
  Future<ApiResult<InviteResponse>> invite(InviteRequest request) async {
    final result = await ref.read(subMerchantsRepositoryProvider).invite(request);
    if (result is Success<InviteResponse>) {
      await refresh();
    }
    return result;
  }

  Future<ApiError?> resendInvite(String inviteId) async {
    final result =
        await ref.read(subMerchantsRepositoryProvider).resendInvite(inviteId);
    switch (result) {
      case Success<InviteResponse>():
        await refresh();
        return null;
      case Failure<InviteResponse>(:final error):
        return error;
    }
  }

  Future<ApiError?> updateBranch(String id, String? branchLabel) async {
    final result = await ref
        .read(subMerchantsRepositoryProvider)
        .updateBranch(id, branchLabel);
    switch (result) {
      case Success<void>():
        await refresh();
        return null;
      case Failure<void>(:final error):
        return error;
    }
  }

  Future<ApiError?> remove(String id) async {
    final result = await ref.read(subMerchantsRepositoryProvider).remove(id);
    switch (result) {
      case Success<void>():
        await refresh();
        return null;
      case Failure<void>(:final error):
        return error;
    }
  }

  Future<SubMerchantsState> _load() async {
    final pageResult =
        await ref.read(subMerchantsRepositoryProvider).list(pageSize: 100);
    if (pageResult is! Success<SubMerchantPage>) {
      throw pageResult.errorOrNull ?? const ApiError();
    }

    // The cap is a nice-to-have banner: a failed subscription call must not
    // take the team list down with it.
    final subscription = await ref.read(subscriptionApiProvider).me();

    return SubMerchantsState(
      items: pageResult.data.items,
      total: pageResult.data.total,
      packageCode: subscription.dataOrNull?.packageCode ?? '',
    );
  }
}

final subMerchantsProvider =
    AsyncNotifierProvider<SubMerchantsNotifier, SubMerchantsState>(
  SubMerchantsNotifier.new,
);

/// Detail for one team member (refetched by id).
final subMerchantDetailProvider =
    FutureProvider.family<SubMerchantDetail?, String>((ref, id) async {
  final result = await ref.watch(subMerchantsRepositoryProvider).getById(id);
  return result.dataOrNull;
});
