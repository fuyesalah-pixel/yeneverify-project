// Detects the QR code printed on a bank receipt and classifies its
// payload for the backend.
//
// Pure Dart (zxing2 + image), no platform channels, so it works on
// every build target and is unit-testable. Detection is best-effort:
// any failure returns null and the pipeline continues with OCR.
//
// The payload is a HINT for the backend — this client never decides a
// verdict from it.
import 'dart:convert';
import 'dart:typed_data';

import 'package:image/image.dart' as img;
import 'package:zxing2/qrcode.dart';

/// Wire types understood by the backend's qrType field.
enum QrContentType {
  reference,
  url,
  json;

  String get wire => name;
}

class QrScanResult {
  const QrScanResult({
    required this.rawValue,
    required this.type,
    required this.reference,
  });

  /// Raw decoded text, sent to the backend as qrContent (capped there).
  final String rawValue;
  final QrContentType type;

  /// Reference extracted on-device; shown to the backend only through
  /// [rawValue], which it re-parses independently.
  final String reference;
}

/// Backend field limit for qrContent.
const int _maxPayloadLength = 2048;

/// Reference shapes the bank adapters understand. Kept in sync with
/// backend `REFERENCE_PATTERNS`.
final RegExp _referenceRe = RegExp(
  r'\b(?:FT[0-9A-Z]{10,22}|(?:DEV|TBR)[0-9A-Z]{8,16}|DSH[0-9A-Z]{6,20}|108[0-9A-Z]{9,20}|[0-9A-Z]{10,12}-[0-9A-Z]{5,8})\b',
  caseSensitive: false,
);

// Loose reference for query params/JSON fields. Requires a digit so a
// URL path word ("welcome") is never mistaken for a transaction reference.
final RegExp _looseReferenceRe = RegExp(
  r'^(?=.*\d)[A-Z0-9][A-Z0-9-]{5,39}$',
  caseSensitive: false,
);

const List<String> _urlReferenceParams = [
  'id',
  'ref',
  'reference',
  'txn',
  'trx',
  'txnRef',
  'transactionReference',
  'bankReference',
];

const List<String> _jsonReferenceKeys = [
  'reference',
  'ref',
  'transactionReference',
  'bankReference',
  'txnRef',
];

/// True when [text] contains a reference shape the bank adapters
/// understand. Shared with the on-device OCR confidence heuristic.
bool containsReference(String text) => _referenceRe.hasMatch(text);

/// Classifies a decoded QR payload. Returns null when nothing usable
/// can be derived — the caller then submits without a QR hint.
QrScanResult? parseQrPayload(String raw) {
  final value = raw.trim();
  if (value.isEmpty || value.length > _maxPayloadLength) return null;

  if (value.startsWith('{')) {
    final fromJson = _fromJson(value);
    if (fromJson != null) return fromJson;
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    final fromUrl = _fromUrl(value);
    if (fromUrl != null) return fromUrl;
  }

  final reference = _referenceIn(value);
  if (reference == null) return null;
  return QrScanResult(
    rawValue: value,
    type: QrContentType.reference,
    reference: reference,
  );
}

String? _referenceIn(String text) {
  final match = _referenceRe.firstMatch(text);
  if (match != null) return match.group(0);
  return _looseReference(text) ? text : null;
}

bool _looseReference(String value) => _looseReferenceRe.hasMatch(value.trim());

String? _referenceValue(Object? value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return _looseReference(trimmed) ? trimmed : null;
}

QrScanResult? _fromUrl(String raw) {
  final uri = Uri.tryParse(raw);
  if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) {
    return null;
  }

  String? reference;
  for (final key in _urlReferenceParams) {
    reference = _referenceValue(uri.queryParameters[key]);
    if (reference != null) break;
  }
  if (reference == null) {
    final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    if (segments.isNotEmpty) {
      final last = Uri.decodeComponent(segments.last);
      reference = _referenceRe.firstMatch(last)?.group(0);
    }
  }
  if (reference == null) return null;

  return QrScanResult(
    rawValue: raw,
    type: QrContentType.url,
    reference: reference,
  );
}

QrScanResult? _fromJson(String raw) {
  Object? parsed;
  try {
    parsed = jsonDecode(raw);
  } catch (_) {
    return null;
  }
  if (parsed is! Map) return null;

  final record = parsed.cast<String, dynamic>();
  final nested = record['data'] is Map
      ? (record['data'] as Map).cast<String, dynamic>()
      : const <String, dynamic>{};

  for (final key in _jsonReferenceKeys) {
    final reference = _referenceValue(record[key]) ?? _referenceValue(nested[key]);
    if (reference != null) {
      return QrScanResult(
        rawValue: raw,
        type: QrContentType.json,
        reference: reference,
      );
    }
  }

  for (final key in const ['url', 'verificationUrl', 'verification_url']) {
    final urlValue = record[key] ?? nested[key];
    if (urlValue is String) {
      final fromUrl = _fromUrl(urlValue);
      if (fromUrl != null) {
        return QrScanResult(
          rawValue: raw,
          type: QrContentType.json,
          reference: fromUrl.reference,
        );
      }
    }
  }

  return null;
}

/// Scans image bytes for a QR code. Implementations must never throw.
abstract class QrDetector {
  QrScanResult? detect(Uint8List imageBytes);
}

class ZxingQrDetector implements QrDetector {
  const ZxingQrDetector();

  @override
  QrScanResult? detect(Uint8List imageBytes) {
    final text = _decode(imageBytes);
    if (text == null) return null;
    return parseQrPayload(text);
  }

  String? _decode(Uint8List imageBytes) {
    try {
      final decoded = img.decodeImage(imageBytes);
      if (decoded == null) return null;

      final rgba = decoded.convert(numChannels: 4);
      final abgr = rgba.getBytes(order: img.ChannelOrder.abgr);
      final pixels = abgr.buffer.asInt32List(abgr.offsetInBytes, abgr.lengthInBytes ~/ 4);
      final source = RGBLuminanceSource(rgba.width, rgba.height, pixels);
      final bitmap = BinaryBitmap(HybridBinarizer(source));
      final hints = DecodeHints()..put(DecodeHintType.tryHarder);

      return QRCodeReader().decode(bitmap, hints: hints).text;
    } catch (_) {
      // No QR, unreadable image, or a decoder edge case — all mean
      // "no hint", never a failed verification.
      return null;
    }
  }
}
