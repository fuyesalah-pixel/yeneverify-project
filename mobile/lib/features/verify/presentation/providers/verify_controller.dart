// Verify screen state machine (Step 22B Part 1).
//
//   idle → capturing → compressing → uploading → submitting → polling → result
//   any  → error  (with a code the UI maps to a localized message)
//   error → idle  (retry)
//
// The controller owns every network step and the poll loop; the screens only
// render state and forward taps. Cancelling (back button, dispose, retry)
// bumps a generation counter so an in-flight pipeline can never write state
// on top of a newer run.
import 'dart:io';


import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/network/api_result.dart';
import '../../data/image_source_service.dart';
import '../../data/models/verification_result.dart';
import '../../data/receipts_api.dart';
import '../../data/verify_repository.dart';
import '../../domain/image_prep.dart';
import '../../domain/poll_verification.dart';

/// Which input the user asked for. The camera opens as its own route; the
/// gallery picker is driven by [VerifyImagePicker] from here.
enum CaptureMode { camera, gallery }

sealed class VerifyState {
  const VerifyState();
}

/// Two action cards + credits info.
class IdleState extends VerifyState {
  const IdleState();
}

/// Camera screen open, or the system gallery picker presented.
class CapturingState extends VerifyState {
  const CapturingState(this.mode);
  final CaptureMode mode;
}

/// Compression + hashing (no network yet).
class CompressingState extends VerifyState {
  const CompressingState();
}

/// PUT to object storage. [progress] is 0..1 when the transport reports it.
class UploadingState extends VerifyState {
  const UploadingState([this.progress = 0]);
  final double progress;
}

/// POST /receipts/complete + POST /verifications.
class SubmittingState extends VerifyState {
  const SubmittingState();
}

/// Waiting for a terminal verdict.
class PollingState extends VerifyState {
  const PollingState({
    required this.verificationId,
    this.elapsed = Duration.zero,
  });
  final String verificationId;
  final Duration elapsed;
}

/// The poll ceiling was reached but the backend may still finish. The screen
/// keeps checking every 10 s and offers a manual refresh; this is deliberately
/// not an error state.
class PendingVerificationState extends VerifyState {
  const PendingVerificationState({
    required this.verificationId,
    this.isRefreshing = false,
  });
  final String verificationId;
  final bool isRefreshing;
}

/// Terminal verdict — the screen navigates to the verdict route.
class ResultState extends VerifyState {
  const ResultState(this.result);
  final VerificationResult result;
}

/// Something went wrong. [code] is the canonical backend code (or one of the
/// client-side ones below); the UI resolves it to localized copy.
class ErrorState extends VerifyState {
  const ErrorState({
    required this.code,
    required this.message,
    this.retryable = true,
  });

  final String code;

  /// English fallback for contexts without a BuildContext (logs, tests).
  final String message;

  final bool retryable;
}

/// Client-side codes that have no backend counterpart.
abstract final class VerifyErrorCodes {
  static const imageTooLarge = 'RECEIPT_TOO_LARGE';
  static const invalidImage = 'RECEIPT_INVALID_TYPE';
  static const timeout = 'VERIFICATION_TIMEOUT';
  static const generic = 'VERIFY_UNKNOWN';
}

final verifyControllerProvider =
    AsyncNotifierProvider<VerifyController, VerifyState>(VerifyController.new);

/// Last credit snapshot from a submit response. The backend returns it on
/// every submit and exposes no standalone balance endpoint, so the info card
/// renders only once a verification has been submitted in this session.
final verifyCreditsProvider = StateProvider<SubmittedCredits?>((ref) => null);

class VerifyController extends AsyncNotifier<VerifyState> {
  int _generation = 0;

  @override
  Future<VerifyState> build() async {
    // Invalidate in-flight work on dispose: its generation no longer
    // matches, so a late response cannot emit into a dead notifier.
    ref.onDispose(() => _generation++);
    return const IdleState();
  }

  VerifyRepository get _repo => ref.read(verifyRepositoryProvider);
  VerifyImagePicker get _picker => ref.read(verifyImagePickerProvider);

  VerifyState get _current => state.valueOrNull ?? const IdleState();

  void _emit(VerifyState next) => state = AsyncData(next);

  // ── input ──────────────────────────────────────────────────────────────

  /// Marks the camera flow as active. The screen pushes the camera route and
  /// hands the captured file back through [submitImage].
  void startCamera() => _emit(const CapturingState(CaptureMode.camera));

  /// Opens the system gallery picker. Cancelling returns to idle.
  Future<void> startGallery() async {
    final gen = ++_generation;
    _emit(const CapturingState(CaptureMode.gallery));

    final allowed = await _picker.ensureGalleryAccess();
    if (gen != _generation) return;
    if (!allowed) {
      _emit(const ErrorState(
        code: 'PHOTOS_PERMISSION_DENIED',
        message: 'Allow photo access in your system settings to pick a receipt image.',
        retryable: false,
      ));
      return;
    }

    File? file;
    try {
      file = await _picker.pickFromGallery();
    } catch (e) {
      if (gen != _generation) return;
      _emit(const ErrorState(
        code: 'GALLERY_UNAVAILABLE',
        message: "Couldn't open your gallery. Try again.",
      ));
      return;
    }

    if (gen != _generation) return;
    if (file == null) {
      _emit(const IdleState());
      return;
    }
    await submitImage(file, InputMethod.upload);
  }

