// Unit tests for Ethiopian phone validation + normalization (Step 21).
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/auth/presentation/providers/auth_flow_providers.dart';

void main() {
  group('validateEthiopianPhone', () {
    test('accepts 09XX XXX XXX local format', () {
      expect(validateEthiopianPhone('0911555001'), isNull);
      expect(validateEthiopianPhone('0911 555 001'), isNull);
    });

    test('accepts +251 format', () {
      expect(validateEthiopianPhone('+251911555001'), isNull);
      expect(validateEthiopianPhone('251911555001'), isNull);
    });

    test('accepts bare 9XXXXXXXX', () {
      expect(validateEthiopianPhone('911555001'), isNull);
    });

    test('rejects too-short numbers', () {
      expect(validateEthiopianPhone('09115550'), isNotNull);
    });

    test('rejects non-mobile prefixes (landline 02x)', () {
      expect(validateEthiopianPhone('0211555001'), isNotNull);
    });

    test('rejects letters and garbage', () {
      expect(validateEthiopianPhone('hello'), isNotNull);
    });
  });

  group('normalizeEthiopianPhone', () {
    test('normalizes 09 to +251', () {
      expect(normalizeEthiopianPhone('0911555001'), '+251911555001');
    });

    test('keeps already-normalized number', () {
      expect(normalizeEthiopianPhone('+251911555001'), '+251911555001');
    });

    test('normalizes 251 without +', () {
      expect(normalizeEthiopianPhone('251911555001'), '+251911555001');
    });

    test('strips spaces and dashes', () {
      expect(normalizeEthiopianPhone('09-11 555 001'), '+251911555001');
    });
  });
}
