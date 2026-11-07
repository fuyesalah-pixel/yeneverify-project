// Image preparation: compress → size-check → sha256 → dimensions.
//
// Runs BEFORE any network call so an unusable image never costs a presign,
// an upload, or a credit.
//
// Privacy: `keepExif: false` strips every EXIF tag except the orientation
// correction that is baked into the pixels (`autoCorrectionAngle: true`),
// so receipts keep their upright orientation without leaking GPS/camera
// metadata to storage.
//
// The compressor and the dimension probe are injectable because
// flutter_image_compress and dart:ui decoding are not available in plain
// `flutter test` (no plugin registrant), and unit tests must exercise the
// size/sha256 rules without a device.
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:crypto/crypto.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';

/// Backend limit from storage-driver.interface.ts (MAX_RECEIPT_BYTES).
const int maxReceiptBytes = 8 * 1024 * 1024;

/// Long edge cap. Bigger than this and OCR gains nothing but costs bytes.
const int maxImageDimension = 1600;

/// Quality ladder: try the good one, fall back to the cheap one, then fail.
const int preferredQuality = 80;
const int fallbackQuality = 60;

/// Compresses `bytes` to JPEG, capping the long edge at `maxDimension`.
typedef CompressFn = Future<Uint8List> Function(
  Uint8List bytes, {
  required int maxDimension,
  required int quality,
});

/// Reads pixel dimensions out of encoded image bytes.
typedef DimensionsFn = Future<({int width, int height})> Function(Uint8List bytes);

/// A compressed, hashed image ready for presign/upload/complete.
class PreparedImage {
  const PreparedImage({
    required this.bytes,
    required this.size,
    required this.sha256,
    required this.mimeType,
    required this.width,
    required this.height,
  });

  final Uint8List bytes;
  final int size;
  final String sha256;
  final String mimeType;
  final int width;
  final int height;

  /// File name handed to /receipts/presign (extension must match mimeType).
  String get fileName => 'receipt.jpg';
}

/// Thrown when an image cannot be prepared at all.
///
/// `code` uses the backend's canonical error code so the UI maps it through
/// the same table as server-side failures.
class ImagePrepException implements Exception {
  const ImagePrepException(this.code);

  final String code;

  @override
  String toString() => 'ImagePrepException($code)';
}

class ImagePrep {
  ImagePrep({
    CompressFn? compress,
    DimensionsFn? decodeDimensions,
    this.maxBytes = maxReceiptBytes,
    this.maxDimension = maxImageDimension,
  })  : _compress = compress ?? _compressJpeg,
        _decodeDimensions = decodeDimensions ?? _decodeJpegDimensions;

  final CompressFn _compress;
  final DimensionsFn _decodeDimensions;
  final int maxBytes;
  final int maxDimension;

  /// Compresses, enforces the size cap, hashes, and measures.
  ///
  /// The fallback re-compresses the ORIGINAL bytes at q60 rather than
  /// double-compressing the q80 output: one lossy pass is enough, and a
  /// second pass mostly destroys detail without buying much size.
  Future<PreparedImage> prepare(File file) async =>
      prepareBytes(await file.readAsBytes());

  /// Camera captures arrive as bytes: their temp file lives in the app cache,
  /// which Android trims without warning on a nearly-full device, so the
  /// pipeline never depends on that path staying alive.
  Future<PreparedImage> prepareBytes(Uint8List original) async {
    if (original.isEmpty) {
      throw const ImagePrepException('RECEIPT_INVALID_TYPE');
    }

    var compressed = await _compress(
      original,
      maxDimension: maxDimension,
      quality: preferredQuality,
    );

    if (compressed.length > maxBytes) {
      compressed = await _compress(
        original,
        maxDimension: maxDimension,
        quality: fallbackQuality,
      );
    }
    if (compressed.length > maxBytes) {
      throw const ImagePrepException('RECEIPT_TOO_LARGE');
    }

    final dims = await _decodeDimensions(compressed);

    return PreparedImage(
      bytes: compressed,
      size: compressed.length,
      sha256: sha256.convert(compressed).toString(),
      mimeType: 'image/jpeg',
      width: dims.width,
      height: dims.height,
    );
  }

  // ── defaults (device implementations) ──────────────────────────────────

  static Future<Uint8List> _compressJpeg(
    Uint8List bytes, {
    required int maxDimension,
    required int quality,
  }) async {
    final result = await FlutterImageCompress.compressWithList(
      bytes,
      minWidth: maxDimension,
      minHeight: maxDimension,
      quality: quality,
      format: CompressFormat.jpeg,
      // Keep pixels upright, drop every other tag (privacy).
      autoCorrectionAngle: true,
      keepExif: false,
    );
    return result;
  }

  /// Reads the encoded dimensions through the modern descriptor API, which
  /// does not decode the full bitmap just to learn its size.
  static Future<({int width, int height})> _decodeJpegDimensions(
    Uint8List bytes,
  ) async {
    final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
    final descriptor = await ui.ImageDescriptor.encoded(buffer);
    try {
      return (width: descriptor.width, height: descriptor.height);
    } finally {
      descriptor.dispose();
      buffer.dispose();
    }
  }
}
