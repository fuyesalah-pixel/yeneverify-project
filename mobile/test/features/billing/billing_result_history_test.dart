import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/billing/data/models/billing_verification.dart';
import 'package:yene_verify/features/billing/presentation/screens/billing_history_screen.dart';
import 'package:yene_verify/features/billing/presentation/screens/billing_result_screen.dart';

import 'billing_harness.dart';

Future<void> pumpResult(
  WidgetTester tester,
  BillingStatus status, {
  bool readOnly = false,
}) async {
  final api = FakeBillingApi(
    session: sessionFor('BUSINESS'),
    detail: detailWith(status),
  );

  await pumpBilling(
    tester,
    BillingResultScreen(billingId: 'b1', readOnly: readOnly),
    overrides: billingOverrides(api: api, packageCode: 'BUSINESS'),
  );
}

void main() {
  testWidgets('approved: verified hero, activation and start-using CTA',
      (tester) async {
    await pumpResult(tester, BillingStatus.approved);

    expect(find.text('Payment verified'), findsOneWidget);
    expect(find.text('Business activated'), findsOneWidget);
    expect(find.text('+400 verifications'), findsOneWidget);
    expect(find.text('Start using your credits'), findsOneWidget);
    expect(find.text('999.00 ETB'), findsWidgets);
    expect(find.text('FT26ABC123'), findsOneWidget);
  });

  testWidgets('approved read-only from history hides the flow CTA',
      (tester) async {
    await pumpResult(tester, BillingStatus.approved, readOnly: true);

    expect(find.text('Payment verified'), findsOneWidget);
    expect(find.text('Start using your credits'), findsNothing);
    expect(find.text('View history'), findsOneWidget);
  });

  testWidgets('pending: verification-in-progress copy and history CTA',
      (tester) async {
    final api = FakeBillingApi(
      session: sessionFor('BUSINESS'),
      detail: detailWith(BillingStatus.pending),
    );

    await tester.pumpWidget(
      billingTestApp(
        const BillingResultScreen(billingId: 'b1'),
        overrides: billingOverrides(api: api, packageCode: 'BUSINESS'),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Verification in progress'), findsOneWidget);
    expect(find.text('Check billing history'), findsOneWidget);

    // Dispose the screen so the polling timer is cancelled before teardown.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('amount mismatch: under-review state', (tester) async {
    await pumpResult(tester, BillingStatus.mismatch);

    expect(find.text('Payment under review'), findsOneWidget);
    expect(find.text('View history'), findsOneWidget);
    expect(find.text('Start using your credits'), findsNothing);
  });

  testWidgets('fake receipt: declined with retry + support', (tester) async {
    await pumpResult(tester, BillingStatus.fake);

    expect(find.text('Payment not verified'), findsOneWidget);
    expect(find.text("The receipt couldn't be verified."), findsOneWidget);
    expect(find.text('Try again'), findsWidgets);
    expect(find.text('Contact support'), findsOneWidget);
  });

  testWidgets('duplicate receipt: duplicate-specific reason', (tester) async {
    await pumpResult(tester, BillingStatus.duplicate);

    expect(find.text('Payment not verified'), findsOneWidget);
    expect(find.text('This receipt was already used.'), findsOneWidget);
  });

  testWidgets('history lists attempts with amount, date and status',
      (tester) async {
    final api = FakeBillingApi(
      session: sessionFor('BUSINESS'),
      detail: detailWith(BillingStatus.approved),
      page: BillingPage(
        items: [
          BillingSummary(
            id: 'b1',
            packageCode: 'BUSINESS',
            expectedAmountMinor: '99900',
            status: BillingStatus.approved,
            createdAt: DateTime(2026, 11, 4),
          ),
          BillingSummary(
            id: 'b2',
            packageCode: 'PREMIUM',
            expectedAmountMinor: '19900',
            status: BillingStatus.fake,
            createdAt: DateTime(2026, 11, 1),
          ),
        ],
        page: 1,
        pageSize: 50,
        total: 2,
        totalPages: 1,
      ),
    );

    await pumpBilling(
      tester,
      const BillingHistoryScreen(),
      overrides: billingOverrides(api: api),
    );

    expect(find.text('Business'), findsOneWidget);
    expect(find.text('Premium'), findsOneWidget);
    expect(find.text('999.00 ETB · 4 Nov 2026'), findsOneWidget);
    expect(find.text('Approved'), findsOneWidget);
    expect(find.text('Fake'), findsOneWidget);
  });

  testWidgets('history empty state', (tester) async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));

    await pumpBilling(
      tester,
      const BillingHistoryScreen(),
      overrides: billingOverrides(api: api),
    );

    expect(find.text('No billing history yet'), findsOneWidget);
  });
}
