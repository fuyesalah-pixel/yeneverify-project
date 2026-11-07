import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/features/billing/presentation/screens/checkout_screen.dart';

import 'billing_harness.dart';

void main() {
  testWidgets('step 1 shows the amount, both payment methods and copy',
      (tester) async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));

    await pumpBilling(
      tester,
      CheckoutScreen(session: sessionFor('BUSINESS')),
      overrides: billingOverrides(api: api),
    );

    expect(find.text('Pay for Business'), findsWidgets);
    expect(
      find.text('Pay 999.00 ETB to activate your plan'),
      findsOneWidget,
    );
    expect(find.text('CBE'), findsOneWidget);
    expect(find.text('1000123456789'), findsOneWidget);
    expect(find.text('Telebirr'), findsOneWidget);
    expect(find.text('+251900000000'), findsOneWidget);
    expect(find.text('Yene Verify PLC'), findsNWidgets(2));
    expect(find.text("I've paid"), findsOneWidget);
  });

  testWidgets('I have paid reveals the two upload cards', (tester) async {
    final api = FakeBillingApi(session: sessionFor('BUSINESS'));

    await pumpBilling(
      tester,
      CheckoutScreen(session: sessionFor('BUSINESS')),
      overrides: billingOverrides(api: api),
    );

    await tester.tap(find.text("I've paid"));
    await tester.pumpAndSettle();

    expect(find.text('Take Photo'), findsOneWidget);
    expect(find.text('Upload Image'), findsOneWidget);
    expect(find.text('Submit for verification'), findsOneWidget);

    // Disabled until an image is selected.
    final submit = tester.widget<ElevatedButton>(
      find.widgetWithText(ElevatedButton, 'Submit for verification'),
    );
    expect(submit.onPressed, isNull);
  });

  testWidgets('a missing session renders the expired state', (tester) async {
    await pumpBilling(
      tester,
      const CheckoutScreen(session: null),
      overrides: billingOverrides(),
    );

    expect(
      find.text(
        'This checkout session has expired. Start again from Billing.',
      ),
      findsOneWidget,
    );
    expect(find.text('Back'), findsOneWidget);
  });

  testWidgets('an initiate failure renders an error with a retry',
      (tester) async {
    final api = FakeBillingApi(
      session: sessionFor('BUSINESS'),
      failure: const ApiError(
        code: 'BILLING_PACKAGE_NOT_PURCHASABLE',
        httpStatus: 400,
      ),
    );

    await pumpBilling(
      tester,
      CheckoutScreen(session: sessionFor('BUSINESS')),
      overrides: billingOverrides(api: api),
    );

    expect(find.text('Try again'), findsWidgets);
  });
}
