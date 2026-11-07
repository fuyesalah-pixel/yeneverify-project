// Orchestrates the full verify pipeline:
//
//   image file → compress/sha256 → presign → PUT → complete → submit → poll
//
// Every step returns early with a typed [ApiError] so the controller only
// has to translate a code into a message; no screen ever sees a Dio
// exception. The upload progress callback is passed straight through to the
// PUT so the UI can show a real percentage.
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';


import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import '../domain/image_prep.dart';
import '../domain/on_device_ocr.dart';
import '../domain/poll_verification.dart';
import '../domain/qr_detector.dart';
import 'models/receipt_response.dart';
import 'models/verification_result.dart';
import 'receipts_api.dart';
import 'verifications_api.dart';

class VerifyRepository {
  VerifyRepository({
    required ReceiptsApi receipts,
    required VerificationsApi verifications,
    ImagePrep? imagePrep,
    QrDetector? qrDetector,
    OnDeviceOcr? onDeviceOcr,
  })  : _receipts = receipts,
        _verifications = verifications,
        _imagePrep = imagePrep ?? ImagePrep(),
        _qrDetector = qrDetector ?? const ZxingQrDetector(),
        _onDeviceOcr = onDeviceOcr ?? const MlKitOnDeviceOcr();

  final ReceiptsApi _receipts;
  final VerificationsApi _verifications;
  final ImagePrep _imagePrep;
  final QrDetector _qrDetector;
  final OnDeviceOcr _onDeviceOcr;

  /// Compresses and hashes the picked/captured image. Throws
  /// [ImagePrepException] (RECEIPT_TOO_LARGE / RECEIPT_INVALID_TYPE).
  Future<PreparedImage> prepare(File image) => _imagePrep.prepare(image);

  /// Uploads a prepared image and enqueues the verification.
  ///
  /// Returns the submit response, which carries both the verification id to
  /// poll and the post-charge credit snapshot for the UI.
  Future<ApiResult<VerificationSubmitted>> submit({
    required PreparedImage image,
    required InputMethod inputMethod,
    void Function(double progress)? onProgress,
    // Fired once the PUT has succeeded and the two POSTs begin, so the UI
    // can leave the upload progress view instead of sitting at 100%.
    void Function()? onUploaded,
  }) async {
    final presign = await _receipts.presign(
      fileName: image.fileName,
      mimeType: image.mimeType,
      sizeBytes: image.size,
      inputMethod: inputMethod,
    );
    if (presign is! Success) {
      return Failure(presign.errorOrNull!);
    }
    final ticket = presign.dataOrNull!;

    final upload = await _receipts.upload(
      presign: ticket,
      bytes: image.bytes,
      mimeType: image.mimeType,
      onProgress: onProgress,
    );
    if (upload is! Success) {
      return Failure(upload.errorOrNull!);
    }
    onUploaded?.call();

    final complete = await _receipts.complete(
      storageKey: ticket.storageKey,
      inputMethod: inputMethod,
      sha256: image.sha256,
      width: image.width,
      height: image.height,
    );
    if (complete is! Success<ReceiptResponse>) {
      return Failure(complete.errorOrNull!);
    }

    // Best-effort hints. A missing/unreadable QR or a failed on-device
    // OCR must never fail a submit.
    final qr = _detectQr(image.bytes);
    // A complete QR hint already skips OCR server-side; there is no
    // point spending ML Kit time on it.
    final clientOcr = qr == null ? await _recognizeOnDevice(image.bytes) : null;

    return _verifications.submit(
      receiptId: complete.data.receiptId,
      qrContent: qr?.rawValue,
      qrType: qr?.type.wire,
      clientOcrText: clientOcr?.text,
      clientOcrConfidence: clientOcr?.confidence,
    );
  }

  QrScanResult? _detectQr(Uint8List bytes) {
    try {
      return _qrDetector.detect(bytes);
    } catch (_) {
      return null;
    }
  }

  Future<OnDeviceOcrResult?> _recognizeOnDevice(Uint8List bytes) async {
    try {
      return await _onDeviceOcr.recognize(bytes);
    } catch (_) {
      return null;
    }
  }

  /// Polls until a terminal status, the 5-minute ceiling, or a hard failure.
  /// [onPending] fires once at the 60 s mark while polling continues.
  Future<PollOutcome> poll(
    String verificationId, {
    void Function(Duration elapsed)? onElapsed,
    void Function(Duration elapsed)? onPending,
  }) {
    return PollVerification(
      fetch: _verifications.getById,
      onElapsed: onElapsed,
      onPending: onPending,
    ).run(verificationId);
  }

  /// Single status check used by the pending screen's manual refresh.
  Future<ApiResult<VerificationResult>> status(String verificationId) =>
      _verifications.getById(verificationId);
}

final receiptsApiProvider = Provider<ReceiptsApi>(
  (ref) => ReceiptsApi(ref.watch(dioProvider)),
);

final verificationsApiProvider = Provider<VerificationsApi>(
  (ref) => VerificationsApi(ref.watch(dioProvider)),
);

final imagePrepProvider = Provider<ImagePrep>((ref) => ImagePrep());

final qrDetectorProvider = Provider<QrDetector>((ref) => const ZxingQrDetector());

final onDeviceOcrProvider = Provider<OnDeviceOcr>((ref) => const MlKitOnDeviceOcr());

final verifyRepositoryProvider = Provider<VerifyRepository>(
  (ref) => VerifyRepository(
    receipts: ref.watch(receiptsApiProvider),
    verifications: ref.watch(verificationsApiProvider),
    imagePrep: ref.watch(imagePrepProvider),
    qrDetector: ref.watch(qrDetectorProvider),
    onDeviceOcr: ref.watch(onDeviceOcrProvider),
  ),
);
