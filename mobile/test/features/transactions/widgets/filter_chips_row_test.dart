import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/transactions/presentation/widgets/filter_chips_row.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';

import '../../dashboard/dashboard_harness.dart';

void main() {
  testWidgets('renders All plus one chip per verdict', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        FilterChipsRow(selected: const {}, onToggle: (_) {}, onClear: () {}),
      ),
    );

    for (final label in ['All', 'Verified', 'Fake', 'Duplicate', 'Review', 'Error']) {
      expect(find.text(label), findsOneWidget, reason: 'missing $label chip');
    }
  });

  testWidgets('tapping a status reports it, tapping All clears', (tester) async {
    VerificationStatus? toggled;
    var cleared = 0;

    await tester.pumpWidget(
      dashboardTestApp(
        FilterChipsRow(
          selected: const {},
          onToggle: (status) => toggled = status,
          onClear: () => cleared++,
        ),
      ),
    );

    await tester.tap(find.text('Fake'));
    await tester.tap(find.text('All'));

    expect(toggled, VerificationStatus.fake);
    expect(cleared, 1);
  });
}
