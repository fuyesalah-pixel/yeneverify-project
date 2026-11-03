// Orchestrates the full verify pipeline:
//
//   image file → compress/sha256 → presign → PUT → complete → submit → poll
//
// Every step returns early with a typed [ApiError] so the controller only
// has to translate a code into a message; no screen ever sees a Dio
// exception. The upload progress callback is passed straight through to the
// PUT so the UI can show a real percentage.
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';


import '../../../core/network/api_result.dart';
import '../../../core/network/dio_client.dart';
import '../domain/image_prep.dart';
import '../domain/poll_verification.dart';
import 'models/receipt_response.dart';
import 'models/verification_result.dart';
import 'receipts_api.dart';
import 'verifications_api.dart';

class VerifyRepository {
  VerifyRepository({
    required ReceiptsApi receipts,
    required VerificationsApi verifications,
    ImagePrep? imagePrep,
  })  : _receipts = receipts,
        _verifications = verifications,
        _imagePrep = imagePrep ?? ImagePrep();

  final ReceiptsApi _receipts;
  final VerificationsApi _verifications;
  final ImagePrep _imagePrep;

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

    return _verifications.submit(receiptId: complete.data.receiptId);
  }

  /// Polls until a terminal status, the 30 s ceiling, or a hard failure.
  Future<PollOutcome> poll(
    String verificationId, {
    void Function(Duration elapsed)? onElapsed,
  }) {
    return PollVerification(
      fetch: _verifications.getById,
      onElapsed: onElapsed,
    ).run(verificationId);
  }
}

final receiptsApiProvider = Provider<ReceiptsApi>(
  (ref) => ReceiptsApi(ref.watch(dioProvider)),
);

final verificationsApiProvider = Provider<VerificationsApi>(
  (ref) => VerificationsApi(ref.watch(dioProvider)),
);

final imagePrepProvider = Provider<ImagePrep>((ref) => ImagePrep());

final verifyRepositoryProvider = Provider<VerifyRepository>(
  (ref) => VerifyRepository(
    receipts: ref.watch(receiptsApiProvider),
    verifications: ref.watch(verificationsApiProvider),
    imagePrep: ref.watch(imagePrepProvider),
  ),
);
