import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/presentation/widgets/verdict_details_card.dart';

import '../../verdict_harness.dart';

void main() {
  testWidgets('renders the bank reference, parties and timings', (tester) async {
    await tester.pumpWidget(
      verdictTestApp(VerdictDetailsCard(result: sampleVerdict())),
    );

    expect(find.text('FT23170ABC'), findsOneWidget);
    expect(find.text('Abebe Kebede'), findsOneWidget);
    expect(find.text('Diag Mart'), findsOneWidget);
    expect(find.text('14 Jul 2026, 2:08 PM'), findsNWidgets(2));
    expect(find.text('3.8 seconds'), findsOneWidget);
  });

  testWidgets('copying the reference confirms with a snackbar', (tester) async {
    await tester.pumpWidget(
      verdictTestApp(VerdictDetailsCard(result: sampleVerdict())),
    );

    await tester.tap(find.byIcon(Icons.copy_rounded));
    // The clipboard write is async, and the snackbar animates in.
    await tester.pumpAndSettle();

    expect(find.text('Reference copied'), findsOneWidget);
  });

  testWidgets('receipt row only appears when a handler is provided',
      (tester) async {
    await tester.pumpWidget(
      verdictTestApp(VerdictDetailsCard(result: sampleVerdict())),
    );
    expect(find.text('View receipt'), findsNothing);

    var opened = 0;
    await tester.pumpWidget(
      verdictTestApp(
        VerdictDetailsCard(result: sampleVerdict(), onViewReceipt: () => opened++),
      ),
    );

    expect(find.text('View receipt'), findsOneWidget);
    await tester.tap(find.text('View receipt'));
    expect(opened, 1);
  });

  testWidgets('a result with no facts renders nothing', (tester) async {
    const empty = VerificationResult(
      id: 'v-empty',
      status: VerificationStatus.pending,
      source: 'TRANSACTION',
    );

    await tester.pumpWidget(
      verdictTestApp(const VerdictDetailsCard(result: empty)),
    );

    expect(find.byType(VerdictDetailsCard), findsOneWidget);
    expect(find.text('Reference'), findsNothing);
  });
}
