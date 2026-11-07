// QR detection + payload classification (v1.8.4).
//
// The generator below produces a REAL QR image with zxing2's encoder,
// so the detector is exercised end-to-end rather than against a canned
// fixture.
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;
import 'package:yene_verify/features/verify/domain/qr_detector.dart';
import 'package:zxing2/qrcode.dart';

Uint8List qrPng(String content, {int scale = 6, int quietZone = 4}) {
  final matrix = Encoder.encode(content, ErrorCorrectionLevel.h).matrix!;
  final size = matrix.width + quietZone * 2;
  final image = img.Image(width: size * scale, height: size * scale);
  img.fill(image, color: img.ColorRgb8(255, 255, 255));

  for (var x = 0; x < matrix.width; x++) {
    for (var y = 0; y < matrix.height; y++) {
      if (matrix.get(x, y) != 1) continue;
      final px = (x + quietZone) * scale;
      final py = (y + quietZone) * scale;
      img.fillRect(
        image,
        x1: px,
        y1: py,
        x2: px + scale - 1,
        y2: py + scale - 1,
        color: img.ColorRgb8(0, 0, 0),
      );
    }
  }
  return img.encodePng(image);
}

void main() {
  group('parseQrPayload', () {
    test('plain reference payload', () {
      final result = parseQrPayload('FT26195DBK5W81465291');

      expect(result, isNotNull);
      expect(result!.type, QrContentType.reference);
      expect(result.reference, 'FT26195DBK5W81465291');
      expect(result.type.wire, 'reference');
    });

    test('reference embedded in bank text', () {
      final result = parseQrPayload('CBE transfer FT26195DBK5W81465291');

      expect(result?.type, QrContentType.reference);
      expect(result?.reference, 'FT26195DBK5W81465291');
    });

    test('URL with the reference in the id query param', () {
      final result = parseQrPayload(
        'https://apps.cbe.com.et:100/?id=FT26195DBK5W81465291',
      );

      expect(result?.type, QrContentType.url);
      expect(result?.reference, 'FT26195DBK5W81465291');
    });

    test('URL with the reference in the last path segment', () {
      final result = parseQrPayload(
        'https://bankofabyssinia.com/receipt/FT26195DBK5W81465291',
      );

      expect(result?.type, QrContentType.url);
      expect(result?.reference, 'FT26195DBK5W81465291');
    });

    test('JSON with a transactionReference field', () {
      final result = parseQrPayload(
        '{"bank":"telebirr","transactionReference":"DEV12345678AB"}',
      );

      expect(result?.type, QrContentType.json);
      expect(result?.reference, 'DEV12345678AB');
      expect(result?.rawValue, contains('"bank":"telebirr"'));
    });

    test('JSON with a nested data object', () {
      final result = parseQrPayload(
        '{"data":{"bankReference":"FT26195DBK5W81465291"}}',
      );

      expect(result?.type, QrContentType.json);
      expect(result?.reference, 'FT26195DBK5W81465291');
    });

    test('JSON wrapping a verification URL', () {
      final result = parseQrPayload(
        '{"verificationUrl":"https://apps.cbe.com.et/?id=FT26195DBK5W81465291"}',
      );

      expect(result?.type, QrContentType.json);
      expect(result?.reference, 'FT26195DBK5W81465291');
    });

    test('ignores a payload that carries no reference', () {
      expect(parseQrPayload('Thank you for banking with us'), isNull);
      expect(parseQrPayload('https://example.test/welcome'), isNull);
      expect(parseQrPayload(''), isNull);
      expect(parseQrPayload('   '), isNull);
    });

    test('SECURITY: a payload claiming a verdict is ignored', () {
      expect(
        parseQrPayload('{"status":"VERIFIED","verified":true,"amount":1200}'),
        isNull,
      );
    });

    test('ignores oversized payloads', () {
      final oversized = 'FT${'A' * 2100}';
      expect(parseQrPayload(oversized), isNull);
    });
  });

  group('ZxingQrDetector', () {
    const detector = ZxingQrDetector();

    test('decodes a generated QR code and classifies it', () {
      final result = detector.detect(qrPng('FT26195DBK5W81465291'));

      expect(result, isNotNull);
      expect(result!.type, QrContentType.reference);
      expect(result.reference, 'FT26195DBK5W81465291');
    });

    test('decodes a generated URL QR code', () {
      final result = detector.detect(
        qrPng('https://apps.cbe.com.et/?id=FT26195DBK5W81465291'),
      );

      expect(result?.type, QrContentType.url);
      expect(result?.reference, 'FT26195DBK5W81465291');
    });

    test('decodes a CBE new-system receipt QR code', () {
      final result = detector.detect(
        qrPng('https://mbreciept.cbe.com.et/AbC123XyZ'),
      );

      expect(result?.type, QrContentType.url);
      expect(result?.reference, 'AbC123XyZ');
      expect(result?.rawValue, 'https://mbreciept.cbe.com.et/AbC123XyZ');
    });

    test('returns null for an image without a QR code', () {
      final blank = img.Image(width: 120, height: 120);
      img.fill(blank, color: img.ColorRgb8(255, 255, 255));

      expect(detector.detect(img.encodePng(blank)), isNull);
    });

    test('returns null for undecodable bytes', () {
      expect(detector.detect(Uint8List.fromList([0, 1, 2, 3])), isNull);
    });
  });
}
