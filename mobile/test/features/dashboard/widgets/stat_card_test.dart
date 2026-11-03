import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/widgets/fintech/amount_text.dart';
import 'package:yene_verify/core/widgets/fintech/stat_card.dart';
import 'package:yene_verify/core/widgets/fintech/trend_chip.dart';

import '../dashboard_harness.dart';

void main() {
  testWidgets('renders label, amount and trend together', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        const StatCard(
          label: 'This month',
          trend: TrendChip(direction: TrendDirection.up, percent: 12),
          value: AmountText(
            amountMinor: 5500000,
            size: AmountTextSize.heading,
          ),
        ),
      ),
    );

    expect(find.text('This month'), findsOneWidget);
    expect(find.text('55,000.00 ETB'), findsOneWidget);
    expect(find.text('+12%'), findsOneWidget);
  });

  testWidgets('a card without a trend still renders its value', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        const StatCard(
          label: 'Verifications',
          value: AmountText(amountMinor: 0),
        ),
      ),
    );

    expect(find.text('Verifications'), findsOneWidget);
    expect(find.text('0.00 ETB'), findsOneWidget);
    expect(find.byType(TrendChip), findsNothing);
  });
}
