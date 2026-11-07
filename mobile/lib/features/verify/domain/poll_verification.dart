// Polling helper for GET /verifications/:id.
//
// Two hard rules from the spec:
//   • never poll faster than 500 ms,
//   • never give up while the backend may still finish.
//
// Schedule (elapsed time since the first request):
//   0 – 2 s    → every 500 ms   (fast first look: most verdicts land here)
//   2 – 5 s    → every 1 s      (normal processing window)
//   5 – 15 s   → every 2 s
//   15 – 30 s  → every 3 s
//   30 – 60 s  → every 5 s      (slow banks: CBE retries can take ~51 s)
//   ≥ 60 s     → every 10 s, for up to 5 minutes (background-ish pending)
//
// At 60 s the run emits [PollVerification.onPending] so the UI can switch to
// a calm "still verifying" state instead of an error; the loop keeps checking
// until the 5-minute hard ceiling. The UI must never show "taking too long"
// while the backend may still produce a verdict.
//
// Network errors are retried 3 times with their own 500/1000/2000 ms
// backoff, then surfaced as a failure. Non-network errors (404, 401, 403)
// fail immediately — retrying a permission error just burns time.
//
// Time is *accumulated from the injected sleeper* instead of read from the
// wall clock so the schedule is testable without real waiting.
import '../../../core/network/api_error.dart';
import '../../../core/network/api_result.dart';
import '../data/models/verification_result.dart';

/// Result of a polling run.
sealed class PollOutcome {
  const PollOutcome();
}

class PollFinished extends PollOutcome {
  const PollFinished(this.result);
  final VerificationResult result;
}

class PollTimedOut extends PollOutcome {
  const PollTimedOut(this.elapsed);
  final Duration elapsed;
}

class PollFailed extends PollOutcome {
  const PollFailed(this.error);
  final ApiError error;
}

/// Interval between polls at a given elapsed time.
Duration pollIntervalFor(Duration elapsed) {
  if (elapsed < const Duration(seconds: 2)) {
    return const Duration(milliseconds: 500);
  }
  if (elapsed < const Duration(seconds: 5)) return const Duration(seconds: 1);
  if (elapsed < const Duration(seconds: 15)) return const Duration(seconds: 2);
  if (elapsed < const Duration(seconds: 30)) return const Duration(seconds: 3);
  if (elapsed < const Duration(seconds: 60)) return const Duration(seconds: 5);
  return const Duration(seconds: 10);
}

/// Backoff applied before each network retry (index = retry number).
const List<Duration> networkRetryBackoff = [
  Duration(milliseconds: 500),
  Duration(seconds: 1),
  Duration(seconds: 2),
];

class PollVerification {
  PollVerification({
    required Future<ApiResult<VerificationResult>> Function(String id) fetch,
    this.pendingAfter = const Duration(seconds: 60),
    this.hardTimeout = const Duration(minutes: 5),
    this.maxNetworkRetries = 3,
    Future<void> Function(Duration)? sleep,
    this.onElapsed,
    this.onPending,
  })  : _fetch = fetch,
        _sleep = sleep ?? ((d) => Future<void>.delayed(d));

  final Future<ApiResult<VerificationResult>> Function(String id) _fetch;

  /// Elapsed time after which the UI should switch to a "still verifying"
  /// state while the loop keeps polling every 10 s.
  final Duration pendingAfter;

  /// Absolute ceiling; after this the loop stops polling.
  final Duration hardTimeout;

  final int maxNetworkRetries;
  final Future<void> Function(Duration) _sleep;

  /// Called after each wait with the accumulated elapsed time, so the UI can
  /// swap "This takes a few seconds…" for "Still verifying…".
  final void Function(Duration elapsed)? onElapsed;

  /// Called once when [pendingAfter] is reached. The run keeps polling.
  final void Function(Duration elapsed)? onPending;

  Future<PollOutcome> run(String verificationId) async {
    var elapsed = Duration.zero;
    var networkFailures = 0;
    var pendingNotified = false;

    while (true) {
      if (elapsed >= hardTimeout) return PollTimedOut(elapsed);

      if (!pendingNotified && elapsed >= pendingAfter) {
        pendingNotified = true;
        onPending?.call(elapsed);
      }

      final result = await _fetch(verificationId);

      switch (result) {
        case Success<VerificationResult>(:final data):
          networkFailures = 0;
          if (data.isTerminal) return PollFinished(data);
          // Still PENDING — wait out the interval for the current phase.
          final wait = pollIntervalFor(elapsed);
          await _sleep(wait);
          elapsed += wait;
          onElapsed?.call(elapsed);

        case Failure<VerificationResult>(:final error):
          if (!error.isNetwork || networkFailures >= maxNetworkRetries) {
            return PollFailed(error);
          }
          // Clamp so a 4th failure cannot index past the backoff table.
          final wait = networkRetryBackoff[
              networkFailures.clamp(0, networkRetryBackoff.length - 1)];
          networkFailures += 1;
          await _sleep(wait);
          elapsed += wait;
          onElapsed?.call(elapsed);
      }
    }
  }
}
