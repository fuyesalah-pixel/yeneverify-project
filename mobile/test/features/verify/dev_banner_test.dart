// Widget tests for the debug-only OCR banner (Phase 1 of the verification fix).
//
// The banner exists because the 0/7 receipt report was invisible in the UI:
// the app happily verified against an empty OCR mock. These tests pin the
// states that matter (fixtures present / zero fixtures), the kDebugMode gate,
// and the diagnostics sheet Fuad reads when a real receipt fails.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/verify/data/ocr_diagnostics.dart';
import 'package:yene_verify/features/verify/presentation/widgets/ocr_debug_banner.dart';

OcrDiagnostics _diagnostics({
  int fixtures = 7,
  ReadyStatus? ready = const ReadyStatus(
    status: 'ok',
    ocrStatus: 'up',
    ocrMessage: 'ocr: mock, 7 fixtures',
  ),
}) =>
    OcrDiagnostics(
      provider: 'mock',
      fixtures: fixtures,
      hint: fixtures == 0
          ? 'ocr: mock, no fixtures — real receipts will fail'
          : 'ocr: mock, $fixtures fixtures',
      bankAdapterMock: true,
      ready: ready,
      banks: const [
        BankProbe(
          bankCode: 'CBE',
          endpoint: 'https://apps.cbe.com.et:100/',
          reachable: false,
          latencyMs: 1513,
          error: 'AbortError',
        ),
        BankProbe(
          bankCode: 'AWASH',
          endpoint: 'https://awashpay.awashbank.com:8225/',
          reachable: true,
          status: 403,
          latencyMs: 90,
        ),
        BankProbe(bankCode: 'DASHEN'),
      ],
    );

Widget _app({OcrDiagnostics? diagnostics, bool visible = true}) => ProviderScope(
      overrides: [
        ocrDiagnosticsProvider.overrideWith((ref) async => diagnostics),
      ],
      child: MaterialApp(
        theme: AppTheme.lightTheme(),
        home: Scaffold(body: OcrDebugBanner(visible: visible)),
      ),
    );

void main() {
  testWidgets('debug builds show the mocked provider and fixture count',
      (tester) async {
    await tester.pumpWidget(_app(diagnostics: _diagnostics()));
    await tester.pumpAndSettle();

    expect(find.text('Dev: OCR mocked, 7 fixtures'), findsOneWidget);
  });

  testWidgets('nothing is rendered outside debug builds', (tester) async {
    await tester.pumpWidget(_app(diagnostics: _diagnostics(), visible: false));
    await tester.pumpAndSettle();

    expect(find.textContaining('Dev: OCR'), findsNothing);
    expect(find.byType(InkWell), findsNothing);
  });

  testWidgets('zero fixtures is called out as a failure', (tester) async {
    await tester.pumpWidget(
      _app(
        diagnostics: _diagnostics(
          fixtures: 0,
          ready: const ReadyStatus(
            status: 'ok',
            ocrStatus: 'degraded',
            ocrMessage: 'No fixtures — all receipts will fail',
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Dev: OCR mocked, 0 fixtures — real receipts will fail'),
      findsOneWidget,
    );
  });

  testWidgets('tapping the banner opens the diagnostics sheet',
      (tester) async {
    await tester.pumpWidget(_app(diagnostics: _diagnostics()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dev: OCR mocked, 7 fixtures'));
    await tester.pumpAndSettle();

    expect(find.text('OCR diagnostics'), findsOneWidget);
    expect(find.text('Provider'), findsOneWidget);
    // Provider and bank adapters are both the mock engine.
    expect(find.text('mock'), findsNWidgets(2));
    expect(find.text('Fixtures loaded'), findsOneWidget);
    expect(find.text('7'), findsOneWidget);
    expect(find.text('Refresh status'), findsOneWidget);
  });

  testWidgets('the sheet shows the backend URL and /health/ready result',
      (tester) async {
    await tester.pumpWidget(_app(diagnostics: _diagnostics()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dev: OCR mocked, 7 fixtures'));
    await tester.pumpAndSettle();

    expect(find.text('Backend'), findsOneWidget);
    expect(find.text('http://10.0.2.2:3000'), findsOneWidget);
    expect(find.text('Backend health'), findsOneWidget);
    expect(find.text('ok · ocr up'), findsOneWidget);
  });

  testWidgets('bank probes are listed with their probe state', (tester) async {
    await tester.pumpWidget(_app(diagnostics: _diagnostics()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Dev: OCR mocked, 7 fixtures'));
    await tester.pumpAndSettle();

    expect(find.text('CBE'), findsOneWidget);
    expect(find.textContaining('unreachable · AbortError'), findsOneWidget);
    expect(find.textContaining('HTTP 403'), findsOneWidget);
    expect(find.textContaining('not probed'), findsOneWidget);
  });

  testWidgets('an unreachable backend is reported, not thrown',
      (tester) async {
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(
      find.textContaining('OCR diagnostics unavailable'),
      findsOneWidget,
    );

    await tester.tap(find.textContaining('OCR diagnostics unavailable'));
    await tester.pumpAndSettle();

    expect(find.textContaining('GET /health/ocr'), findsOneWidget);
    expect(find.text('Refresh status'), findsOneWidget);
  });
}
