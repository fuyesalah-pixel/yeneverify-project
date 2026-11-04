import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/sub_merchants/data/models/invite_request.dart';
import 'package:yene_verify/features/sub_merchants/data/models/invite_response.dart';
import 'package:yene_verify/features/sub_merchants/data/models/sub_merchant_summary.dart';
import 'package:yene_verify/features/sub_merchants/presentation/providers/sub_merchants_provider.dart';

import 'team_harness.dart';

ProviderContainer containerFor(FakeTeamRepository repo, {String package = 'BUSINESS'}) {
  final container = ProviderContainer(
    overrides: teamOverrides(repo: repo, packageCode: package),
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('splits active members from pending invites and exposes the cap', () async {
    final repo = FakeTeamRepository(
      page: teamPage([
        member('m1', 'Hanna Tesfaye', branch: 'Bole'),
        member('m2', 'Bereket Alemu', branch: 'Main'),
        pendingInvite('i1'),
      ]),
    );
    final container = containerFor(repo);

    final state = await container.read(subMerchantsProvider.future);

    expect(state.members.map((e) => e.name), ['Hanna Tesfaye', 'Bereket Alemu']);
    expect(state.invites.map((e) => e.id), ['i1']);
    expect(state.packageCode, 'BUSINESS');
    expect(state.usedSeats, 3);
    expect(state.cap.atLimit, isFalse);
    expect(state.cap.remaining, 7);
  });

  test('FREE plan at one member reports the cap as reached', () async {
    final repo = FakeTeamRepository(page: teamPage([member('m1', 'Hanna')]));
    final container = containerFor(repo, package: 'FREE');

    final state = await container.read(subMerchantsProvider.future);

    expect(state.cap.atLimit, isTrue);
    expect(state.cap.canInvite, isFalse);
  });

  test('removed rows do not consume a seat', () async {
    final repo = FakeTeamRepository(
      page: teamPage([
        member('m1', 'Hanna'),
        const SubMerchantSummary(
          id: 'removed',
          status: SubMerchantStatus.removed,
          name: 'Old Member',
          phone: '+251*****00',
        ),
      ]),
    );
    final container = containerFor(repo, package: 'FREE');

    final state = await container.read(subMerchantsProvider.future);

    expect(state.usedSeats, 1);
    expect(state.cap.atLimit, isTrue);
  });

  test('a successful invite refreshes the list', () async {
    final repo = FakeTeamRepository(page: teamPage([]));
    final container = containerFor(repo);
    await container.read(subMerchantsProvider.future);

    final result = await container.read(subMerchantsProvider.notifier).invite(
          const InviteRequest(phone: '+251922333444', branchLabel: 'Test'),
        );

    expect(result, isA<Success<InviteResponse>>());
    expect(repo.lastInvite?.phone, '+251922333444');
    expect(repo.listCalls, 2);
  });

  test('a rejected invite surfaces the error and does not refresh', () async {
    final repo = FakeTeamRepository(
      page: teamPage([member('m1', 'Hanna')]),
      inviteResult: const Failure(
        ApiError(code: 'PLAN_LIMIT_SUB_MERCHANTS', httpStatus: 403),
      ),
    );
    final container = containerFor(repo, package: 'FREE');
    await container.read(subMerchantsProvider.future);

    final result = await container.read(subMerchantsProvider.notifier).invite(
          const InviteRequest(phone: '+251922333444'),
        );

    expect(result, isA<Failure<InviteResponse>>());
    expect(repo.listCalls, 1);
  });

  test('resend and remove report success and refresh', () async {
    final repo = FakeTeamRepository(page: teamPage([pendingInvite('i1')]));
    final container = containerFor(repo);
    await container.read(subMerchantsProvider.future);
    final notifier = container.read(subMerchantsProvider.notifier);

    expect(await notifier.resendInvite('i1'), isNull);
    expect(repo.lastResendId, 'i1');

    expect(await notifier.remove('i1'), isNull);
    expect(repo.removedId, 'i1');
    expect(repo.listCalls, 3);
  });

  test('branch label updates are sent to the API', () async {
    final repo = FakeTeamRepository(page: teamPage([member('m1', 'Hanna')]));
    final container = containerFor(repo);
    await container.read(subMerchantsProvider.future);

    final error = await container
        .read(subMerchantsProvider.notifier)
        .updateBranch('m1', 'Piassa Branch');

    expect(error, isNull);
    expect(repo.lastBranchTarget, 'm1');
    expect(repo.lastBranchLabel, 'Piassa Branch');
  });
}
