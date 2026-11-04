import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/sub_merchants/domain/plan_limits.dart';
import 'package:yene_verify/features/sub_merchants/presentation/widgets/invite_row.dart';
import 'package:yene_verify/features/sub_merchants/presentation/widgets/plan_cap_warning.dart';
import 'package:yene_verify/features/sub_merchants/presentation/widgets/sub_merchant_row.dart';

import '../team_harness.dart';

void main() {
  testWidgets('member row shows initials, name, branch and status', (tester) async {
    final item = member('m1', 'Hanna Tesfaye', branch: 'Bole Branch');

    await pumpTeam(
      tester,
      SubMerchantRow(item: item, onTap: () {}),
    );

    expect(find.text('HT'), findsOneWidget);
    expect(find.text('Hanna Tesfaye'), findsOneWidget);
    expect(find.text('Bole Branch'), findsOneWidget);
    expect(find.text('Active'), findsOneWidget);
  });

  testWidgets('member row falls back to the masked phone when unnamed',
      (tester) async {
    await pumpTeam(
      tester,
      SubMerchantRow(item: pendingInvite('i1'), onTap: () {}),
    );

    expect(find.text('+251*****44'), findsOneWidget);
    expect(find.text('Invited'), findsOneWidget);
  });

  testWidgets('invite row shows age and offers resend + revoke', (tester) async {
    await pumpTeam(
      tester,
      InviteRow(
        invite: pendingInvite('i1'),
        onResend: () {},
        onRevoke: () {},
      ),
    );

    expect(find.text('+251*****44'), findsOneWidget);
    expect(find.text('Invited 2h ago'), findsOneWidget);
    expect(find.text('Resend'), findsOneWidget);
    expect(find.text('Revoke'), findsOneWidget);
  });

  testWidgets('plan cap warning appears at the FREE limit', (tester) async {
    await pumpTeam(
      tester,
      PlanCapWarning(
        cap: const PlanCap(packageCode: 'FREE', used: 1),
        onUpgrade: () {},
      ),
    );

    expect(
      find.text('FREE plan allows 1 team member. Upgrade to add more.'),
      findsOneWidget,
    );
    expect(find.text('Upgrade'), findsOneWidget);
  });

  testWidgets('plan cap warning is hidden below the cap and on unlimited plans',
      (tester) async {
    await pumpTeam(
      tester,
      PlanCapWarning(
        cap: const PlanCap(packageCode: 'BUSINESS', used: 4),
        onUpgrade: () {},
      ),
    );
    expect(find.text('Upgrade'), findsNothing);

    await pumpTeam(
      tester,
      PlanCapWarning(
        cap: const PlanCap(packageCode: 'BUSINESS_PRO', used: 99),
        onUpgrade: () {},
      ),
    );
    expect(find.text('Upgrade'), findsNothing);
  });
}
