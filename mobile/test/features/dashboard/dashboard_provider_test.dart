import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/dashboard/data/analytics_api.dart';
import 'package:yene_verify/features/dashboard/data/merchants_api.dart';
import 'package:yene_verify/features/dashboard/data/models/analytics_summary.dart';
import 'package:yene_verify/features/dashboard/data/models/analytics_trend.dart';
import 'package:yene_verify/features/dashboard/data/models/merchant_me.dart';
import 'package:yene_verify/features/dashboard/data/models/subscription_me.dart';
import 'package:yene_verify/features/dashboard/data/notifications_api.dart';
import 'package:yene_verify/features/dashboard/data/subscription_api.dart';
import 'package:yene_verify/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/data/models/verification_summary.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';
import 'package:yene_verify/features/verify/data/verify_repository.dart';

MerchantMe testMerchant() => const MerchantMe(
      id: 'm1',
      businessName: 'Diag Mart',
      status: 'ACTIVE',
      creditsBalance: '42',
      currentPackageCode: 'BUSINESS',
    );

AnalyticsSummary testSummary() => const AnalyticsSummary(
      days: 30,
      count: 12,
      amountMinor: '5500000',
      avgAmountMinor: '458333',
      uniqueSenders: 9,
      uniqueSubMerchants: 2,
    );

AnalyticsTrend testTrend() => const AnalyticsTrend(
      currentCount: 12,
      currentAmountMinor: '5500000',
      previousCount: 10,
      previousAmountMinor: '4900000',
      direction: 'up',
      countPct: 20,
      amountPct: 12.2,
    );

SubscriptionMe testSubscription() => const SubscriptionMe(
      packageCode: 'BUSINESS',
      packageName: 'Business',
      unlimited: false,
      creditsBalance: '42',
      lowBalance: false,
    );

VerificationPage testPage() => VerificationPage(
      items: [
        VerificationSummary(
          id: 'v1',
          status: VerificationStatus.verified,
          bankCode: 'CBE',
          amountMinor: '550000',
          createdAt: DateTime(2026, 11, 1),
        ),
      ],
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
    );

class FakeMerchantsApi extends MerchantsApi {
  FakeMerchantsApi(this.result) : super(Dio());
  final ApiResult<MerchantMe> result;

  @override
  Future<ApiResult<MerchantMe>> getMe() async => result;
}

class FakeAnalyticsApi extends AnalyticsApi {
  FakeAnalyticsApi({required this.summaryResult, required this.trendResult})
      : super(Dio());

  final ApiResult<AnalyticsSummary> summaryResult;
  final ApiResult<AnalyticsTrend> trendResult;

  @override
  Future<ApiResult<AnalyticsSummary>> summary({
    DateTime? from,
    DateTime? to,
  }) async =>
      summaryResult;

  @override
  Future<ApiResult<AnalyticsTrend>> trend({
    DateTime? from,
    DateTime? to,
  }) async =>
      trendResult;
}

class FakeSubscriptionApi extends SubscriptionApi {
  FakeSubscriptionApi(this.result) : super(Dio());
  final ApiResult<SubscriptionMe> result;

  @override
  Future<ApiResult<SubscriptionMe>> me() async => result;
}

class FakeNotificationsApi extends NotificationsApi {
  FakeNotificationsApi(this.count) : super(Dio());
  final int count;

  @override
  Future<ApiResult<int>> unreadCount() async => Success(count);
}

class FakeVerificationsApi extends VerificationsApi {
  FakeVerificationsApi(this.page) : super(Dio());
  final VerificationPage page;
  int listCalls = 0;

  @override
  Future<ApiResult<VerificationPage>> list({
    int page = 1,
    int pageSize = 20,
    String? status,
    String? bankCode,
    DateTime? from,
    DateTime? to,
    String? search,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    listCalls++;
    return Success(this.page);
  }
}

List<Override> dashboardOverrides({
  ApiResult<MerchantMe>? merchant,
  ApiResult<AnalyticsSummary>? summary,
  ApiResult<AnalyticsTrend>? trend,
  ApiResult<SubscriptionMe>? subscription,
  int unread = 3,
  VerificationPage? page,
}) {
  return [
    merchantsApiProvider.overrideWithValue(
      FakeMerchantsApi(merchant ?? Success(testMerchant())),
    ),
    analyticsApiProvider.overrideWithValue(
      FakeAnalyticsApi(
        summaryResult: summary ?? Success(testSummary()),
        trendResult: trend ?? Success(testTrend()),
      ),
    ),
    subscriptionApiProvider.overrideWithValue(
      FakeSubscriptionApi(subscription ?? Success(testSubscription())),
    ),
    notificationsApiProvider.overrideWithValue(FakeNotificationsApi(unread)),
    verificationsApiProvider.overrideWithValue(
      FakeVerificationsApi(page ?? testPage()),
    ),
  ];
}

void main() {
  test('composes merchant, analytics, subscription, unread and recent',
      () async {
    final container = ProviderContainer(overrides: dashboardOverrides());
    addTearDown(container.dispose);

    final data = await container.read(dashboardProvider.future);

    expect(data.merchant.businessName, 'Diag Mart');
    expect(data.summary?.count, 12);
    expect(data.summary?.amountValue, 5500000);
    expect(data.trend?.amountPct, 12.2);
    expect(data.subscription?.packageCode, 'BUSINESS');
    expect(data.creditsValue, 42);
    expect(data.unreadCount, 3);
    expect(data.recent.single.id, 'v1');
    expect(data.partial, isFalse);
  });

  test('the range preset decides the analytics window', () async {
    final container = ProviderContainer(overrides: dashboardOverrides());
    addTearDown(container.dispose);

    await container.read(dashboardProvider.future);
    container.read(dashboardRangeProvider.notifier).state = DashboardRange.d7;
    final data = await container.read(dashboardProvider.future);

    expect(data.summary, isNotNull);
  });
}
