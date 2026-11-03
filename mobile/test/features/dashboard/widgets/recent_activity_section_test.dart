import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/dashboard/presentation/widgets/recent_activity_section.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/data/models/verification_summary.dart';

import '../dashboard_harness.dart';

List<VerificationSummary> _items() => [
      VerificationSummary(
        id: 'v1',
        status: VerificationStatus.verified,
        bankCode: 'CBE',
        amountMinor: '550000',
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      VerificationSummary(
        id: 'v2',
        status: VerificationStatus.fake,
        bankCode: 'TELEBIRR',
        amountMinor: '120000',
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
    ];

void main() {
  testWidgets('renders one row per verification with relative time',
      (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        RecentActivitySection(
          items: _items(),
          onSeeAll: () {},
          onOpen: (_) {},
        ),
      ),
    );

    expect(find.text('Recent activity'), findsOneWidget);
    expect(find.text('See all'), findsOneWidget);
    expect(find.text('5,500.00 ETB'), findsOneWidget);
    expect(find.text('2h ago'), findsOneWidget);
    expect(find.text('2d ago'), findsOneWidget);
  });

  testWidgets('tapping a row opens that verification; See all is separate',
      (tester) async {
    String? opened;
    var seeAll = 0;
    await tester.pumpWidget(
      dashboardTestApp(
        RecentActivitySection(
          items: _items(),
          onSeeAll: () => seeAll++,
          onOpen: (item) => opened = item.id,
        ),
      ),
    );

    await tester.tap(find.text('CBE'));
    await tester.tap(find.text('See all'));

    expect(opened, 'v1');
    expect(seeAll, 1);
  });
}
