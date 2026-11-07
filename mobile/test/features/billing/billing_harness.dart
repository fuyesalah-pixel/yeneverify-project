// Fakes + fixtures for the Step 25 billing tests.
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/auth/data/models/auth_models.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';
import 'package:yene_verify/features/billing/data/billing_api.dart';
import 'package:yene_verify/features/billing/data/billing_receipt_uploader.dart';
import 'package:yene_verify/features/billing/data/models/billing_session.dart';
import 'package:yene_verify/features/billing/data/models/billing_verification.dart';
import 'package:yene_verify/features/billing/data/models/package.dart';
import 'package:yene_verify/features/billing/data/packages_api.dart';
import 'package:yene_verify/features/dashboard/data/subscription_api.dart';
import 'package:yene_verify/features/verify/data/receipts_api.dart';
import 'package:yene_verify/features/verify/domain/image_prep.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../sub_merchants/team_harness.dart';

// ── API fakes ───────────────────────────────────────────────────────────────

class FakePackagesApi extends PackagesApi {
  FakePackagesApi(this.packages) : super(Dio());

  final List<Package> packages;

  @override
  Future<ApiResult<List<Package>>> list() async => Success(packages);
}

class FakeBillingApi extends BillingApi {
  FakeBillingApi({
    required this.session,
    this.detail,
    this.page,
    this.failure,
  }) : super(Dio());

  BillingSession session;
  BillingVerification? detail;
  BillingPage? page;
  ApiError? failure;

  int initiateCalls = 0;
  int submitCalls = 0;
  int detailCalls = 0;
  String? lastPackageCode;
  String? lastSessionId;
  String? lastReceiptId;

  @override
  Future<ApiResult<BillingSession>> initiate(String packageCode) async {
    initiateCalls++;
    lastPackageCode = packageCode;
    if (failure != null) return Failure(failure!);
    return Success(session);
  }

  @override
  Future<ApiResult<BillingSubmitted>> submit({
    required String billingSessionId,
    required String receiptId,
  }) async {
    submitCalls++;
    lastSessionId = billingSessionId;
    lastReceiptId = receiptId;
    if (failure != null) return Failure(failure!);
    return Success(
      BillingSubmitted(
        billingVerificationId: billingSessionId,
        verificationId: 'v-queued',
      ),
    );
  }

  @override
  Future<ApiResult<BillingVerification>> getById(String billingId) async {
    detailCalls++;
    final value = detail;
    if (value == null) {
      return const Failure(
        ApiError(code: 'BILLING_NOT_FOUND', httpStatus: 404),
      );
    }
    return Success(value);
  }

  @override
  Future<ApiResult<BillingPage>> list({
    int page = 1,
    int pageSize = 20,
  }) async {
    return Success(
      this.page ??
          BillingPage(
            items: const [],
            page: page,
            pageSize: pageSize,
            total: 0,
            totalPages: 0,
          ),
    );
  }
}

class FakeUploader extends BillingReceiptUploader {
  FakeUploader({this.failure})
      : super(receipts: ReceiptsApi(Dio()), imagePrep: ImagePrep());

  ApiError? failure;

  int prepareCalls = 0;
  int uploadCalls = 0;
  InputMethod? lastInputMethod;

  @override
  Future<PreparedImage> prepare(File file) async {
    prepareCalls++;
    return PreparedImage(
      bytes: Uint8List.fromList([1, 2, 3]),
      size: 3,
      sha256: 'abc',
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
    );
  }

  @override
  Future<ApiResult<String>> upload(
    PreparedImage image, {
    required InputMethod inputMethod,
    void Function(double progress)? onProgress,
  }) async {
    uploadCalls++;
    lastInputMethod = inputMethod;
    onProgress?.call(1);
    if (failure != null) return Failure(failure!);
    return const Success('receipt-1');
  }
}

// ── fixtures ────────────────────────────────────────────────────────────────

