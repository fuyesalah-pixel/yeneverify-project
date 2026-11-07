// Polling rules: backoff schedule, 60 s pending threshold, 5-minute ceiling,
// terminal short-circuit, and 3-network-retry budget.
//
// Time is accumulated from an injected sleeper, so multi-minute schedules run
// in microseconds and the recorded waits can be asserted exactly.
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/domain/poll_verification.dart';

VerificationResult resultWith(String status) => VerificationResult.fromJson({
      'id': 'v-1',
      'status': status,
      'source': 'TRANSACTION',
    });

void main() {
  group('pollIntervalFor', () {
    test('is 500 ms for the first two seconds', () {
      expect(pollIntervalFor(Duration.zero), const Duration(milliseconds: 500));
      expect(
        pollIntervalFor(const Duration(milliseconds: 1999)),
        const Duration(milliseconds: 500),
      );
    });

    test('is 1 s from 2 s to 5 s', () {
      expect(pollIntervalFor(const Duration(seconds: 2)), const Duration(seconds: 1));
      expect(
        pollIntervalFor(const Duration(milliseconds: 4999)),
        const Duration(seconds: 1),
      );
    });

    test('is 2 s from 5 s to 15 s', () {
      expect(pollIntervalFor(const Duration(seconds: 5)), const Duration(seconds: 2));
      expect(
        pollIntervalFor(const Duration(milliseconds: 14999)),
        const Duration(seconds: 2),
      );
    });

    test('is 3 s from 15 s to 30 s', () {
      expect(pollIntervalFor(const Duration(seconds: 15)), const Duration(seconds: 3));
      expect(
        pollIntervalFor(const Duration(milliseconds: 29999)),
        const Duration(seconds: 3),
      );
    });

    test('is 5 s from 30 s to 60 s', () {
      expect(pollIntervalFor(const Duration(seconds: 30)), const Duration(seconds: 5));
      expect(
        pollIntervalFor(const Duration(milliseconds: 59999)),
        const Duration(seconds: 5),
      );
    });

    test('is 10 s from 60 s onward', () {
      expect(pollIntervalFor(const Duration(seconds: 60)), const Duration(seconds: 10));
      expect(pollIntervalFor(const Duration(minutes: 4)), const Duration(seconds: 10));
    });
  });

  test('stops on the first terminal status', () async {
    final waits = <Duration>[];
    var fetches = 0;

    final outcome = await PollVerification(
      fetch: (id) async {
        fetches++;
        return Success(resultWith('VERIFIED'));
      },
      sleep: (d) async => waits.add(d),
    ).run('v-1');

    expect(outcome, isA<PollFinished>());
    expect((outcome as PollFinished).result.status, VerificationStatus.verified);
    expect(fetches, 1);
    expect(waits, isEmpty);
  });

  test('keeps polling while PENDING and reports elapsed to the UI', () async {
    final waits = <Duration>[];
    final ticks = <Duration>[];
    var fetches = 0;

    final outcome = await PollVerification(
      fetch: (id) async {
        fetches++;
        return Success(
          resultWith(fetches < 4 ? 'PENDING' : 'FAKE'),
        );
      },
      sleep: (d) async => waits.add(d),
      onElapsed: ticks.add,
    ).run('v-1');

    expect(outcome, isA<PollFinished>());
    expect((outcome as PollFinished).result.status, VerificationStatus.fake);
    // Three pending waits, all inside the first 2 s (500 ms cadence).
    expect(waits, [
      const Duration(milliseconds: 500),
      const Duration(milliseconds: 500),
      const Duration(milliseconds: 500),
    ]);
    expect(ticks.length, 3);
    expect(ticks.last, const Duration(milliseconds: 1500));
  });

  test('a 45 s PENDING verification is picked up before the 60 s threshold',
      () async {
    var elapsed = Duration.zero;
    final pendingCalls = <Duration>[];
    final ticks = <Duration>[];

    final outcome = await PollVerification(
      fetch: (id) async => Success(
        resultWith(
          elapsed >= const Duration(seconds: 45) ? 'VERIFIED' : 'PENDING',
        ),
      ),
      sleep: (d) async => elapsed += d,
      onElapsed: ticks.add,
      onPending: pendingCalls.add,
    ).run('v-1');

    expect(outcome, isA<PollFinished>());
    expect((outcome as PollFinished).result.status, VerificationStatus.verified);
    expect(pendingCalls, isEmpty, reason: '45 s is still the active phase');
    // The UI saw the 30-60 s window and kept the calm caption.
    expect(ticks.any((d) => d >= const Duration(seconds: 30)), isTrue);
    expect(elapsed, lessThan(const Duration(seconds: 60)));
  });

  test('still polls every 10 s after the 60 s threshold and reports pending',
      () async {
    var elapsed = Duration.zero;
    final waits = <Duration>[];
    final pendingCalls = <Duration>[];

    final outcome = await PollVerification(
      fetch: (id) async => Success(
        resultWith(
          elapsed >= const Duration(seconds: 70) ? 'VERIFIED' : 'PENDING',
        ),
      ),
      sleep: (d) async {
        waits.add(d);
        elapsed += d;
      },
      onPending: pendingCalls.add,
    ).run('v-1');

    expect(outcome, isA<PollFinished>());
    expect((outcome as PollFinished).result.status, VerificationStatus.verified);
    expect(pendingCalls, [const Duration(seconds: 60)]);
    // Everything after the threshold uses the slow 10 s cadence.
    expect(
      waits.skipWhile((d) => d != const Duration(seconds: 10)).every(
            (d) => d == const Duration(seconds: 10),
          ),
      isTrue,
    );
  });

  test('stops polling at the 5-minute ceiling, never faster than 500 ms',
      () async {
    final waits = <Duration>[];
    final pendingCalls = <Duration>[];

    final outcome = await PollVerification(
      fetch: (id) async => Success(resultWith('PENDING')),
      sleep: (d) async => waits.add(d),
      onPending: pendingCalls.add,
    ).run('v-1');

    expect(outcome, isA<PollTimedOut>());
    final elapsed = (outcome as PollTimedOut).elapsed;
    expect(elapsed, greaterThanOrEqualTo(const Duration(minutes: 5)));
    expect(
      waits.every((d) => d >= const Duration(milliseconds: 500)),
      isTrue,
      reason: 'no wait may be shorter than the 500 ms floor',
    );
    // Backoff escalates through every phase instead of hammering.
    expect(waits.contains(const Duration(seconds: 2)), isTrue);
    expect(waits.contains(const Duration(seconds: 5)), isTrue);
    expect(waits.contains(const Duration(seconds: 10)), isTrue);
    expect(pendingCalls, [const Duration(seconds: 60)]);
  });

  test('retries network failures 3 times with backoff, then gives up', () async {
    final waits = <Duration>[];
    var fetches = 0;

    final outcome = await PollVerification(
      fetch: (id) async {
        fetches++;
        return const Failure<VerificationResult>(
          ApiError(code: 'NETWORK_ERROR', kind: ApiErrorKind.network),
        );
      },
      sleep: (d) async => waits.add(d),
    ).run('v-1');

    expect(outcome, isA<PollFailed>());
    expect(fetches, 4, reason: 'initial attempt + 3 retries');
    expect(waits, networkRetryBackoff);
  });

  test('survives a transient network blip and still finishes', () async {
    var fetches = 0;

    final outcome = await PollVerification(
      fetch: (id) async {
        fetches++;
        if (fetches == 2) {
          return const Failure<VerificationResult>(
            ApiError(code: 'NETWORK_ERROR', kind: ApiErrorKind.network),
          );
        }
        return Success(resultWith(fetches >= 3 ? 'VERIFIED' : 'PENDING'));
      },
      sleep: (_) async {},
    ).run('v-1');

    expect(outcome, isA<PollFinished>());
    expect(fetches, 3);
  });

  test('fails immediately on a non-network error (no pointless retries)',
      () async {
    final waits = <Duration>[];
    var fetches = 0;

    final outcome = await PollVerification(
      fetch: (id) async {
        fetches++;
        return const Failure<VerificationResult>(
          ApiError(code: 'UNAUTHORIZED', httpStatus: 401),
        );
      },
      sleep: (d) async => waits.add(d),
    ).run('v-1');

    expect(outcome, isA<PollFailed>());
    expect((outcome as PollFailed).error.code, 'UNAUTHORIZED');
    expect(fetches, 1);
    expect(waits, isEmpty);
  });
}
