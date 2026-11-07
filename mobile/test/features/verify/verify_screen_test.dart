// Widget tests for the verify screen (Step 22B Part 1).
//
// The controller is replaced by a fake so no network, camera, or picker
// plugin is touched; navigation goes through a real GoRouter so the
// verdict push is exercised, not stubbed.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/core/router/app_router.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/transactions/presentation/providers/transactions_provider.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/presentation/providers/verify_controller.dart';
import 'package:yene_verify/features/verify/presentation/screens/verify_screen.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

class _FakeVerifyController extends VerifyController {
  _FakeVerifyController(this.initial);

  final VerifyState initial;

  int cameraCalls = 0;
  int galleryCalls = 0;
  int retryCalls = 0;
  int refreshPendingCalls = 0;

  @override
  Future<VerifyState> build() async => initial;

  @override
  void startCamera() => cameraCalls++;

  @override
  Future<void> startGallery() async => galleryCalls++;

  @override
  Future<void> refreshPending() async => refreshPendingCalls++;

  @override
  void retry() {
    retryCalls++;
    state = const AsyncData(IdleState());
  }

  void emit(VerifyState next) => state = AsyncData(next);
}

VerificationResult _verifiedResult() => VerificationResult.fromJson({
      'id': 'v-42',
      'status': 'VERIFIED',
      'source': 'TRANSACTION',
      'bankCode': 'CBE',
      'bankReference': 'FT123',
    });

VerificationResult _errorResult() => VerificationResult.fromJson({
      'id': 'v-99',
      'status': 'ERROR',
      'source': 'TRANSACTION',
      'bankCode': 'CBE',
      'bankReference': 'FT123',
      'errorCode': 'VERIFICATION_BANK_NOT_DETECTED',
      'errorMessage':
          'We could not detect a bank in the uploaded receipt image. Try another image.',
    });

