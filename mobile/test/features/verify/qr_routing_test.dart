// QR routing (v1.9.4).
//
// The wire type decides which lookup the backend performs. A CBE
// new-system receipt URL must stay a URL (the opaque short ID is not
// a reference), a plain reference stays a reference, and payloads
// with nothing actionable produce no QR hint at all.
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/verify/domain/qr_detector.dart';

void main() {
  group('QR payload routing', () {
    test('CBE new-system receipt URL → qrType=url with the short ID', () {
      final result = parseQrPayload(
        'https://mbreciept.cbe.com.et/AbC123XyZ',
      );

      expect(result, isNotNull);
      expect(result!.type, QrContentType.url);
      expect(result.type.wire, 'url');
      expect(result.reference, 'AbC123XyZ');
      expect(result.rawValue, 'https://mbreciept.cbe.com.et/AbC123XyZ');
    });

    test('plain reference → qrType=reference', () {
      final result = parseQrPayload('FT26195DBK5W81465291');

      expect(result, isNotNull);
      expect(result!.type, QrContentType.reference);
      expect(result.type.wire, 'reference');
      expect(result.reference, 'FT26195DBK5W81465291');
    });

    test('nothing actionable → no QR hint (null)', () {
      expect(parseQrPayload('Thank you for banking with us'), isNull);
      expect(parseQrPayload('https://example.test/welcome'), isNull);
      expect(parseQrPayload('https://mbreciept.cbe.com.et/'), isNull);
    });

    test('lookalike CBE host is not routed as a new-system receipt', () {
      final result = parseQrPayload(
        'https://mbreciept.cbe.com.et.evil.test/AbC123XyZ',
      );

      expect(result, isNull);
    });
  });
}
