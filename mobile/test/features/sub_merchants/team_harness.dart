// Shared fakes + fixtures for the Step 24 team/profile tests.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';
import 'package:yene_verify/features/auth/data/models/auth_models.dart';
import 'package:yene_verify/features/dashboard/data/models/subscription_me.dart';
import 'package:yene_verify/features/dashboard/data/subscription_api.dart';
import 'package:yene_verify/features/sub_merchants/data/models/invite_request.dart';
import 'package:yene_verify/features/sub_merchants/data/models/invite_response.dart';
import 'package:yene_verify/features/sub_merchants/data/models/sub_merchant_detail.dart';
import 'package:yene_verify/features/sub_merchants/data/models/sub_merchant_summary.dart';
import 'package:yene_verify/features/sub_merchants/data/sub_merchants_api.dart';
import 'package:yene_verify/features/sub_merchants/data/sub_merchants_repository.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

SubMerchantSummary member(
  String id,
  String name, {
  String? branch,
  String phone = '+251*****11',
}) =>
    SubMerchantSummary(
      id: id,
      status: SubMerchantStatus.active,
      name: name,
      phone: phone,
      branchLabel: branch,
      joinedAt: DateTime(2026, 10, 1),
    );

SubMerchantSummary pendingInvite(
  String id, {
  String phone = '+251*****44',
}) =>
    SubMerchantSummary(
      id: id,
      status: SubMerchantStatus.invited,
      name: '',
      phone: phone,
      invitedAt: DateTime.now().subtract(const Duration(hours: 2)),
    );

SubMerchantPage teamPage(List<SubMerchantSummary> items) => SubMerchantPage(
      items: items,
      page: 1,
      pageSize: 50,
      total: items.length,
    );

class FakeSubscriptionApi extends SubscriptionApi {
  FakeSubscriptionApi(this.result) : super(Dio());
  final ApiResult<SubscriptionMe> result;

  @override
  Future<ApiResult<SubscriptionMe>> me() async => result;
}

ApiResult<SubscriptionMe> subscriptionFor(String packageCode) => Success(
      SubscriptionMe(
        packageCode: packageCode,
        packageName: packageCode,
        unlimited: packageCode == 'BUSINESS_PRO',
        creditsBalance: '40',
        lowBalance: false,
      ),
    );

class FakeTeamRepository extends SubMerchantsRepository {
  FakeTeamRepository({
    required this.page,
    this.detail,
    this.inviteResult,
    this.resendResult,
    this.removeResult,
    this.updateResult,
  }) : super(SubMerchantsApi(Dio()));

  SubMerchantPage page;
  SubMerchantDetail? detail;

  ApiResult<InviteResponse>? inviteResult;
  ApiResult<InviteResponse>? resendResult;
  ApiResult<void>? removeResult;
  ApiResult<void>? updateResult;

  int listCalls = 0;
  InviteRequest? lastInvite;
  String? lastResendId;
  String? removedId;
  String? lastBranchLabel;
  String? lastBranchTarget;

  @override
  Future<ApiResult<SubMerchantPage>> list({int page = 1, int pageSize = 50}) async {
    listCalls++;
    return Success(this.page);
  }

  @override
  Future<ApiResult<InviteResponse>> invite(InviteRequest request) async {
    lastInvite = request;
    return inviteResult ??
        const Success(InviteResponse(
          inviteId: 'inv-1',
          inviteUrl: 'https://app.yeneverify.test/invite/token',
          smsSent: false,
        ));
  }

  @override
  Future<ApiResult<InviteResponse>> resendInvite(String inviteId) async {
    lastResendId = inviteId;
    return resendResult ?? const Success(InviteResponse(smsSent: true));
  }

  @override
  Future<ApiResult<SubMerchantDetail>> getById(String id) async {
    final value = detail;
    if (value == null) {
      return const Failure(
        ApiError(code: 'SUB_MERCHANT_NOT_FOUND', httpStatus: 404),
      );
    }
    return Success(value);
  }

  @override
  Future<ApiResult<void>> remove(String id) async {
    removedId = id;
    return removeResult ?? const Success(null);
  }

  @override
  Future<ApiResult<void>> updateBranch(String id, String? branchLabel) async {
    lastBranchTarget = id;
    lastBranchLabel = branchLabel;
    return updateResult ?? const Success(null);
  }
}

List<Override> teamOverrides({
  required FakeTeamRepository repo,
  String packageCode = 'BUSINESS',
}) =>
    [
      subMerchantsRepositoryProvider.overrideWithValue(repo),
      subscriptionApiProvider.overrideWithValue(
        FakeSubscriptionApi(subscriptionFor(packageCode)),
      ),
    ];

User testUser() => const User(
      id: 'u1',
      phone: '+251911111111',
      fullName: 'Fikru Bekele',
      role: 'MERCHANT',
      status: 'ACTIVE',
      needsPinSetup: false,
      needsOnboarding: false,
    );

class FakeAuthNotifier extends AuthNotifier {
  FakeAuthNotifier(this.initial);

  final AuthState initial;
  bool loggedOut = false;

  @override
  Future<AuthState> build() async => initial;

  @override
  Future<void> logout() async {
    loggedOut = true;
    state = const AsyncData(AuthState(status: AuthStatus.unauthenticated));
  }
}

/// Real l10n + theme, in a ProviderScope, so ConsumerScreens can be pumped
/// without booting the router.
Widget teamTestApp(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: AppTheme.lightTheme(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      // Scaffold supplies the Material ancestor that InkWell rows need when
      // a bare widget (not a screen) is under test.
      home: Scaffold(body: child),
    ),
  );
}

/// Pumps a widget and settles the async provider work.
Future<void> pumpTeam(WidgetTester tester, Widget child,
    {List<Override> overrides = const []}) async {
  // Tall surface so long lists (Profile sections) build their rows without
  // the test having to scroll for every assertion.
  tester.view.physicalSize = const Size(1000, 3200);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(teamTestApp(child, overrides: overrides));
  await tester.pumpAndSettle();
}
