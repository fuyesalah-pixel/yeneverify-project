// On-device OCR confidence bands (v1.8.5).
//
// ML Kit exposes no confidence score, so the client assigns a
// conservative band. The backend only prefers client OCR above 0.6,
// which means weak reads are ignored rather than trusted.
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/verify/domain/on_device_ocr.dart';

void main() {
  group('classifyOnDeviceText', () {
    test('returns null for empty text', () {
      expect(classifyOnDeviceText(''), isNull);
    });

    test('returns null for whitespace-only text', () {
      expect(classifyOnDeviceText('  \n\t '), isNull);
    });

    test('trims text and assigns the low band to a short read', () {
      final result = classifyOnDeviceText('  Awash Bank  ');

      expect(result, isNotNull);
      expect(result!.text, 'Awash Bank');
      expect(result.confidence, 0.5);
    });

    test('assigns the mid band to long text without a reference', () {
      const text = 'Commercial Bank of Ethiopia receipt paid successfully';
      expect(text.length, greaterThanOrEqualTo(40));

      final result = classifyOnDeviceText(text);

      expect(result, isNotNull);
      expect(result!.confidence, 0.7);
    });

    test('assigns the high band when a reference is present', () {
      final result = classifyOnDeviceText(
        'Thank you. Transaction FT26195DBK5W81465291 completed.',
      );

      expect(result, isNotNull);
      expect(result!.confidence, 0.9);
    });

    test('a reference beats the length band', () {
      const text =
          'Dear customer, your transfer has been completed successfully. '
          'Reference: FT26195DBK5W81465291.';
      expect(text.length, greaterThanOrEqualTo(40));

      final result = classifyOnDeviceText(text);

      expect(result, isNotNull);
      expect(result!.confidence, 0.9);
    });

    test('a reference below the length threshold still scores high', () {
      final result = classifyOnDeviceText('FT26195DBK5W81465291');

      expect(result, isNotNull);
      expect(result!.confidence, greaterThan(0.6));
    });
  });

  test('MlKitOnDeviceOcr degrades to null instead of throwing', () async {
    // No ML Kit platform channel in the test host: the recognizer must
    // report "no client OCR", never an exception.
    final result = await const MlKitOnDeviceOcr().recognize(
      Uint8List.fromList([1, 2, 3, 4]),
    );

    expect(result, isNull);
  });
}
