import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/billing/presentation/screens/billing_screen.dart';

import 'billing_harness.dart';

void main() {
  testWidgets('lists the three paid packages for a FREE merchant',
      (tester) async {
    await pumpBilling(
      tester,
      const BillingScreen(),
      overrides: billingOverrides(packageCode: 'FREE'),
    );

    expect(find.text('Premium'), findsWidgets);
    expect(find.text('Business'), findsWidgets);
    expect(find.text('Business Pro'), findsOneWidget);
    expect(find.text('199.00 ETB'), findsOneWidget);
    expect(find.text('999.00 ETB'), findsOneWidget);
    expect(find.text('1,999.00 ETB'), findsOneWidget);
    expect(find.text('Choose'), findsNWidgets(3));
    expect(find.text('Payment history'), findsOneWidget);
    expect(find.text('Current plan'), findsOneWidget);
  });

  testWidgets('a BUSINESS merchant only sees the upgrade and no downgrades',
      (tester) async {
    await pumpBilling(
      tester,
      const BillingScreen(),
      overrides: billingOverrides(packageCode: 'BUSINESS'),
    );

    expect(find.text('Business Pro'), findsOneWidget);
    expect(find.text('Premium'), findsNothing);
    expect(find.text('Upgrade'), findsOneWidget);
    expect(find.text('Current plan'), findsWidgets);
    expect(find.text('Manage'), findsOneWidget);
    expect(find.text('40 credits left'), findsOneWidget);
    // The current plan itself is not a purchasable card.
    expect(find.text('Choose'), findsNothing);
  });

  testWidgets('a BUSINESS_PRO merchant sees no purchasable plans',
      (tester) async {
    await pumpBilling(
      tester,
      const BillingScreen(),
      overrides: billingOverrides(packageCode: 'BUSINESS_PRO'),
    );

    expect(find.text('No plans are available right now.'), findsOneWidget);
    expect(find.text('Current plan'), findsWidgets);
  });

  testWidgets('sub-merchants get the owner-only message', (tester) async {
    await pumpBilling(
      tester,
      const BillingScreen(),
      overrides: billingOverrides(role: 'SUB_MERCHANT'),
    );

    expect(
      find.text('Only the business owner can manage billing.'),
      findsOneWidget,
    );
    expect(find.text('Premium'), findsNothing);
  });
}
