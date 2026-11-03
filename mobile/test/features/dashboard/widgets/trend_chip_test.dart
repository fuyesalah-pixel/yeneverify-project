import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/widgets/fintech/trend_chip.dart';

import '../dashboard_harness.dart';

void main() {
  testWidgets('up is a positive percentage with an ascending arrow',
      (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        const TrendChip(direction: TrendDirection.up, percent: 12.4),
      ),
    );

    expect(find.text('+12%'), findsOneWidget);
    expect(find.byIcon(Icons.trending_up_rounded), findsOneWidget);
  });

  testWidgets('down renders a minus sign and a descending arrow',
      (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        const TrendChip(direction: TrendDirection.down, percent: -8),
      ),
    );

    expect(find.text('−8%'), findsOneWidget);
    expect(find.byIcon(Icons.trending_down_rounded), findsOneWidget);
  });

  testWidgets('no previous data is an em dash, never 0%', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(const TrendChip(direction: TrendDirection.flat)),
    );

    expect(find.text('—'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
  });
}
