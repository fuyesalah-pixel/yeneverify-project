// On-device verification of the Step 22B.2 verdict screen.
//
// Unlike verify_flow_test.dart (which proves a terminal status reaches the
// verdict ROUTE), this test proves the verdict SCREEN renders real backend
// data: it uploads a receipt through the shipping APIs, waits for a terminal
// status, deep-links to /verify/result/:id and asserts the hero, the status
// headline and the receipt row are on screen.
//
// Requirements:
//   • backend running and reachable from the device (10.0.2.2 on emulator)
//   • a valid access token: --dart-define=VERIFY_TEST_TOKEN=<jwt>
//
// Run:
//   flutter test integration_test/verdict_screen_test.dart -d emulator-5554 \
//     --dart-define=VERIFY_TEST_TOKEN=...
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:integration_test/integration_test.dart';
import 'package:yene_verify/core/router/app_router.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/data/receipts_api.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';
import 'package:yene_verify/features/verify/data/verify_repository.dart';
import 'package:yene_verify/features/verify/presentation/screens/verdict_screen.dart';
import 'package:yene_verify/features/verify/presentation/verdict_copy.dart';
import 'package:yene_verify/features/verify/presentation/widgets/verdict_hero.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

const String _token = String.fromEnvironment('VERIFY_TEST_TOKEN');
const String _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/api/v1',
);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'verdict screen renders the real verification by id',
    (tester) async {
      expect(_token, isNotEmpty,
          reason: 'pass --dart-define=VERIFY_TEST_TOKEN=<access token>');

      final dio = Dio(
        BaseOptions(
          baseUrl: _apiBaseUrl,
          headers: {'Authorization': 'Bearer $_token'},
          validateStatus: (c) => c != null && c >= 200 && c < 300,
        ),
      );
      final receipts = ReceiptsApi(dio);
      final verifications = VerificationsApi(dio);

      final verificationId = await _submitReceipt(receipts, verifications);
      // ignore: avoid_print
      print('VERDICT_E2E verification=$verificationId');

      final terminal = await _awaitTerminal(verifications, verificationId);
      // ignore: avoid_print
      print('VERDICT_E2E status=${terminal.status.wire}');

      final router = GoRouter(
        initialLocation: Routes.verdictFor(verificationId),
        routes: [
          GoRoute(
            path: '${Routes.verdict}/:id',
            builder: (_, state) => VerdictScreen(
              verificationId: state.pathParameters['id'] ?? '',
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            receiptsApiProvider.overrideWithValue(receipts),
            verificationsApiProvider.overrideWithValue(verifications),
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

      // Drive frames until the screen's own GET resolves and the hero paints.
      final deadline = DateTime.now().add(const Duration(seconds: 20));
      while (find.byType(VerdictHero).evaluate().isEmpty &&
          DateTime.now().isBefore(deadline)) {
        await tester.pump(const Duration(milliseconds: 200));
        await Future<void>.delayed(const Duration(milliseconds: 200));
      }

      expect(find.byType(VerdictHero), findsOneWidget,
          reason: 'verdict screen never left its loading state');

      final l10n = AppLocalizations.of(tester.element(find.byType(VerdictHero)));
      expect(find.text(verdictHeadline(l10n, terminal.status)), findsOneWidget);

      // The receipt row proves the screen read the stored receipt id, not
      // just the status.
      expect(find.text('View receipt'), findsOneWidget);

      await tester.pump(const Duration(milliseconds: 300));
      expect(tester.takeException(), isNull);
    },
    timeout: const Timeout(Duration(minutes: 4)),
  );
}

/// Uploads a real PNG through the shipping APIs and returns the verification
/// id the screen will fetch.
Future<String> _submitReceipt(
  ReceiptsApi receipts,
  VerificationsApi verifications,
) async {
  final file = await _writeTestPng();
  final bytes = await file.readAsBytes();

  final presign = await receipts.presign(
    fileName: 'verdict_e2e.png',
    mimeType: 'image/png',
    sizeBytes: bytes.length,
    inputMethod: InputMethod.upload,
  );
  final ticket = presign.dataOrNull;
  expect(ticket, isNotNull, reason: 'presign failed: ${presign.errorOrNull}');

  final upload = await receipts.upload(
    presign: ticket!,
    bytes: bytes,
    mimeType: 'image/png',
  );
  expect(upload.isSuccess, isTrue,
      reason: 'upload failed: ${upload.errorOrNull}');

  final complete = await receipts.complete(
    storageKey: ticket.storageKey,
    inputMethod: InputMethod.upload,
    sha256: sha256.convert(bytes).toString(),
  );
  expect(complete.dataOrNull, isNotNull,
      reason: 'complete failed: ${complete.errorOrNull}');

  final submitted = await verifications.submit(
    receiptId: complete.dataOrNull!.receiptId,
  );
  expect(submitted.dataOrNull, isNotNull,
      reason: 'submit failed: ${submitted.errorOrNull}');

  return submitted.dataOrNull!.verificationId;
}

Future<VerificationResult> _awaitTerminal(
  VerificationsApi verifications,
  String verificationId,
) async {
  final deadline = DateTime.now().add(const Duration(seconds: 60));
  VerificationResult? terminal;

  while (DateTime.now().isBefore(deadline)) {
    final result = await verifications.getById(verificationId);
    final data = result.dataOrNull;
    if (data != null && data.isTerminal) {
      terminal = data;
      break;
    }
    await Future<void>.delayed(const Duration(milliseconds: 750));
  }

  expect(terminal, isNotNull,
      reason: 'verification $verificationId never reached a terminal status');
  return terminal!;
}

/// A real 720x1280 PNG so compression, hashing and upload handle a
/// realistic payload.
Future<File> _writeTestPng() async {
  const width = 720;
  const height = 1280;

  final raw = BytesBuilder();
  for (var y = 0; y < height; y++) {
    raw.addByte(0);
    for (var x = 0; x < width; x++) {
      raw.add([255, 255, 255, 255]);
    }
  }

  Uint8List chunk(String type, List<int> data) {
    final body = <int>[...ascii.encode(type), ...data];
    return (BytesBuilder()
          ..add(_uint32be(data.length))
          ..add(body)
          ..add(_uint32be(_crc32(body))))
        .toBytes();
  }

  final ihdr = <int>[
    ..._uint32be(width),
    ..._uint32be(height),
    8,
    6,
    0,
    0,
    0,
  ];

  final png = (BytesBuilder()
        ..add(const [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        ..add(chunk('IHDR', ihdr))
        ..add(chunk('IDAT', ZLibCodec().encode(raw.toBytes())))
        ..add(chunk('IEND', const [])))
      .toBytes();

  final file = File('${Directory.systemTemp.path}/verdict_e2e_receipt.png');
  await file.writeAsBytes(png);
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
