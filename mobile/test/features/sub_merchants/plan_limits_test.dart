import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/sub_merchants/domain/plan_limits.dart';

void main() {
  group('subMerchantLimitFor', () {
    test('FREE and PREMIUM allow one seat', () {
      expect(subMerchantLimitFor('FREE'), 1);
      expect(subMerchantLimitFor('PREMIUM'), 1);
    });

    test('BUSINESS allows ten seats', () {
      expect(subMerchantLimitFor('BUSINESS'), 10);
    });

    test('BUSINESS_PRO is unlimited (null)', () {
      expect(subMerchantLimitFor('BUSINESS_PRO'), isNull);
    });

    test('an unknown or empty plan does not invent a cap', () {
      expect(subMerchantLimitFor(''), isNull);
      expect(subMerchantLimitFor(null), isNull);
    });
  });

  group('PlanCap', () {
    test('FREE at one member is at the limit', () {
      const cap = PlanCap(packageCode: 'FREE', used: 1);
      expect(cap.capped, isTrue);
      expect(cap.atLimit, isTrue);
      expect(cap.canInvite, isFalse);
      expect(cap.remaining, 0);
    });

    test('BUSINESS with three members has seven seats left', () {
      const cap = PlanCap(packageCode: 'BUSINESS', used: 3);
      expect(cap.atLimit, isFalse);
      expect(cap.canInvite, isTrue);
      expect(cap.remaining, 7);
    });

    test('BUSINESS_PRO never blocks an invite', () {
      const cap = PlanCap(packageCode: 'BUSINESS_PRO', used: 99);
      expect(cap.capped, isFalse);
      expect(cap.atLimit, isFalse);
      expect(cap.canInvite, isTrue);
    });

    test('overshoot clamps remaining to zero', () {
      const cap = PlanCap(packageCode: 'PREMIUM', used: 3);
      expect(cap.remaining, 0);
    });
  });

  group('phone helpers', () {
    test('normalizes +251, 251 and 09 forms to E.164', () {
      expect(normalizeEthiopianPhone('+251922333444'), '+251922333444');
      expect(normalizeEthiopianPhone('251922333444'), '+251922333444');
      expect(normalizeEthiopianPhone('0922333444'), '+251922333444');
      expect(normalizeEthiopianPhone('09 22 33 34 44'), '+251922333444');
    });

    test('rejects numbers that are not Ethiopian mobiles', () {
      expect(normalizeEthiopianPhone('12345'), isNull);
      expect(normalizeEthiopianPhone('+251122333444'), isNull);
      expect(normalizeEthiopianPhone(''), isNull);
    });

    test('masks the middle of the number', () {
      expect(maskEthiopianPhone('+251922333444'), '+251*****44');
      expect(maskEthiopianPhone('not-a-phone'), 'not-a-phone');
    });
  });
}
