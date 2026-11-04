import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/sub_merchants/presentation/screens/sub_merchants_screen.dart';

import 'team_harness.dart';

void main() {
  testWidgets('renders active members and pending invites as separate sections',
      (tester) async {
    final repo = FakeTeamRepository(
      page: teamPage([
        pendingInvite('i1'),
        member('m1', 'Hanna Tesfaye', branch: 'Bole Branch'),
        member('m2', 'Bereket Alemu', branch: 'Main Counter'),
      ]),
    );

    await pumpTeam(
      tester,
      const SubMerchantsScreen(),
      overrides: teamOverrides(repo: repo),
    );

    expect(find.text('Active team members'), findsOneWidget);
    expect(find.text('Pending invites'), findsOneWidget);
    expect(find.text('Hanna Tesfaye'), findsOneWidget);
    expect(find.text('Bereket Alemu'), findsOneWidget);
    expect(find.text('+251*****44'), findsOneWidget);
    expect(find.text('Add team member'), findsWidgets);
  });

  testWidgets('empty team shows the empty state', (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));

    await pumpTeam(
      tester,
      const SubMerchantsScreen(),
      overrides: teamOverrides(repo: repo),
    );

    expect(find.text('No team members yet'), findsOneWidget);
    expect(find.text('Pending invites'), findsNothing);
  });

  testWidgets('FREE plan at the cap shows the upgrade banner', (tester) async {
    final repo = FakeTeamRepository(page: teamPage([member('m1', 'Hanna')]));

    await pumpTeam(
      tester,
      const SubMerchantsScreen(),
      overrides: teamOverrides(repo: repo, packageCode: 'FREE'),
    );

    expect(
      find.text('FREE plan allows 1 team member. Upgrade to add more.'),
      findsOneWidget,
    );
  });

  testWidgets('BUSINESS below its cap shows no upgrade banner', (tester) async {
    final repo = FakeTeamRepository(page: teamPage([member('m1', 'Hanna')]));

    await pumpTeam(
      tester,
      const SubMerchantsScreen(),
      overrides: teamOverrides(repo: repo, packageCode: 'BUSINESS'),
    );

    expect(find.text('Upgrade'), findsNothing);
  });
}
