import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/dashboard/presentation/widgets/quick_actions_section.dart';

import '../dashboard_harness.dart';

Widget _section({VoidCallback? onVerify, VoidCallback? onTransactions}) {
  return dashboardTestApp(
    QuickActionsSection(
      verifyTitle: 'Verify a payment',
      verifyBody: 'Scan a bank receipt',
      transactionsTitle: 'Transactions',
      transactionsBody: 'Every verification in one place',
      onVerify: onVerify ?? () {},
      onTransactions: onTransactions ?? () {},
    ),
  );
}

void main() {
  testWidgets('renders both action tiles', (tester) async {
    await tester.pumpWidget(_section());

    expect(find.text('Verify a payment'), findsOneWidget);
    expect(find.text('Transactions'), findsOneWidget);
  });

  testWidgets('each tile calls its own callback', (tester) async {
    var verify = 0;
    var transactions = 0;
    await tester.pumpWidget(
      _section(onVerify: () => verify++, onTransactions: () => transactions++),
    );

    await tester.tap(find.text('Verify a payment'));
    await tester.tap(find.text('Every verification in one place'));

    expect(verify, 1);
    expect(transactions, 1);
  });
}
