import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/billing/data/models/billing_session.dart';
import 'package:yene_verify/features/billing/data/models/billing_verification.dart';

void main() {
  group('BillingStatus', () {
    test('maps every backend status', () {
      expect(BillingStatus.fromWire('PENDING'), BillingStatus.pending);
      expect(BillingStatus.fromWire('APPROVED'), BillingStatus.approved);
      expect(BillingStatus.fromWire('VERIFIED'), BillingStatus.approved);
      expect(BillingStatus.fromWire('AMOUNT_MISMATCH'), BillingStatus.mismatch);
      expect(BillingStatus.fromWire('NEEDS_REVIEW'), BillingStatus.needsReview);
      expect(BillingStatus.fromWire('DUPLICATE'), BillingStatus.duplicate);
      expect(BillingStatus.fromWire('FAKE'), BillingStatus.fake);
      expect(BillingStatus.fromWire('REJECTED'), BillingStatus.rejected);
      expect(BillingStatus.fromWire('ERROR'), BillingStatus.rejected);
      expect(BillingStatus.fromWire(null), BillingStatus.rejected);
    });

    test('groups terminal states', () {
      expect(BillingStatus.pending.isPending, isTrue);
      expect(BillingStatus.approved.isApproved, isTrue);
      expect(BillingStatus.mismatch.needsReview_, isTrue);
      expect(BillingStatus.needsReview.needsReview_, isTrue);
      expect(BillingStatus.fake.isDeclined, isTrue);
      expect(BillingStatus.duplicate.isDeclined, isTrue);
      expect(BillingStatus.approved.isDeclined, isFalse);
    });
  });

  test('BillingSession parses instructions and amount', () {
    final session = BillingSession.fromJson(const {
      'billingSessionId': 's1',
      'packageCode': 'BUSINESS',
      'packageName': 'Business',
      'expectedAmountMinor': '99900',
      'currency': 'ETB',
      'instructions': {
        'cbe': {'accountNumber': '1000', 'accountName': 'Yene'},
        'telebirr': {'phoneNumber': '+251900', 'accountName': 'Yene'},
        'note': 'pay exactly',
      },
    });

    expect(session.expectedAmountValue, 99900);
    expect(session.instructions.cbeAccountNumber, '1000');
    expect(session.instructions.telebirrPhoneNumber, '+251900');
    expect(session.instructions.note, 'pay exactly');
  });

  test('BillingVerification parses a detail row', () {
    final detail = BillingVerification.fromJson(const {
      'id': 'b1',
      'packageCode': 'BUSINESS',
      'expectedAmountMinor': '99900',
      'submittedAmountMinor': '99000',
      'status': 'AMOUNT_MISMATCH',
      'bankReference': 'FT1',
      'reviewNote': 'Expected 999.00',
      'createdAt': '2026-11-04T10:30:00.000Z',
    });

    expect(detail.status, BillingStatus.mismatch);
    expect(detail.expectedAmountValue, 99900);
    expect(detail.submittedAmountValue, 99000);
    expect(detail.bankReference, 'FT1');
    expect(detail.createdAt, isNotNull);
  });

  test('BillingPage parses data + meta', () {
    final page = BillingPage.fromJson(const {
      'data': [
        {
          'id': 'b1',
          'packageCode': 'PREMIUM',
          'expectedAmountMinor': '19900',
          'status': 'PENDING',
          'createdAt': '2026-11-04T10:30:00.000Z',
        },
      ],
      'meta': {'page': 2, 'pageSize': 20, 'total': 21, 'totalPages': 2},
    });

    expect(page.items, hasLength(1));
    expect(page.items.first.status, BillingStatus.pending);
    expect(page.page, 2);
    expect(page.total, 21);
    expect(page.totalPages, 2);
  });
}
