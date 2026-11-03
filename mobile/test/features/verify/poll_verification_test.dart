// Polling rules: backoff schedule, 30 s ceiling, terminal short-circuit,
// and 3-network-retry budget.
//
// Time is accumulated from an injected sleeper, so a 30 s timeout test runs
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
    test('is 500 ms for the first second', () {
      expect(pollIntervalFor(Duration.zero), const Duration(milliseconds: 500));
      expect(
        pollIntervalFor(const Duration(milliseconds: 999)),
        const Duration(milliseconds: 500),
      );
    });

    test('is 1 s from 1 s to 15 s', () {
      expect(pollIntervalFor(const Duration(seconds: 1)), const Duration(seconds: 1));
      expect(
        pollIntervalFor(const Duration(milliseconds: 14999)),
        const Duration(seconds: 1),
      );
    });

    test('is 2 s from 15 s onward', () {
      expect(pollIntervalFor(const Duration(seconds: 15)), const Duration(seconds: 2));
      expect(pollIntervalFor(const Duration(seconds: 30)), const Duration(seconds: 2));
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
    // 500 ms for the first second, then 1 s.
    expect(waits.take(3), [
      const Duration(milliseconds: 500),
      const Duration(milliseconds: 500),
      const Duration(seconds: 1),
    ]);
    expect(ticks.length, 3);
    expect(ticks.last, const Duration(seconds: 2));
  });

  test('times out at 30 s and never polls faster than 500 ms', () async {
    final waits = <Duration>[];

    final outcome = await PollVerification(
      fetch: (id) async => Success(resultWith('PENDING')),
      sleep: (d) async => waits.add(d),
    ).run('v-1');

    expect(outcome, isA<PollTimedOut>());
    final elapsed = (outcome as PollTimedOut).elapsed;
    expect(elapsed, greaterThanOrEqualTo(const Duration(seconds: 30)));
    expect(
      waits.every((d) => d >= const Duration(milliseconds: 500)),
      isTrue,
      reason: 'no wait may be shorter than the 500 ms floor',
    );
    // Backoff actually escalates instead of hammering at 500 ms forever.
    expect(waits.contains(const Duration(seconds: 2)), isTrue);
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
