// Dashboard data: one composite fetch, one AsyncNotifier.
//
// merchants/me is critical — without it there is no screen. Everything else
// is best effort: a failing analytics/subscription/list call becomes a null
// field so the rest of the dashboard still renders, and the UI marks it.
import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../verify/data/models/verification_summary.dart';
import '../../../verify/data/verify_repository.dart';
import '../../data/analytics_api.dart';
import '../../data/merchants_api.dart';
import '../../data/models/analytics_summary.dart';
import '../../data/models/analytics_trend.dart';
import '../../data/models/merchant_me.dart';
import '../../data/models/subscription_me.dart';
import '../../data/notifications_api.dart';
import '../../data/subscription_api.dart';

/// Ranges the dashboard can ask for. The backend accepts any `from`/`to`
/// pair up to 365 days, so these are just presets.
enum DashboardRange {
  d7(7),
  d30(30),
  d90(90),
  d365(365);

  const DashboardRange(this.days);

  final int days;

  DateTime fromNow(DateTime now) => now.subtract(Duration(days: days));
}

final dashboardRangeProvider = StateProvider<DashboardRange>(
  (ref) => DashboardRange.d30,
);

class DashboardData {
  const DashboardData({
    required this.merchant,
    this.summary,
    this.trend,
    this.subscription,
    this.recent = const [],
    this.unreadCount = 0,
  });

  final MerchantMe merchant;
  final AnalyticsSummary? summary;
  final AnalyticsTrend? trend;
  final SubscriptionMe? subscription;
  final List<VerificationSummary> recent;
  final int unreadCount;

  /// True when at least one non-critical call failed. The screen shows a
  /// quiet banner instead of pretending the zeros are real.
  bool get partial => summary == null || trend == null || subscription == null;

  int get creditsValue => subscription?.creditsValue ?? merchant.creditsValue;

  bool get unlimited => subscription?.unlimited ?? false;

  bool get lowBalance =>
      subscription?.lowBalance ?? creditsValue <= 5 && !unlimited;

  String get packageCode =>
      subscription?.packageCode ?? merchant.currentPackageCode ?? '';
}

class DashboardNotifier extends AsyncNotifier<DashboardData> {
  @override
  Future<DashboardData> build() {
    return _load(ref.watch(dashboardRangeProvider));
  }

  Future<void> refresh() async {
    ref.invalidateSelf();
    await ref.read(dashboardProvider.future);
  }

  Future<DashboardData> _load(DashboardRange range) async {
    final now = DateTime.now();
    final from = range.fromNow(now);

    final merchantResult = await ref.read(merchantsApiProvider).getMe();
    if (merchantResult is! Success<MerchantMe>) {
      throw merchantResult.errorOrNull ??
          const ApiError(message: 'Merchant unavailable');
    }

    final analytics = ref.read(analyticsApiProvider);
    final (summary, trend, subscription, unread, page) = await (
      analytics.summary(from: from, to: now),
      analytics.trend(from: from, to: now),
      ref.read(subscriptionApiProvider).me(),
      ref.read(notificationsApiProvider).unreadCount(),
      ref.read(verificationsApiProvider).list(pageSize: 5),
    ).wait;

    return DashboardData(
      merchant: merchantResult.data,
      summary: summary.dataOrNull,
      trend: trend.dataOrNull,
      subscription: subscription.dataOrNull,
      unreadCount: unread.dataOrNull ?? 0,
      recent: page.dataOrNull?.items ?? const [],
    );
  }
}

final dashboardProvider =
    AsyncNotifierProvider<DashboardNotifier, DashboardData>(
        DashboardNotifier.new);

/// Unread notifications, watched by the shell's badge. Separate from
/// [dashboardProvider] so the badge does not flash when a range changes.
final unreadCountProvider = FutureProvider<int>((ref) async {
  final result = await ref.watch(notificationsApiProvider).unreadCount();
  return result.dataOrNull ?? 0;
});
