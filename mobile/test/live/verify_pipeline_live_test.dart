// OPT-IN live backend smoke test for the verify pipeline.
//
// Skipped by default. Run it against a locally running backend with:
//
//   flutter test test/live/verify_pipeline_live_test.dart \
//     --dart-define=API_BASE_URL=http://localhost:3000/api/v1
//   (env LIVE_BACKEND=1)
//
// It exercises the SAME classes the app ships (ReceiptsApi, VerificationsApi,
// VerifyRepository) against real endpoints: presign → PUT → complete →
// submit → poll. Compression is not exercised here because
// flutter_image_compress needs a platform; that is covered by the unit tests
// (image_prep_test.dart) and on-device.
//
// The OTP code is read from the dev server log, which is how the manual
// emulator flow obtains it too.
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/env/app_env.dart';
import 'package:yene_verify/features/verify/domain/image_prep.dart';
import 'package:yene_verify/features/verify/data/receipts_api.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';
import 'package:yene_verify/features/verify/data/verify_repository.dart';
import 'package:yene_verify/features/verify/domain/poll_verification.dart';

/// Smallest valid JPEG (1x1, white) — the backend only checks type/size/hash,
/// so a real image keeps the upload representative without a fixture file.
const String _onePixelJpegBase64 =
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy'
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAED'
    'ASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUF'
    'BAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0'
    'NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKj'
    'pKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QA'
    'HwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEE'
    'BSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZH'
    'SElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0'
    'tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3'
    '+iiigD//2Q==';

void main() {
  final live = Platform.environment['LIVE_BACKEND'] == '1';

  group(
    'live verify pipeline',
    skip: live ? false : 'set LIVE_BACKEND=1 and a running backend',
    () {
      late Dio api;
      late VerifyRepository repo;

      setUpAll(() async {
        final phone = '+2519${DateTime.now().microsecondsSinceEpoch % 100000000}'
            .padRight(13, '0')
            .substring(0, 13);

        final token = await _login(phone);
        api = Dio(
          BaseOptions(
            baseUrl: AppEnv.apiBaseUrl,
            headers: {'Authorization': 'Bearer $token'},
            validateStatus: (c) => c != null && c >= 200 && c < 300,
          ),
        );

        // A fresh account is a MERCHANT with no profile; the verify endpoints
        // are tenant-scoped, so onboard first.
        await api.post(
          '/onboarding/merchant',
          data: {'businessName': 'Live Verify Smoke ${DateTime.now().millisecondsSinceEpoch}'},
        );

        repo = VerifyRepository(
          receipts: ReceiptsApi(api),
          verifications: VerificationsApi(api),
        );
      });

      test('upload → complete → submit → poll reaches a terminal status', () async {
        final bytes = base64Decode(_onePixelJpegBase64);
        final image = PreparedImage(
          bytes: bytes,
          size: bytes.length,
          sha256: sha256.convert(bytes).toString(),
          mimeType: 'image/jpeg',
          width: 1,
          height: 1,
        );

        final stopwatch = Stopwatch()..start();
        final progress = <double>[];

        final submitted = await repo.submit(
          image: image,
          inputMethod: InputMethod.upload,
          onProgress: progress.add,
        );

        expect(submitted.isSuccess, isTrue,
            reason: 'submit failed: ${submitted.errorOrNull}');
        final verification = submitted.dataOrNull!;
        expect(verification.verificationId, isNotEmpty);

        final outcome = await repo.poll(verification.verificationId);
        stopwatch.stop();

        expect(outcome, isA<PollFinished>(),
            reason: 'poll did not finish: $outcome');
        final result = (outcome as PollFinished).result;
        expect(result.isTerminal, isTrue);

        // Recorded for the step report: a 1x1 JPEG is expected to fail OCR
        // with a bank-not-detected error, which is still a valid verdict.
        // ignore: avoid_print
        print(
          'LIVE verify: id=${result.id} status=${result.status.wire} '
          'error=${result.errorCode} uploadProgress=${progress.length} samples '
          'total=${stopwatch.elapsedMilliseconds}ms',
        );
      }, timeout: const Timeout(Duration(minutes: 2)));
    },
  );
}

