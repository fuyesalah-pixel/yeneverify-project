// Flow-state providers for the auth screens (Step 21). Manage only the
// per-screen flow state (PIN entry/confirm); session state lives in
// AuthNotifier and is mutated exclusively through its public methods.
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/api_error.dart';
import '../../domain/auth_notifier.dart';

// ---------------------------------------------------------------------------
// Shared: Ethiopian phone normalization + validation
// ---------------------------------------------------------------------------

/// Normalizes any accepted input form to E.164 (+251XXXXXXXXX).
String normalizeEthiopianPhone(String raw) {
  final digits = raw.replaceAll(RegExp(r'[\s\-()]'), '');
  if (digits.startsWith('+251')) return digits;
  if (digits.startsWith('251')) return '+$digits';
  if (digits.startsWith('09')) {
    final tail = digits.length > 9 ? digits.substring(0, 10) : digits;
    return '+251${tail.substring(1)}';
  }
  if (digits.startsWith('9')) {
    final tail = digits.length > 9 ? digits.substring(0, 9) : digits;
    return '+251$tail';
  }
  return digits;
}

/// Validation for Ethiopian mobile numbers. Returns an error string or null.
String? validateEthiopianPhone(String raw) {
  final digits = raw.replaceAll(RegExp(r'[\s\-()]'), '');
  String rest;
  if (digits.startsWith('+251') || digits.startsWith('251')) {
    rest = digits.replaceFirst(RegExp(r'^\+?251'), '');
  } else if (digits.startsWith('09')) {
    rest = digits.substring(1);
  } else if (digits.startsWith('9')) {
    rest = digits;
  } else {
    return 'Enter a valid Ethiopian phone number';
  }
  // Mobile: 9 + 8 digits (9XXXXXXXX).
  if (!RegExp(r'^9\d{8}$').hasMatch(rest)) {
    return 'Enter a valid Ethiopian phone number';
  }
  return null;
}

// ---------------------------------------------------------------------------
// PIN setup flow (entry + confirm on the same screen)
// ---------------------------------------------------------------------------

enum PinStage { firstEntry, confirmEntry, done }

class PinFlowState {
  const PinFlowState({
    this.stage = PinStage.firstEntry,
    this.firstPin = '',
    this.isLoading = false,
    this.hasError = false,
    this.error,
    this.mismatch = false,
    this.attemptCount = 0,
    this.isLockedOut = false,
  });

  final PinStage stage;
  final String firstPin; // first entry during setup, for confirm match
  final bool isLoading;
  final bool hasError;
  final ApiError? error;
  final bool mismatch;
  final int attemptCount;
  final bool isLockedOut;

  PinFlowState copyWith({
    PinStage? stage,
    String? firstPin,
    bool? isLoading,
    bool? hasError,
    ApiError? error,
    bool? mismatch,
    int? attemptCount,
    bool? isLockedOut,
    bool clearError = false,
  }) =>
      PinFlowState(
        stage: stage ?? this.stage,
        firstPin: firstPin ?? this.firstPin,
        isLoading: isLoading ?? this.isLoading,
        hasError: hasError ?? this.hasError,
        error: clearError ? null : (error ?? this.error),
        mismatch: mismatch ?? this.mismatch,
        attemptCount: attemptCount ?? this.attemptCount,
        isLockedOut: isLockedOut ?? this.isLockedOut,
      );
}

/// Non-autoDispose on purpose: the biometric-enrollment screen needs the PIN
/// the user just set for the backend step-up call. [reset] clears it.
class PinSetupFlowNotifier extends Notifier<PinFlowState> {
  @override
  PinFlowState build() => const PinFlowState();

  void onFirstEntry(String pin) => state = state.copyWith(
        stage: PinStage.confirmEntry,
        firstPin: pin,
        clearError: true,
        hasError: false,
        mismatch: false,
      );

  Future<void> onConfirmEntry(String pin) async {
    if (pin != state.firstPin) {
      state = state.copyWith(
        hasError: true,
        mismatch: true,
        stage: PinStage.firstEntry,
        firstPin: '',
      );
      return;
    }
    state = state.copyWith(isLoading: true, clearError: true);
    final error = await ref.read(authProvider.notifier).setPin(pin);
    if (error != null) {
      state = state.copyWith(
        isLoading: false,
        stage: PinStage.firstEntry,
        firstPin: '',
        hasError: true,
        error: error,
      );
      return;
    }
    state = state.copyWith(isLoading: false, stage: PinStage.done);
  }

  /// Drops the in-memory copy of the PIN once enrollment is finished.
  void reset() => state = const PinFlowState();
}

final pinSetupFlowProvider =
    NotifierProvider<PinSetupFlowNotifier, PinFlowState>(PinSetupFlowNotifier.new);

// ---------------------------------------------------------------------------
// PIN entry (unlock) flow — backend lockout + local 5-attempt fallback
// ---------------------------------------------------------------------------

class PinEntryFlowNotifier extends AutoDisposeNotifier<PinFlowState> {
  @override
  PinFlowState build() => const PinFlowState();

  Future<bool> unlock(String pin) async {
    state = state.copyWith(isLoading: true, clearError: true, hasError: false);
    final error = await ref.read(authProvider.notifier).unlockWithPin(pin);
    if (error != null) {
      final attempts = state.attemptCount + 1;
      final isBackendLockout = error.code != null &&
          ApiErrorCodes.attemptsExhausted.contains(error.code);
      state = state.copyWith(
        isLoading: false,
        hasError: true,
        error: error,
        attemptCount: attempts,
        isLockedOut: isBackendLockout || attempts >= 5,
      );
      return false;
    }
    state = state.copyWith(
      isLoading: false,
      hasError: false,
      clearError: true,
      stage: PinStage.done,
    );
    return true;
  }

  void resetLockout() =>
      state = state.copyWith(isLockedOut: false, attemptCount: 0, clearError: true);
}

final pinEntryFlowProvider =
    AutoDisposeNotifierProvider<PinEntryFlowNotifier, PinFlowState>(
        PinEntryFlowNotifier.new);