Package plan(
  String code, {
  String? priceMinor,
  int displayOrder = 1,
  bool unlimited = false,
  int? creditsPerMonth = 40,
  bool isCustom = false,
  String? name,
}) {
  return Package(
    code: code,
    name: name ?? packageNameForTest(code),
    priceMinor: priceMinor,
    creditsPerMonth: creditsPerMonth,
    unlimited: unlimited,
    isCustom: isCustom,
    displayOrder: displayOrder,
  );
}

final defaultPlans = <Package>[
  plan('FREE', displayOrder: 0, creditsPerMonth: 10),
  plan('PREMIUM', priceMinor: '19900', displayOrder: 1, unlimited: true),
  plan('BUSINESS', priceMinor: '99900', displayOrder: 2, creditsPerMonth: 400),
  plan(
    'BUSINESS_PRO',
    priceMinor: '199900',
    displayOrder: 3,
    unlimited: true,
    creditsPerMonth: null,
  ),
  plan('API', displayOrder: 4, isCustom: true, creditsPerMonth: null),
];

/// Local copy so fixtures do not depend on the l10n-backed display helper.
String packageNameForTest(String code) => switch (code) {
      'FREE' => 'Free',
      'PREMIUM' => 'Premium',
      'BUSINESS' => 'Business',
      'BUSINESS_PRO' => 'Business Pro',
      'API' => 'API',
      _ => code,
    };

BillingSession sessionFor(
  String code, {
  int amountMinor = 99900,
  String name = 'Business',
}) {
  return BillingSession(
    billingSessionId: 'session-1',
    packageCode: code,
    packageName: name,
    expectedAmountMinor: '$amountMinor',
    currency: 'ETB',
    instructions: const PaymentInstructions(
      cbeAccountNumber: '1000123456789',
      cbeAccountName: 'Yene Verify PLC',
      telebirrPhoneNumber: '+251900000000',
      telebirrAccountName: 'Yene Verify PLC',
      note: 'Use the reference shown in your bank app.',
    ),
  );
}

BillingVerification detailWith(
  BillingStatus status, {
  String packageCode = 'BUSINESS',
  String? submittedAmountMinor = '99900',
}) {
  return BillingVerification(
    id: 'b1',
    packageCode: packageCode,
    expectedAmountMinor: '99900',
    submittedAmountMinor: submittedAmountMinor,
    status: status,
    bankReference: 'FT26ABC123',
    createdAt: DateTime(2026, 11, 4, 10, 30),
  );
}

User userWithRole(String role) => User(
      id: 'u1',
      phone: '+251911111111',
      fullName: 'Fikru Bekele',
      role: role,
      status: 'ACTIVE',
      needsPinSetup: false,
      needsOnboarding: false,
    );

List<Override> billingOverrides({
  FakePackagesApi? packages,
  FakeBillingApi? api,
  FakeUploader? uploader,
  String packageCode = 'FREE',
  String role = 'MERCHANT',
}) {
  return [
    authProvider.overrideWith(
      () => FakeAuthNotifier(
        AuthState(status: AuthStatus.unlocked, user: userWithRole(role)),
      ),
    ),
    packagesApiProvider.overrideWithValue(
      packages ?? FakePackagesApi(defaultPlans),
    ),
    subscriptionApiProvider.overrideWithValue(
      FakeSubscriptionApi(subscriptionFor(packageCode)),
    ),
    if (api != null) billingApiProvider.overrideWithValue(api),
    if (uploader != null)
      billingReceiptUploaderProvider.overrideWithValue(uploader),
  ];
}

Widget billingTestApp(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      theme: AppTheme.lightTheme(),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: child,
    ),
  );
}

Future<void> pumpBilling(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
}) async {
  tester.view.physicalSize = const Size(1000, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(billingTestApp(child, overrides: overrides));
  await tester.pumpAndSettle();
}
