import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/sub_merchants/data/models/invite_response.dart';
import 'package:yene_verify/features/sub_merchants/data/models/sub_merchant_detail.dart';
import 'package:yene_verify/features/sub_merchants/data/models/sub_merchant_summary.dart';

void main() {
  test('parses a flat {items,total,page,pageSize} list payload', () {
    final page = SubMerchantPage.fromJson({
      'items': [
        {
          'id': 'sm-1',
          'kind': 'SUB_MERCHANT',
          'status': 'ACTIVE',
          'name': 'Hanna Tesfaye',
          'phone': '+251*****11',
          'branchLabel': 'Bole Branch',
          'joinedAt': '2026-10-01T09:00:00.000Z',
        },
        {
          'id': 'sm-2',
          'status': 'INVITED',
          'name': '',
          'phone': '+251*****44',
          'invitedAt': '2026-11-02T09:00:00.000Z',
        },
      ],
      'page': 1,
      'pageSize': 50,
      'total': 2,
    });

    expect(page.items, hasLength(2));
    expect(page.total, 2);
    expect(page.items.first.name, 'Hanna Tesfaye');
    expect(page.items.first.branchLabel, 'Bole Branch');
    expect(page.items.first.isInvite, isFalse);
    expect(page.items.last.isInvite, isTrue);
    expect(page.items.last.branchLabel, isNull);
  });

  test('accepts the nested {data, meta} envelope too', () {
    final page = SubMerchantPage.fromJson({
      'data': [
        {'id': 'sm-9', 'status': 'ACTIVE', 'name': 'Bereket', 'phone': '+251*****99'},
      ],
      'meta': {'page': 2, 'pageSize': 20, 'total': 21},
    });

    expect(page.items.single.id, 'sm-9');
    expect(page.page, 2);
    expect(page.pageSize, 20);
    expect(page.total, 21);
  });

  test('unknown statuses fall back without throwing', () {
    final summary = SubMerchantSummary.fromJson({
      'id': 'sm-3',
      'status': 'SOMETHING_NEW',
      'name': 'Test',
      'phone': '+251*****00',
    });
    expect(summary.status, SubMerchantStatus.unknown);
    expect(summary.isInvite, isFalse);
  });

  test('initials come from the name, then from the phone tail', () {
    final named = SubMerchantSummary.fromJson({
      'id': 'a',
      'status': 'ACTIVE',
      'name': 'Hanna Tesfaye',
      'phone': '+251*****11',
    });
    final unnamed = SubMerchantSummary.fromJson({
      'id': 'b',
      'status': 'INVITED',
      'name': '',
      'phone': '+251*****44',
    });

    expect(named.initials, 'HT');
    expect(unnamed.initials, '44');
  });

  test('detail parses the 30-day activity summary', () {
    final detail = SubMerchantDetail.fromJson({
      'id': 'sm-1',
      'status': 'ACTIVE',
      'name': 'Hanna Tesfaye',
      'phone': '+251*****11',
      'verificationCount': 14,
      'lastVerificationAt': '2026-11-03T10:00:00.000Z',
    });

    expect(detail.verificationCount, 14);
    expect(detail.lastVerificationAt?.toUtc().day, 3);
    expect(detail.isInvite, isFalse);
  });

  test('invite response tolerates the resend-only payload', () {
    final resent = InviteResponse.fromJson({'smsSent': true});
    expect(resent.smsSent, isTrue);
    expect(resent.inviteUrl, isNull);
    expect(resent.inviteId, isNull);
  });
}
