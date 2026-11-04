import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/core/widgets/buttons/app_button.dart';
import 'package:yene_verify/features/sub_merchants/data/models/invite_response.dart';
import 'package:yene_verify/features/sub_merchants/presentation/screens/invite_sub_merchant_screen.dart';

import 'team_harness.dart';

void main() {
  testWidgets('send is disabled until the phone is a valid Ethiopian number',
      (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    await pumpTeam(
      tester,
      const InviteSubMerchantScreen(),
      overrides: teamOverrides(repo: repo),
    );

    AppButton sendButton() => tester.widget<AppButton>(
          find.widgetWithText(AppButton, 'Send invite'),
        );

    expect(sendButton().onPressed, isNull);

    await tester.enterText(find.byType(TextFormField).first, '0922333444');
    await tester.pump();

    expect(sendButton().onPressed, isNotNull);
  });

  testWidgets('a valid form sends the normalized phone and shows the success sheet',
      (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    await pumpTeam(
      tester,
      const InviteSubMerchantScreen(),
      overrides: teamOverrides(repo: repo),
    );

    await tester.enterText(find.byType(TextFormField).at(0), '0922333444');
    await tester.enterText(find.byType(TextFormField).at(1), 'Test Sub');
    await tester.enterText(find.byType(TextFormField).at(2), 'Test Branch');
    await tester.pump();

    await tester.tap(find.text('Send invite'));
    await tester.pumpAndSettle();

    expect(repo.lastInvite?.phone, '+251922333444');
    expect(repo.lastInvite?.name, 'Test Sub');
    expect(repo.lastInvite?.branchLabel, 'Test Branch');
    expect(find.text('Invite sent'), findsOneWidget);
    expect(find.text('Invite sent to +251*****44'), findsOneWidget);
    expect(find.text('Share invite link'), findsOneWidget);
  });

  testWidgets('plan-limit rejection opens the upgrade notice', (tester) async {
    final repo = FakeTeamRepository(
      page: teamPage([member('m1', 'Hanna')]),
      inviteResult: const Failure<InviteResponse>(
        ApiError(code: 'PLAN_LIMIT_SUB_MERCHANTS', httpStatus: 403),
      ),
    );
    await pumpTeam(
      tester,
      const InviteSubMerchantScreen(),
      overrides: teamOverrides(repo: repo, packageCode: 'FREE'),
    );

    await tester.enterText(find.byType(TextFormField).first, '+251922333444');
    await tester.pump();
    await tester.tap(find.text('Send invite'));
    await tester.pumpAndSettle();

    expect(find.textContaining('every team seat'), findsOneWidget);
  });
}
