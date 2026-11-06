// VerifyRepository hint wiring: the scanned QR payload (v1.8.4) and the
// on-device OCR text (v1.8.5) reach the submit call, and neither hint
// can break the pipeline.
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/verify/data/models/presign_response.dart';
import 'package:yene_verify/features/verify/data/models/receipt_response.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/data/receipts_api.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';
import 'package:yene_verify/features/verify/data/verify_repository.dart';
import 'package:yene_verify/features/verify/domain/image_prep.dart';
import 'package:yene_verify/features/verify/domain/on_device_ocr.dart';
import 'package:yene_verify/features/verify/domain/qr_detector.dart';

class _FakeReceiptsApi extends ReceiptsApi {
  _FakeReceiptsApi() : super(Dio());

  @override
  Future<ApiResult<PresignResponse>> presign({
    required String fileName,
    required String mimeType,
    required int sizeBytes,
    required InputMethod inputMethod,
  }) async =>
      const Success(
        PresignResponse(
          storageKey: 'receipts/k1',
          uploadUrl: 'http://test.local/upload',
          method: 'PUT',
          headers: {},
        ),
      );

  @override
  Future<ApiResult<void>> upload({
    required PresignResponse presign,
    required List<int> bytes,
    required String mimeType,
    void Function(double progress)? onProgress,
  }) async =>
      const Success(null);

  @override
  Future<ApiResult<ReceiptResponse>> complete({
    required String storageKey,
    required InputMethod inputMethod,
    required String sha256,
    int? width,
    int? height,
  }) async =>
      const Success(
        ReceiptResponse(receiptId: 'receipt-1', storageKey: 'receipts/k1', sizeBytes: 8),
      );
}

class _FakeVerificationsApi extends VerificationsApi {
  _FakeVerificationsApi() : super(Dio());

  String? submittedQrContent;
  String? submittedQrType;
  String? submittedClientOcrText;
  double? submittedClientOcrConfidence;

  @override
  Future<ApiResult<VerificationSubmitted>> submit({
    required String receiptId,
    String source = 'TRANSACTION',
    String? qrContent,
    String? qrType,
    String? clientOcrText,
    double? clientOcrConfidence,
  }) async {
    submittedQrContent = qrContent;
    submittedQrType = qrType;
    submittedClientOcrText = clientOcrText;
    submittedClientOcrConfidence = clientOcrConfidence;
    return const Success(
      VerificationSubmitted(
        verificationId: 'verif-1',
        status: VerificationStatus.pending,
      ),
    );
  }
}

class _ThrowingDetector implements QrDetector {
  @override
  QrScanResult? detect(Uint8List imageBytes) => throw StateError('decoder exploded');
}

class _ResultDetector implements QrDetector {
  _ResultDetector(this.result);

  final QrScanResult? result;

  @override
  QrScanResult? detect(Uint8List imageBytes) => result;
}

class _FakeOnDeviceOcr implements OnDeviceOcr {
  _FakeOnDeviceOcr(this.result);

  final OnDeviceOcrResult? result;
  int calls = 0;

  @override
  Future<OnDeviceOcrResult?> recognize(Uint8List imageBytes) async {
    calls++;
    return result;
  }
}

class _ThrowingOnDeviceOcr implements OnDeviceOcr {
  @override
  Future<OnDeviceOcrResult?> recognize(Uint8List imageBytes) async =>
      throw StateError('ml kit exploded');
}

final _prepared = PreparedImage(
  bytes: Uint8List.fromList([1, 2, 3, 4, 5, 6, 7, 8]),
  size: 8,
  sha256: List.filled(64, 'a').join(),
  mimeType: 'image/jpeg',
  width: 10,
  height: 10,
);