Future<String> _login(String phone) async {
  final dio = Dio(
    BaseOptions(
      baseUrl: AppEnv.apiBaseUrl,
      validateStatus: (c) => c != null && c >= 200 && c < 300,
    ),
  );

  // Capture how much of the log already exists, so an OTP from an earlier
  // run (whose masked phone can collide with this one) is never picked up.
  final fromByte = (await _findLogFile())?.lengthSync() ?? 0;

  await dio.post('/auth/request-otp', data: {'phone': phone});

  final code = await _readLatestOtpCode(phone, fromByte: fromByte);
  expect(code, isNotNull, reason: 'no OTP found in backend/dev-server.log');

  late Response<dynamic> res;
  try {
    res = await dio.post('/auth/verify-otp', data: {
      'phone': phone,
      'code': code,
      'device': {'fingerprint': 'live-verify-smoke', 'platform': 'ANDROID'},
    });
  } on DioException catch (e) {
    // ignore: avoid_print
    print('verify-otp failed phone=$phone code=$code body=${e.response?.data}');
    rethrow;
  }

  final body = res.data as Map<String, dynamic>;
  final payload = (body['data'] as Map<String, dynamic>?) ?? body;
  return (payload['tokens'] as Map)['accessToken'] as String;
}

/// Locates `backend/dev-server.log` by walking up from the cwd.
///
/// `flutter test` does not guarantee cwd == package root, so the repo root
/// (the directory that holds backend/) is searched for explicitly.
Future<File?> _findLogFile() async {
  var dir = Directory.current;
  for (var i = 0; i < 4; i++) {
    final candidate = File('${dir.path}/backend/dev-server.log');
    if (candidate.existsSync()) return candidate;
    if (dir.parent.path == dir.path) break;
    dir = dir.parent;
  }
  return null;
}

/// Reads the newest `code: "123456"` entry written AT OR AFTER `fromByte`.
///
/// The file contains ANSI escapes and non-UTF8 bytes, so it is decoded
/// leniently instead of line-by-line.
Future<String?> _readLatestOtpCode(String phone, {int fromByte = 0}) async {
  final log = await _findLogFile();
  if (log == null) {
    // ignore: avoid_print
    print('OTP log not found from cwd=${Directory.current.path}');
    return null;
  }

  // Several phones request OTPs on this machine, so anchor on THIS phone's
  // masked form (the mock sender logs `+2519*****XX`) and take the first
  // code that follows it. The log is written through a redirect, so it can
  // lag the HTTP response by a few hundred ms — poll briefly.
  final mask = '+2519*****${phone.substring(phone.length - 2)}';

  for (var attempt = 0; attempt < 20; attempt++) {
    final all = await log.readAsBytes();
    final raw = utf8.decode(
      fromByte < all.length ? all.sublist(fromByte) : const <int>[],
      allowMalformed: true,
    );
    // Nest colorizes the log (`code` and `:` are separated by an ANSI
    // escape), so strip escapes before matching.
    final text = raw.replaceAll(RegExp(r'\x1B\[[0-9;]*[A-Za-z]'), '');
    // A phone's masked form appears in several log entries (send + requested
    // + any failed verify), and only the send entry carries a code, so pair
    // each code with the mask that precedes it.
    final codeRe = RegExp(r'''code['"]?\s*[:=]\s*['"]?(\d{6})''');
    String? found;
    for (final m in codeRe.allMatches(text)) {
      final start = m.start - 400;
      final window = text.substring(start < 0 ? 0 : start, m.start);
      if (window.contains(mask)) found = m.group(1);
    }
    if (found != null) return found;
    if (attempt == 19) {
      // ignore: avoid_print
      print('OTP debug: mask=$mask log=${log.path} '
          'hasMaskPrefix=${text.contains('+2519*****')} '
          'tail=${text.substring(text.length > 400 ? text.length - 400 : 0)}');
    }
    await Future<void>.delayed(const Duration(milliseconds: 250));
  }
  return null;
}
