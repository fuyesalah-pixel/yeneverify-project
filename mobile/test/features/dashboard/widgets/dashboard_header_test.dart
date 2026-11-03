import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/dashboard/presentation/widgets/dashboard_header.dart';

import '../dashboard_harness.dart';

void main() {
  testWidgets('shows the greeting and a bell with the unread count',
      (tester) async {
    var tapped = 0;
    await tester.pumpWidget(
      dashboardTestApp(
        DashboardHeader(
          greeting: 'Good morning, Fuad',
          unreadCount: 3,
          notificationsTooltip: 'Notifications',
          onNotifications: () => tapped++,
        ),
      ),
    );

    expect(find.text('Good morning, Fuad'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.notifications_none_rounded));
    expect(tapped, 1);
  });

  testWidgets('an empty inbox hides the badge label', (tester) async {
    await tester.pumpWidget(
      dashboardTestApp(
        DashboardHeader(
          greeting: 'Welcome back',
          unreadCount: 0,
          notificationsTooltip: 'Notifications',
          onNotifications: () {},
        ),
      ),
    );

    expect(find.text('0'), findsNothing);
    expect(find.text('Welcome back'), findsOneWidget);
  });
}
