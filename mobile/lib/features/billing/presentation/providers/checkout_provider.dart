// Checkout state machine for one package:
//
//   initiate → instructions → (image chosen) → upload/prepare → upload →
//   submit → done (screen navigates to the result route)
//
// The session is created once per package and cached for the flow, so
// returning from the result screen does not open a new session.
import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../../verify/data/receipts_api.dart';
import '../../../verify/domain/image_prep.dart';
import '../../data/billing_api.dart';
import '../../data/billing_receipt_uploader.dart';
import '../../data/models/billing_session.dart';

enum CheckoutStage { instructions, upload, submitting, done }

class CheckoutState {
  const CheckoutState({
    this.session,
    this.stage = CheckoutStage.instructions,
    this.prepared,
    this.imagePath,
    this.uploadProgress = 0,
    this.error,
    this.submitted,
  });

  final BillingSession? session;
  final CheckoutStage stage;
  final PreparedImage? prepared;
  final String? imagePath;
  final double uploadProgress;
  final ApiError? error;
  final BillingSubmitted? submitted;

  bool get hasImage => prepared != null;
  bool get isBusy => stage == CheckoutStage.submitting;

  CheckoutState copyWith({
    BillingSession? session,
    CheckoutStage? stage,
    PreparedImage? prepared,
    String? imagePath,
    double? uploadProgress,
    ApiError? error,
    BillingSubmitted? submitted,
    bool clearImage = false,
    bool clearError = false,
  }) {
    return CheckoutState(
      session: session ?? this.session,
      stage: stage ?? this.stage,
      prepared: clearImage ? null : (prepared ?? this.prepared),
      imagePath: clearImage ? null : (imagePath ?? this.imagePath),
      uploadProgress: uploadProgress ?? this.uploadProgress,
      error: clearError ? null : (error ?? this.error),
      submitted: submitted ?? this.submitted,
    );
  }
}

class CheckoutNotifier extends FamilyAsyncNotifier<CheckoutState, String> {
  @override
  Future<CheckoutState> build(String packageCode) async {
    final result = await ref.watch(billingApiProvider).initiate(packageCode);
    switch (result) {
      case Success<BillingSession>(:final data):
        return CheckoutState(session: data);
      case Failure<BillingSession>(:final error):
        throw error;
    }
  }

  CheckoutState get _current =>
      state.valueOrNull ?? const CheckoutState();

  /// Compresses the chosen screenshot and moves to the upload step.
  Future<ApiError?> chooseImage(File file) async {
    state = AsyncData(_current.copyWith(
      stage: CheckoutStage.upload,
      clearError: true,
    ));
    try {
      final prepared =
          await ref.read(billingReceiptUploaderProvider).prepare(file);
      state = AsyncData(_current.copyWith(
        prepared: prepared,
        imagePath: file.path,
      ));
      return null;
    } on ImagePrepException catch (e) {
      final error = ApiError(code: e.code, message: e.toString());
      state = AsyncData(_current.copyWith(error: error));
      return error;
    } catch (e) {
      final error = ApiError(message: e.toString());
      state = AsyncData(_current.copyWith(error: error));
      return error;
    }
  }

  /// Step 1 → step 2, before any image is chosen.
  void showUploadStep() {
    state = AsyncData(_current.copyWith(
      stage: CheckoutStage.upload,
      clearError: true,
    ));
  }

  void removeImage() {
    state = AsyncData(_current.copyWith(
      clearImage: true,
      stage: CheckoutStage.upload,
    ));
  }

  /// Uploads the screenshot, links it to the billing session, and returns the
  /// queued verification. The caller navigates on success.
  Future<ApiResult<BillingSubmitted>> submit({
    required InputMethod inputMethod,
  }) async {
    final current = _current;
    final session = current.session;
    final prepared = current.prepared;
    if (session == null || prepared == null) {
      return const Failure(
        ApiError(code: 'BILLING_SESSION_EXPIRED', httpStatus: 409),
      );
    }

    state = AsyncData(current.copyWith(
      stage: CheckoutStage.submitting,
      clearError: true,
      uploadProgress: 0,
    ));

    final uploaded =
        await ref.read(billingReceiptUploaderProvider).upload(
              prepared,
              inputMethod: inputMethod,
              onProgress: (progress) {
                state = AsyncData(_current.copyWith(uploadProgress: progress));
              },
            );

    switch (uploaded) {
      case Failure<String>(:final error):
        state = AsyncData(_current.copyWith(
          stage: CheckoutStage.upload,
          error: error,
        ));
        return Failure(error);
      case Success<String>(:final data):
        final submitted = await ref.read(billingApiProvider).submit(
              billingSessionId: session.billingSessionId,
              receiptId: data,
            );
        switch (submitted) {
          case Success<BillingSubmitted>(:final data):
            state = AsyncData(_current.copyWith(
              stage: CheckoutStage.done,
              submitted: data,
            ));
            return Success(data);
          case Failure<BillingSubmitted>(:final error):
            state = AsyncData(_current.copyWith(
              stage: CheckoutStage.upload,
              error: error,
            ));
            return Failure(error);
        }
    }
  }
}

final checkoutProvider =
    AsyncNotifierProvider.family<CheckoutNotifier, CheckoutState, String>(
  CheckoutNotifier.new,
);
