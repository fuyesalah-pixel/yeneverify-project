import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/presentation/widgets/verdict_hero.dart';

import '../../verdict_harness.dart';

void main() {
  testWidgets('VERIFIED shows the amount, headline and payer', (tester) async {
    await tester.pumpWidget(
      verdictTestApp(VerdictHero(result: sampleVerdict())),
    );

    expect(find.text('5,500.00 ETB'), findsOneWidget);
    expect(find.text('Payment verified'), findsOneWidget);
    expect(find.text('Paid by Abebe Kebede'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
  });

  testWidgets('FAKE explains the receipt was not found', (tester) async {
    await tester.pumpWidget(
      verdictTestApp(
        VerdictHero(result: sampleVerdict(status: VerificationStatus.fake)),
      ),
    );

    expect(find.text('Fake receipt'), findsOneWidget);
    expect(
      find.text("This receipt was not found on the bank's server."),
      findsOneWidget,
    );
  });

  testWidgets('DUPLICATE names the date of the first verification', (tester) async {
    await tester.pumpWidget(
      verdictTestApp(
        VerdictHero(result: sampleVerdict(status: VerificationStatus.duplicate)),
      ),
    );

    expect(find.text('Already verified'), findsOneWidget);
    expect(
      find.text('This receipt was already verified on 14 Jul 2026.'),
      findsOneWidget,
    );
  });

  testWidgets('NEEDS_REVIEW asks for a clearer photo when supplementary', (tester) async {
    await tester.pumpWidget(
      verdictTestApp(
        VerdictHero(result: sampleVerdict(status: VerificationStatus.needsReview)),
      ),
    );

    expect(find.text('Under review'), findsOneWidget);
    expect(
      find.text(
        'We need a clearer photo of this receipt to finish verifying it.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('ERROR maps the backend error code to localized copy',
      (tester) async {
    await tester.pumpWidget(
      verdictTestApp(
        VerdictHero(
          result: sampleVerdict(
            status: VerificationStatus.error,
            errorCode: 'VERIFICATION_BANK_NOT_DETECTED',
          ),
        ),
      ),
    );

    expect(find.text('Verification failed'), findsOneWidget);
    expect(
      find.text(
        'We could not identify the bank on this receipt. Try a clearer photo.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('the icon fades in once, in 200 ms, and never repeats',
      (tester) async {
    await tester.pumpWidget(
      verdictTestApp(VerdictHero(result: sampleVerdict())),
    );

    FadeTransition fade() => tester.widget<FadeTransition>(
          find.byKey(const ValueKey('verdictHeroIcon')),
        );

    // The first pump after the post-frame callback starts the ticker at 0.
    await tester.pump();
    expect(fade().opacity.value, 0);
    await tester.pump(const Duration(milliseconds: 200));
    expect(fade().opacity.value, 1);

    // Hold for three more seconds: no looping, no bounce-back.
    await tester.pump(const Duration(seconds: 3));
    expect(fade().opacity.value, 1);
  });
}
