// Uploads the payment screenshot the same way the verify screen uploads a
// receipt: compress → presign → PUT → complete → receiptId.
//
// Kept as its own seam (instead of calling VerifyRepository.submit) so the
// checkout never enqueues a TRANSACTION verification, and so checkout tests
// can fake the upload without a real image/plugin channel.
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_result.dart';
import '../../verify/data/receipts_api.dart';
import '../../verify/data/verify_repository.dart';
import '../../verify/domain/image_prep.dart';

class BillingReceiptUploader {
  BillingReceiptUploader({
    required ReceiptsApi receipts,
    required ImagePrep imagePrep,
  })  : _receipts = receipts,
        _imagePrep = imagePrep;

  final ReceiptsApi _receipts;
  final ImagePrep _imagePrep;

  Future<PreparedImage> prepare(File file) => _imagePrep.prepare(file);

  /// Returns the completed receipt id, or the first failure.
  Future<ApiResult<String>> upload(
    PreparedImage image, {
    required InputMethod inputMethod,
    void Function(double progress)? onProgress,
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

    final complete = await _receipts.complete(
      storageKey: ticket.storageKey,
      inputMethod: inputMethod,
      sha256: image.sha256,
      width: image.width,
      height: image.height,
    );
    if (complete is! Success) {
      return Failure(complete.errorOrNull!);
    }
    return Success(complete.dataOrNull!.receiptId);
  }
}

final billingReceiptUploaderProvider = Provider<BillingReceiptUploader>(
  (ref) => BillingReceiptUploader(
    receipts: ref.watch(receiptsApiProvider),
    imagePrep: ref.watch(imagePrepProvider),
  ),
);