VerifyRepository _repo(
  QrDetector detector,
  _FakeVerificationsApi api, {
  OnDeviceOcr? onDeviceOcr,
}) {
  return VerifyRepository(
    receipts: _FakeReceiptsApi(),
    verifications: api,
    imagePrep: ImagePrep(),
    qrDetector: detector,
    onDeviceOcr: onDeviceOcr ?? _FakeOnDeviceOcr(null),
  );
}

void main() {
  test('forwards a detected QR payload as qrContent + qrType', () async {
    final api = _FakeVerificationsApi();
    final detector = _ResultDetector(
      const QrScanResult(
        rawValue: 'FT26195DBK5W81465291',
        type: QrContentType.reference,
        reference: 'FT26195DBK5W81465291',
      ),
    );

    final result = await _repo(detector, api).submit(
      image: _prepared,
      inputMethod: InputMethod.upload,
    );

    expect(result.isSuccess, isTrue);
    expect(api.submittedQrContent, 'FT26195DBK5W81465291');
    expect(api.submittedQrType, 'reference');
  });

  test('submits without QR fields when no code is found', () async {
    final api = _FakeVerificationsApi();

    final result = await _repo(_ResultDetector(null), api).submit(
      image: _prepared,
      inputMethod: InputMethod.upload,
    );

    expect(result.isSuccess, isTrue);
    expect(api.submittedQrContent, isNull);
    expect(api.submittedQrType, isNull);
    expect(api.submittedClientOcrText, isNull);
  });

  test('a throwing detector never blocks the submit', () async {
    final api = _FakeVerificationsApi();

    final result = await _repo(_ThrowingDetector(), api).submit(
      image: _prepared,
      inputMethod: InputMethod.upload,
    );

    expect(result.isSuccess, isTrue);
    expect(api.submittedQrContent, isNull);
  });

  group('on-device OCR', () {
    test('forwards the recognized text and confidence when no QR is found',
        () async {
      final api = _FakeVerificationsApi();
      final ocr = _FakeOnDeviceOcr(
        const OnDeviceOcrResult(
          text: 'Transfer FT26195DBK5W81465291 completed',
          confidence: 0.9,
        ),
      );

      final result = await _repo(
        _ResultDetector(null),
        api,
        onDeviceOcr: ocr,
      ).submit(image: _prepared, inputMethod: InputMethod.upload);

      expect(result.isSuccess, isTrue);
      expect(ocr.calls, 1);
      expect(api.submittedQrContent, isNull);
      expect(
        api.submittedClientOcrText,
        'Transfer FT26195DBK5W81465291 completed',
      );
      expect(api.submittedClientOcrConfidence, 0.9);
    });

    test('a detected QR skips on-device OCR entirely', () async {
      final api = _FakeVerificationsApi();
      final ocr = _FakeOnDeviceOcr(
        const OnDeviceOcrResult(text: 'unused', confidence: 0.9),
      );
      final detector = _ResultDetector(
        const QrScanResult(
          rawValue: 'FT26195DBK5W81465291',
          type: QrContentType.reference,
          reference: 'FT26195DBK5W81465291',
        ),
      );

      final result = await _repo(
        detector,
        api,
        onDeviceOcr: ocr,
      ).submit(image: _prepared, inputMethod: InputMethod.upload);

      expect(result.isSuccess, isTrue);
      expect(ocr.calls, 0);
      expect(api.submittedQrContent, 'FT26195DBK5W81465291');
      expect(api.submittedClientOcrText, isNull);
      expect(api.submittedClientOcrConfidence, isNull);
    });

    test('a throwing OCR never blocks the submit', () async {
      final api = _FakeVerificationsApi();

      final result = await _repo(
        _ResultDetector(null),
        api,
        onDeviceOcr: _ThrowingOnDeviceOcr(),
      ).submit(image: _prepared, inputMethod: InputMethod.upload);

      expect(result.isSuccess, isTrue);
      expect(api.submittedClientOcrText, isNull);
      expect(api.submittedClientOcrConfidence, isNull);
    });
  });
}
