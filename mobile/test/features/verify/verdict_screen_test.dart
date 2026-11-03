import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/network/api_result.dart';
import 'package:yene_verify/core/theme/app_colors.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/data/verifications_api.dart';
import 'package:yene_verify/features/verify/data/verify_repository.dart';
import 'package:yene_verify/features/verify/presentation/screens/verdict_screen.dart';
import 'package:yene_verify/core/widgets/layout/app_error_state.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import 'verdict_harness.dart';

class _FakeVerificationsApi extends VerificationsApi {
  _FakeVerificationsApi(this._result) : super(Dio());

  final ApiResult<VerificationResult> _result;

  @override
  Future<ApiResult<VerificationResult>> getById(String verificationId) async {
    return _result;
  }
}

Future<void> _pumpScreen(
  WidgetTester tester,
  ApiResult<VerificationResult> result,
) async {
  // The screen is a ListView; a tall surface keeps the actions built so the
  // assertions do not depend on scroll position.
  tester.view.physicalSize = const Size(1200, 2600);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        verificationsApiProvider.overrideWithValue(_FakeVerificationsApi(result)),
      ],
      child: MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          extensions: const <ThemeExtension<dynamic>>[AppColors.light],
        ),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: const VerdictScreen(verificationId: 'v-123456789'),
      ),
    ),
  );

  // Resolve the provider future, then let the 200 ms hero fade finish.
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 250));
}

void main() {
  testWidgets('VERIFIED renders the headline, facts and Done', (tester) async {
    await _pumpScreen(tester, Success(sampleVerdict()));

    expect(find.text('Payment verified'), findsOneWidget);
    expect(find.text('5,500.00 ETB'), findsOneWidget);
    expect(find.text('FT23170ABC'), findsOneWidget);
    expect(find.text('View receipt'), findsOneWidget);
    expect(find.text('Done'), findsOneWidget);
  });

  testWidgets('NEEDS_REVIEW shows the supplementary card and notification note',
      (tester) async {
    await _pumpScreen(
      tester,
      Success(sampleVerdict(status: VerificationStatus.needsReview)),
    );

    expect(find.text('Under review'), findsOneWidget);
    expect(find.text('Last 4 digits of the receiving account'), findsOneWidget);
    expect(
      find.text('You will be notified when the review is complete.'),
      findsOneWidget,
    );
  });

  testWidgets('DUPLICATE shows the original reference and View original',
      (tester) async {
    await _pumpScreen(
      tester,
      Success(sampleVerdict(status: VerificationStatus.duplicate)),
    );

    expect(find.text('Already verified'), findsOneWidget);
    expect(find.text('First verified'), findsOneWidget);
    expect(find.text('View original'), findsOneWidget);
  });

  testWidgets('ERROR shows a failed headline and a retry action', (tester) async {
    await _pumpScreen(
      tester,
      Success(
        sampleVerdict(
          status: VerificationStatus.error,
          errorCode: 'VERIFICATION_TIMEOUT',
        ),
      ),
    );

    expect(find.text('Verification failed'), findsOneWidget);
    expect(
      find.text("The bank's server is slow right now. Try again."),
      findsOneWidget,
    );
    expect(find.text('Try again'), findsOneWidget);
  });

  testWidgets('a failed fetch shows a retryable error state', (tester) async {
    await _pumpScreen(
      tester,
      const Failure<VerificationResult>(
        ApiError(code: 'NETWORK_ERROR', kind: ApiErrorKind.network),
      ),
    );
    await tester.pump();

    expect(find.byType(AppErrorState), findsOneWidget);
    expect(find.text('Try again'), findsOneWidget);
  });
}
