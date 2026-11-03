// On-device verification of the verify pipeline (Step 22B Part 1).
//
// This is the automated form of the step's manual emulator test: it runs the
// REAL app code on a real device — real flutter_image_compress, real Dio,
// real presign/PUT/complete/submit/poll against a running backend — and
// asserts that a terminal status reaches the verdict route.
//
// Requirements:
//   • backend running and reachable from the device (10.0.2.2 on emulator)
//   • a valid access token passed in as
//     --dart-define=VERIFY_TEST_TOKEN=<jwt>
//     (mint one from the host; see the step report)
//
// Run:
//   flutter test integration_test/verify_flow_test.dart -d emulator-5554 \
//     --dart-define=VERIFY_TEST_TOKEN=...
//
// The gallery/camera pickers are native UI and cannot be driven from here, so
// the test hands the captured file straight to the controller — everything
// after that (compress → upload → submit → poll → verdict) is the shipping
// code path.
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:integration_test/integration_test.dart';
import 'package:yene_verify/core/router/app_router.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/verify/data/receipts_api.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';
import 'package:yene_verify/features/verify/data/verify_repository.dart';
import 'package:yene_verify/features/verify/presentation/providers/verify_controller.dart';
import 'package:yene_verify/features/verify/presentation/screens/verify_screen.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

const String _token = String.fromEnvironment('VERIFY_TEST_TOKEN');
const String _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/api/v1',
);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'upload → compress → submit → poll → verdict on device',
    (tester) async {
      expect(_token, isNotEmpty,
          reason: 'pass --dart-define=VERIFY_TEST_TOKEN=<access token>');

      final image = await _writeTestPng();
      final dio = Dio(
        BaseOptions(
          baseUrl: _apiBaseUrl,
          headers: {'Authorization': 'Bearer $_token'},
          validateStatus: (c) => c != null && c >= 200 && c < 300,
        ),
      );

      final router = GoRouter(
        initialLocation: Routes.verify,
        routes: [
          GoRoute(
            path: Routes.verify,
            builder: (_, __) => const VerifyScreen(),
            routes: [
              GoRoute(
                path: 'result/:id',
                builder: (_, state) => Scaffold(
                  body: Text('VERDICT_PAGE:${state.pathParameters['id']}'),
                ),
              ),
            ],
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            receiptsApiProvider.overrideWithValue(ReceiptsApi(dio)),
            verificationsApiProvider.overrideWithValue(VerificationsApi(dio)),
          ],
          child: MaterialApp.router(
            routerConfig: router,
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            locale: const Locale('en'),
            theme: AppTheme.lightTheme(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Idle screen is the two-card layout.
      expect(find.text('Take Photo'), findsOneWidget);
      expect(find.text('Upload Image'), findsOneWidget);

      final container = ProviderScope.containerOf(
        tester.element(find.byType(VerifyScreen)),
      );
      final notifier = container.read(verifyControllerProvider.notifier);

      final stopwatch = Stopwatch()..start();
      await notifier.submitImage(image, InputMethod.upload);

      // Drive frames until the verdict route is pushed (polling is ~1 s).
      final deadline = DateTime.now().add(const Duration(seconds: 45));
      String lastSeen = '';
      while (find.textContaining('VERDICT_PAGE').evaluate().isEmpty &&
          DateTime.now().isBefore(deadline)) {
        await tester.pump(const Duration(milliseconds: 200));
        await Future<void>.delayed(const Duration(milliseconds: 200));
        await tester.pump();

        final s = container.read(verifyControllerProvider).valueOrNull;
        final seen = switch (s) {
          PollingState(:final elapsed) => 'Polling(${elapsed.inMilliseconds}ms)',
          ErrorState(:final code, :final message) => 'Error($code: $message)',
          _ => '${s.runtimeType}',
        };
        if (seen != lastSeen) {
          lastSeen = seen;
          // ignore: avoid_print
          print('DEVICE FLOW state=$seen t=${stopwatch.elapsedMilliseconds}ms');
        }
      }
      stopwatch.stop();

      expect(find.textContaining('VERDICT_PAGE'), findsOneWidget,
          reason: 'verdict route was never reached; last state: $lastSeen');

      // ignore: avoid_print
      print('DEVICE FLOW total=${stopwatch.elapsedMilliseconds}ms');

      final finalState = container.read(verifyControllerProvider).valueOrNull;
      // ignore: avoid_print
      print('DEVICE FLOW state=${finalState.runtimeType}');
    },
    timeout: const Timeout(Duration(minutes: 3)),
  );
}

/// Writes a real 1080x1920 PNG so compression, resize, hashing, and upload
/// all handle a realistic payload (not a 1x1 stub).
Future<File> _writeTestPng() async {
  const width = 1080;
  const height = 1920;

  // Raw RGBA rows, each prefixed with filter byte 0.
  final raw = BytesBuilder();
  for (var y = 0; y < height; y++) {
    raw.addByte(0);
    for (var x = 0; x < width; x++) {
      raw.add([255, 255, 255, 255]);
    }
  }

  // PNG chunk helpers -----------------------------------------------------------------
  Uint8List chunk(String type, List<int> data) {
    final typeBytes = ascii.encode(type);
    final body = <int>[...typeBytes, ...data];
    final out = BytesBuilder();
    out.add(_uint32be(data.length));
    out.add(body);
    out.add(_uint32be(_crc32(body)));
    return out.toBytes();
  }

  final ihdr = <int>[
    ..._uint32be(width),
    ..._uint32be(height),
    8, // bit depth
    6, // color type: RGBA
    0,
    0,
    0,
  ];

  final png = BytesBuilder()
    ..add(const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    ..add(chunk('IHDR', ihdr))
    ..add(chunk('IDAT', ZLibCodec().encode(raw.toBytes())))
    ..add(chunk('IEND', const []));

  final file = File('${Directory.systemTemp.path}/verify_e2e_receipt.png');
  await file.writeAsBytes(png.toBytes());
  return file;
}

List<int> _uint32be(int value) => [
      (value >> 24) & 0xFF,
      (value >> 16) & 0xFF,
      (value >> 8) & 0xFF,
      value & 0xFF,
    ];

int _crc32(List<int> data) {
  var crc = 0xFFFFFFFF;
  for (final byte in data) {
    crc ^= byte;
    for (var i = 0; i < 8; i++) {
      crc = (crc & 1) == 1 ? (crc >> 1) ^ 0xEDB88320 : crc >> 1;
    }
  }
  return crc ^ 0xFFFFFFFF;
}
