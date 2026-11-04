import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/transactions/presentation/widgets/transaction_row_compact.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/data/models/verification_summary.dart';

import '../../dashboard/dashboard_harness.dart';

void main() {
  final item = VerificationSummary(
    id: 'v1',
    status: VerificationStatus.fake,
    bankCode: 'CBE',
    bankReference: 'FT23170ABC',
    amountMinor: '550000',
    createdAt: DateTime.now().subtract(const Duration(hours: 2)),
  );

  VerificationSummary row({
    String? senderName,
    String? bankReference,
    String? bankCode,
  }) =>
      VerificationSummary(
        id: 'v1',
        status: VerificationStatus.verified,
        bankCode: bankCode,
        bankReference: bankReference,
        senderName: senderName,
        amountMinor: '550000',
        createdAt: DateTime.now(),
      );

  testWidgets('shows bank, reference, amount, verdict and time', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(TransactionRowCompact(item: item, onTap: () {})),
    );

    expect(find.text('CBE'), findsOneWidget);
    expect(find.text('FT23170ABC'), findsOneWidget);
    expect(find.text('5,500.00 ETB'), findsOneWidget);
    expect(find.text('FAKE'), findsOneWidget);
    expect(find.text('2h ago'), findsOneWidget);
  });

  testWidgets('prefers senderName over the bank reference', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        TransactionRowCompact(
          item: row(
            senderName: 'Abebe Kebede',
            bankReference: 'FT23170ABC',
            bankCode: 'CBE',
          ),
          onTap: () {},
        ),
      ),
    );

    expect(find.text('Abebe Kebede'), findsOneWidget);
    expect(find.text('FT23170ABC'), findsNothing);
    expect(find.text('5,500.00 ETB'), findsOneWidget);
  });

  testWidgets('falls back to bankReference when senderName is null', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        TransactionRowCompact(
          item: row(bankReference: 'FT23170ABC', bankCode: 'CBE'),
          onTap: () {},
        ),
      ),
    );

    expect(find.text('FT23170ABC'), findsOneWidget);
    expect(find.text('Abebe Kebede'), findsNothing);
  });

  testWidgets('falls back to bankCode when senderName and bankReference are null',
      (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        TransactionRowCompact(item: row(bankCode: 'CBE'), onTap: () {}),
      ),
    );

    // Row 1 always shows the bank; row 2 falls back to the same code.
    expect(find.text('CBE'), findsNWidgets(2));
    expect(find.text('5,500.00 ETB'), findsOneWidget);
  });

  testWidgets('tapping the row opens it', (tester) async {
    var opened = 0;
    await tester.pumpWidget(
      dashboardTestApp(
        TransactionRowCompact(item: item, onTap: () => opened++),
      ),
    );

    await tester.tap(find.text('CBE'));
    expect(opened, 1);
  });
}
