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