  /// Camera path entrypoint: the user confirmed a captured frame.
  Future<void> submitCaptured(File file) => submitImage(file, InputMethod.photo);

  // ── pipeline ───────────────────────────────────────────────────────────

  Future<void> submitImage(File image, InputMethod inputMethod) async {
    final gen = ++_generation;

    _emit(const CompressingState());

    PreparedImage prepared;
    try {
      prepared = await _repo.prepare(image);
    } on ImagePrepException catch (e) {
      if (gen != _generation) return;
      _emit(ErrorState(
        code: e.code,
        message: e.code == VerifyErrorCodes.imageTooLarge
            ? 'Image too large. Try a smaller screenshot.'
            : 'Invalid image format. Use JPEG or PNG.',
        retryable: e.code != VerifyErrorCodes.invalidImage,
      ));
      return;
    } catch (e) {
      if (gen != _generation) return;
      _emit(const ErrorState(
        code: VerifyErrorCodes.generic,
        message: 'Something went wrong. Please try again.',
      ));
      return;
    }

    if (gen != _generation) return;
    _emit(const UploadingState(0));

    final submit = await _repo.submit(
      image: prepared,
      inputMethod: inputMethod,
      onProgress: (progress) {
        if (gen != _generation) return;
        // Submitting starts only after the PUT finished; a late progress
        // event must not drag the UI back to the uploading state.
        if (_current is UploadingState) _emit(UploadingState(progress));
      },
      // The PUT is done but the receipt still has to be completed and the
      // verification enqueued — that is the SubmittingState, not a stalled
      // upload at 100%.
      onUploaded: () {
        if (gen != _generation) return;
        _emit(const SubmittingState());
      },
    );

    if (gen != _generation) return;

    switch (submit) {
      case Failure<VerificationSubmitted>(:final error):
        _emit(_errorFor(error));
        return;

      case Success<VerificationSubmitted>(:final data):
        if (data.credits != null) {
          ref.read(verifyCreditsProvider.notifier).state = data.credits;
        }
        await _poll(data.verificationId, gen);
    }
  }

  Future<void> _poll(String verificationId, int gen) async {
    _emit(PollingState(verificationId: verificationId));
    var sawPending = false;

    final outcome = await _repo.poll(
      verificationId,
      onElapsed: (elapsed) {
        if (gen != _generation) return;
        if (_current is PollingState) {
          _emit(PollingState(verificationId: verificationId, elapsed: elapsed));
        }
      },
      onPending: (_) {
        if (gen != _generation) return;
        sawPending = true;
        if (_current is PollingState) {
          _emit(PendingVerificationState(verificationId: verificationId));
        }
      },
    );

    if (gen != _generation) return;

    switch (outcome) {
      case PollFinished(:final result):
        _emit(ResultState(result));
      case PollTimedOut():
        // The loop stopped at its hard ceiling; the verification may still
        // land, so keep the calm pending screen instead of an error.
        _emit(PendingVerificationState(verificationId: verificationId));
      case PollFailed(:final error):
        // A network failure after the pending threshold is transient — the
        // backend may still finish, so do not turn it into a red error.
        if (sawPending && error.isNetwork) {
          _emit(PendingVerificationState(verificationId: verificationId));
        } else {
          _emit(_errorFor(error));
        }
    }
  }

  /// One-shot check from the pending screen. Terminal results move straight
  /// to the verdict; anything else stays pending.
  Future<void> refreshPending() async {
    final current = _current;
    if (current is! PendingVerificationState || current.isRefreshing) return;

    final gen = _generation;
    _emit(PendingVerificationState(
      verificationId: current.verificationId,
      isRefreshing: true,
    ));

    final result = await _repo.status(current.verificationId);
    if (gen != _generation) return;

    switch (result) {
      case Success<VerificationResult>(:final data) when data.isTerminal:
        _emit(ResultState(data));
      case Success<VerificationResult>() || Failure<VerificationResult>():
        _emit(PendingVerificationState(verificationId: current.verificationId));
    }
  }

  // ── control ────────────────────────────────────────────────────────────

  /// "Try again" from an error state — back to the two cards.
  void retry() {
    _generation++;
    _emit(const IdleState());
  }

  /// Abandons the current run (back button on a processing state).
  void cancel() {
    _generation++;
    _emit(const IdleState());
  }

  ErrorState _errorFor(ApiError error) {
    final code = error.code ?? VerifyErrorCodes.generic;
    return ErrorState(
      code: code,
      message: error.message ?? 'Something went wrong. Please try again.',
      retryable: code != 'CREDITS_EXHAUSTED',
    );
  }
}