Widget _app(_FakeVerifyController fake) {
  final router = GoRouter(
    initialLocation: Routes.verify,
    routes: [
      GoRoute(
        path: Routes.verify,
        builder: (_, __) => const VerifyScreen(),
        routes: [
          GoRoute(
            path: 'camera',
            builder: (_, __) => const Scaffold(body: Text('CAMERA_ROUTE')),
          ),
          GoRoute(
            path: 'result/:id',
            builder: (_, state) => Scaffold(
              body: Text('VERDICT_ROUTE:${state.pathParameters['id']}'),
            ),
          ),
        ],
      ),
      GoRoute(
        path: Routes.history,
        builder: (_, __) => const Scaffold(body: Text('HISTORY_ROUTE')),
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      verifyControllerProvider.overrideWith(() => fake),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      theme: AppTheme.lightTheme(),
    ),
  );
}

void main() {
  testWidgets('idle renders heading, subtitle, and the two action cards',
      (tester) async {
    await tester.pumpWidget(_app(_FakeVerifyController(const IdleState())));
    await tester.pump();

    expect(find.text('Verify a payment'), findsOneWidget);
    expect(
      find.text(
        "Upload or photograph the customer's bank confirmation to verify it in seconds.",
      ),
      findsOneWidget,
    );
    expect(find.text('Take Photo'), findsOneWidget);
    expect(find.text('Use your camera to capture the receipt'), findsOneWidget);
    expect(find.text('Upload Image'), findsOneWidget);
    expect(
      find.text('Choose a screenshot from your gallery'),
      findsOneWidget,
    );
    // Tab root: no back affordance.
    expect(find.byType(BackButton), findsNothing);
  });

  testWidgets('tapping Take Photo starts the camera flow and opens the route',
      (tester) async {
    final fake = _FakeVerifyController(const IdleState());
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    await tester.tap(find.text('Take Photo'));
    await tester.pumpAndSettle();

    expect(fake.cameraCalls, 1);
    expect(find.text('CAMERA_ROUTE'), findsOneWidget);
  });

  testWidgets('tapping Upload Image starts the gallery flow', (tester) async {
    final fake = _FakeVerifyController(const IdleState());
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    await tester.tap(find.text('Upload Image'));
    await tester.pumpAndSettle();

    expect(fake.galleryCalls, 1);
    // The fake keeps the idle state, so the cards are still on screen.
    expect(find.text('Take Photo'), findsOneWidget);
  });

  testWidgets('error state shows the mapped message and a retry button',
      (tester) async {
    final fake = _FakeVerifyController(
      const ErrorState(
        code: 'RECEIPT_TOO_LARGE',
        message: 'Image too large. Try a smaller screenshot.',
      ),
    );
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    expect(find.text('Image too large. Try a smaller screenshot.'),
        findsOneWidget);

    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(fake.retryCalls, 1);
  });

  testWidgets('non-retryable error offers only the way back', (tester) async {
    final fake = _FakeVerifyController(
      const ErrorState(
        code: 'CREDITS_EXHAUSTED',
        message: "You're out of credits. Top up to continue.",
        retryable: false,
      ),
    );
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    expect(find.text("You're out of credits. Top up to continue."),
        findsOneWidget);
    expect(find.text('Try again'), findsNothing);
    expect(find.text('Back to verify'), findsOneWidget);
  });

  testWidgets('a terminal result navigates to the verdict route',
      (tester) async {
    final fake = _FakeVerifyController(const IdleState());
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    fake.emit(ResultState(_verifiedResult()));
    await tester.pumpAndSettle();

    expect(find.text('VERDICT_ROUTE:v-42'), findsOneWidget);
  });

  testWidgets('a terminal ERROR result also navigates to the verdict route',
      (tester) async {
    final fake = _FakeVerifyController(const IdleState());
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    fake.emit(ResultState(_errorResult()));
    await tester.pumpAndSettle();

    expect(find.text('VERDICT_ROUTE:v-99'), findsOneWidget);
  });

  testWidgets('pending state stays calm — no timeout error, manual refresh',
      (tester) async {
    final fake = _FakeVerifyController(
      const PendingVerificationState(verificationId: 'v-7'),
    );
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    expect(find.text('Still verifying…'), findsOneWidget);
    expect(
      find.text(
        'Still verifying — this can take up to a minute for some banks.',
      ),
      findsOneWidget,
    );
    expect(find.text('Refresh now'), findsOneWidget);
    expect(find.text('Check transactions'), findsOneWidget);
    expect(find.textContaining('taking too long'), findsNothing);

    await tester.tap(find.text('Refresh now'));
    await tester.pump();

    expect(fake.refreshPendingCalls, 1);
  });

  testWidgets('pending state opens transactions filtered to PENDING',
      (tester) async {
    final fake = _FakeVerifyController(
      const PendingVerificationState(verificationId: 'v-7'),
    );
    await tester.pumpWidget(_app(fake));
    await tester.pump();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(VerifyScreen)),
    );

    await tester.tap(find.text('Check transactions'));
    await tester.pumpAndSettle();

    expect(find.text('HISTORY_ROUTE'), findsOneWidget);
    expect(
      container.read(transactionsQueryProvider).statuses,
      {VerificationStatus.pending},
    );
  });

  testWidgets('polling shows the verifying skeleton and the expectation caption',
      (tester) async {
    await tester.pumpWidget(
      _app(
        _FakeVerifyController(
          const PollingState(verificationId: 'v-1'),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Verifying…'), findsOneWidget);
    expect(find.text('This takes a few seconds…'), findsOneWidget);
    // Shimmer animates forever; settle is not required and would hang.
  });

  testWidgets('uploads show a real percentage', (tester) async {
    await tester.pumpWidget(
      _app(_FakeVerifyController(const UploadingState(0.42))),
    );
    await tester.pump();

    expect(find.text('Uploading… 42%'), findsOneWidget);
  });
}
