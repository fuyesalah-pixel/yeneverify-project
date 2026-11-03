// Polling helper for GET /verifications/:id.
//
// Two hard rules from the spec:
//   • never poll faster than 500 ms,
//   • never poll forever (30 s ceiling).
//
// Schedule (elapsed time since the first request):
//   0 – 1 s    → every 500 ms   (fast first look: most verdicts land here)
//   1 – 15 s   → every 1 s      (normal processing window)
//   15 – 30 s  → every 2 s      (slow queue; back off so we stop hammering)
//   ≥ 30 s     → give up with a retryable timeout
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
  if (elapsed < const Duration(seconds: 1)) return const Duration(milliseconds: 500);
  if (elapsed < const Duration(seconds: 15)) return const Duration(seconds: 1);
  return const Duration(seconds: 2);
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
    this.timeout = const Duration(seconds: 30),
    this.maxNetworkRetries = 3,
    Future<void> Function(Duration)? sleep,
    this.onElapsed,
  })  : _fetch = fetch,
        _sleep = sleep ?? ((d) => Future<void>.delayed(d));

  final Future<ApiResult<VerificationResult>> Function(String id) _fetch;
  final Duration timeout;
  final int maxNetworkRetries;
  final Future<void> Function(Duration) _sleep;

  /// Called after each wait with the accumulated elapsed time, so the UI can
  /// swap "This takes a few seconds…" for "Still verifying…".
  final void Function(Duration elapsed)? onElapsed;

  Future<PollOutcome> run(String verificationId) async {
    var elapsed = Duration.zero;
    var networkFailures = 0;

    while (true) {
      if (elapsed >= timeout) return PollTimedOut(elapsed);

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
