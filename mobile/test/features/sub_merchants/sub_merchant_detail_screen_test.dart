import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/sub_merchants/data/models/sub_merchant_detail.dart';
import 'package:yene_verify/features/sub_merchants/presentation/providers/sub_merchants_provider.dart';
import 'package:yene_verify/features/sub_merchants/presentation/screens/sub_merchant_detail_screen.dart';

import 'team_harness.dart';

SubMerchantDetail detailFor(
  String id,
  String name, {
  int verificationCount = 0,
  bool invite = false,
}) =>
    SubMerchantDetail(
      summary: invite
          ? pendingInvite(id)
          : member(id, name, branch: 'Bole Branch'),
      verificationCount: verificationCount,
      lastVerificationAt: verificationCount > 0 ? DateTime(2026, 11, 3) : null,
    );

void main() {
  testWidgets('shows the name, activity summary and phone', (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    final detail = detailFor('m1', 'Hanna Tesfaye', verificationCount: 4);

    await pumpTeam(
      tester,
      const SubMerchantDetailScreen(subMerchantId: 'm1'),
      overrides: [
        ...teamOverrides(repo: repo),
        subMerchantDetailProvider('m1').overrideWith((ref) async => detail),
      ],
    );

    expect(find.text('Hanna Tesfaye'), findsWidgets);
    expect(find.text('4 verifications last 30 days'), findsOneWidget);
    expect(find.text('+251*****11'), findsOneWidget);
    expect(find.text('Change branch label'), findsWidgets);
    expect(find.text('Remove from team'), findsOneWidget);
  });

  testWidgets('removing asks for confirmation and can be cancelled',
      (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    final detail = detailFor('m1', 'Hanna Tesfaye', verificationCount: 2);

    await pumpTeam(
      tester,
      const SubMerchantDetailScreen(subMerchantId: 'm1'),
      overrides: [
        ...teamOverrides(repo: repo),
        subMerchantDetailProvider('m1').overrideWith((ref) async => detail),
      ],
    );

    await tester.tap(find.text('Remove from team'));
    await tester.pumpAndSettle();

    expect(find.text('Remove Hanna Tesfaye?'), findsOneWidget);
    expect(
      find.textContaining('past verifications will remain'),
      findsOneWidget,
    );

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();

    expect(repo.removedId, isNull);
    expect(find.text('Remove Hanna Tesfaye?'), findsNothing);
  });

  testWidgets('confirming removal calls the API', (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    final detail = detailFor('m1', 'Hanna Tesfaye');

    await pumpTeam(
      tester,
      const SubMerchantDetailScreen(subMerchantId: 'm1'),
      overrides: [
        ...teamOverrides(repo: repo),
        subMerchantDetailProvider('m1').overrideWith((ref) async => detail),
      ],
    );

    await tester.tap(find.text('Remove from team'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remove from team').last);
    await tester.pumpAndSettle();

    expect(repo.removedId, 'm1');
  });

  testWidgets('a pending invite offers resend instead of a branch edit',
      (tester) async {
    final repo = FakeTeamRepository(page: teamPage([]));
    final detail = detailFor('i1', '', invite: true);

    await pumpTeam(
      tester,
      const SubMerchantDetailScreen(subMerchantId: 'i1'),
      overrides: [
        ...teamOverrides(repo: repo),
        subMerchantDetailProvider('i1').overrideWith((ref) async => detail),
      ],
    );

    expect(find.text('Invite pending — they have not joined yet'), findsOneWidget);
    expect(find.text('Resend'), findsOneWidget);

    await tester.tap(find.text('Resend'));
    await tester.pumpAndSettle();

    expect(repo.lastResendId, 'i1');
  });
}
