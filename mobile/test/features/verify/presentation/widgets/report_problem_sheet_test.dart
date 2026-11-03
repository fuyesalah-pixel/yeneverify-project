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
import 'package:yene_verify/features/verify/presentation/widgets/report_problem_sheet.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

class _FakeVerificationsApi extends VerificationsApi {
  _FakeVerificationsApi({this.failure}) : super(Dio());

  final ApiError? failure;
  String? reason;

  @override
  Future<ApiResult<ReviewRequested>> requestReview(
    String verificationId, {
    required String reason,
  }) async {
    this.reason = reason;
    if (failure != null) return Failure(failure!);
    return Success(
      ReviewRequested(
        verificationId: verificationId,
        reviewId: 'review-1',
        status: VerificationStatus.needsReview,
      ),
    );
  }
}

Future<void> _pumpHost(WidgetTester tester, _FakeVerificationsApi api) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [verificationsApiProvider.overrideWithValue(api)],
      child: MaterialApp(
        theme: ThemeData(
          useMaterial3: true,
          extensions: const <ThemeExtension<dynamic>>[AppColors.light],
        ),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () =>
                  ReportProblemSheet.show(context, verificationId: 'v-1'),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    ),
  );

  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('requires a reason before submitting', (tester) async {
    final api = _FakeVerificationsApi();
    await _pumpHost(tester, api);

    await tester.tap(find.text('Submit report'));
    await tester.pump();

    expect(find.text('Tell us what is wrong before submitting.'), findsOneWidget);
    expect(api.reason, isNull);
  });

  testWidgets('submits the trimmed reason to request-review', (tester) async {
    final api = _FakeVerificationsApi();
    await _pumpHost(tester, api);

    await tester.enterText(
      find.byType(TextFormField),
      '  Amount does not match the receipt  ',
    );
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();

    expect(api.reason, 'Amount does not match the receipt');
    expect(find.text('Report a problem'), findsNothing);
  });

  testWidgets('shows the failure inline and keeps the sheet open',
      (tester) async {
    final api = _FakeVerificationsApi(failure: const ApiError());
    await _pumpHost(tester, api);

    await tester.enterText(find.byType(TextFormField), 'Wrong amount shown');
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();

    expect(find.text('Something went wrong. Please try again.'), findsOneWidget);
    expect(find.text('Submit report'), findsOneWidget);
  });
}
