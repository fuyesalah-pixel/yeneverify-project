// Image prep rules: quality ladder, 8 MB cap, sha256 identity, dims.
//
// The compressor and the decoder are injected so these run on the Dart VM
// with no plugin registration (flutter_image_compress needs a device) and
// so the q80 → q60 fallback can be observed directly.
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/verify/domain/image_prep.dart';

void main() {
  late Directory tempDir;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('verify_image_prep_');
  });

  tearDown(() async {
    if (tempDir.existsSync()) await tempDir.delete(recursive: true);
  });

  Future<File> writeImage(List<int> bytes) async {
    final file = File('${tempDir.path}/receipt.png');
    await file.writeAsBytes(bytes);
    return file;
  }

  test('compresses at q80, hashes the compressed bytes, returns dims', () async {
    final file = await writeImage([1, 2, 3, 4]);
    const compressed = [9, 9, 9, 9, 9];
    final qualities = <int>[];
    final inputs = <List<int>>[];

    final prep = ImagePrep(
      maxBytes: 1024,
      compress: (bytes, {required maxDimension, required quality}) async {
        qualities.add(quality);
        inputs.add(bytes);
        expect(maxDimension, maxImageDimension);
        return Uint8List.fromList(compressed);
      },
      decodeDimensions: (_) async => (width: 1200, height: 900),
    );

    final prepared = await prep.prepare(file);

    expect(qualities, [preferredQuality]);
    expect(inputs.single, [1, 2, 3, 4]);
    expect(prepared.size, compressed.length);
    expect(prepared.mimeType, 'image/jpeg');
    expect(prepared.fileName, 'receipt.jpg');
    // The hash must describe the UPLOADED bytes, not the original file.
    expect(prepared.sha256, sha256.convert(compressed).toString());
    expect(prepared.width, 1200);
    expect(prepared.height, 900);
  });

  test('falls back to q60 — recompressing the ORIGINAL bytes — when q80 is too big',
      () async {
    final original = List<int>.generate(64, (i) => i);
    final file = await writeImage(original);
    final qualities = <int>[];
    final inputs = <List<int>>[];

    final prep = ImagePrep(
      maxBytes: 10,
      compress: (bytes, {required maxDimension, required quality}) async {
        qualities.add(quality);
        inputs.add(bytes);
        return Uint8List.fromList(
          List<int>.filled(quality == preferredQuality ? 20 : 8, 7),
        );
      },
      decodeDimensions: (_) async => (width: 100, height: 100),
    );

    final prepared = await prep.prepare(file);

    expect(qualities, [preferredQuality, fallbackQuality]);
    // One lossy pass only: the fallback must start from the original file.
    expect(inputs, [original, original]);
    expect(prepared.size, 8);
  });

  test('throws RECEIPT_TOO_LARGE when even q60 exceeds the cap', () async {
    final file = await writeImage([1, 2, 3]);
    var calls = 0;

    final prep = ImagePrep(
      maxBytes: 10,
      compress: (bytes, {required maxDimension, required quality}) async {
        calls++;
        return Uint8List.fromList(List<int>.filled(11, 1));
      },
      decodeDimensions: (_) async => (width: 100, height: 100),
    );

    await expectLater(
      prep.prepare(file),
      throwsA(
        isA<ImagePrepException>().having(
          (e) => e.code,
          'code',
          'RECEIPT_TOO_LARGE',
        ),
      ),
    );
    expect(calls, 2);
  });

  test('rejects an empty file before touching the compressor', () async {
    final file = await writeImage(const []);
    var called = false;

    final prep = ImagePrep(
      compress: (bytes, {required maxDimension, required quality}) async {
        called = true;
        return Uint8List(0);
      },
      decodeDimensions: (_) async => (width: 1, height: 1),
    );

    await expectLater(
      prep.prepare(file),
      throwsA(
        isA<ImagePrepException>()
            .having((e) => e.code, 'code', 'RECEIPT_INVALID_TYPE'),
      ),
    );
    expect(called, isFalse);
  });

  test('default cap matches the backend 8 MB limit', () {
    expect(maxReceiptBytes, 8 * 1024 * 1024);
  });
}
