import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/presentation/widgets/verdict_actions.dart';

import '../../verdict_harness.dart';

void main() {
  Future<void> pump(
    WidgetTester tester,
    VerificationStatus status, {
    VoidCallback? onDone,
    VoidCallback? onTryAgain,
    VoidCallback? onReport,
    VoidCallback? onViewOriginal,
  }) {
    return tester.pumpWidget(
      verdictTestApp(
        VerdictActions(
          status: status,
          onDone: onDone ?? () {},
          onTryAgain: onTryAgain ?? () {},
          onReport: onReport ?? () {},
          onViewOriginal: onViewOriginal,
        ),
      ),
    );
  }

  testWidgets('VERIFIED offers Done only', (tester) async {
    var done = 0;
    await pump(tester, VerificationStatus.verified, onDone: () => done++);

    expect(find.text('Report a problem'), findsNothing);
    expect(find.text('Try again'), findsNothing);

    await tester.tap(find.text('Done'));
    expect(done, 1);
  });

  testWidgets('FAKE leads with Report a problem', (tester) async {
    var reported = 0;
    var retried = 0;
    await pump(
      tester,
      VerificationStatus.fake,
      onReport: () => reported++,
      onTryAgain: () => retried++,
    );

    await tester.tap(find.text('Report a problem'));
    await tester.tap(find.text('Try again'));

    expect(reported, 1);
    expect(retried, 1);
    expect(find.text('Done'), findsOneWidget);
  });

  testWidgets('DUPLICATE leads with View original', (tester) async {
    var viewed = 0;
    await pump(
      tester,
      VerificationStatus.duplicate,
      onViewOriginal: () => viewed++,
    );

    await tester.tap(find.text('View original'));
    expect(viewed, 1);
  });

  testWidgets('ERROR leads with Try again and offers a report', (tester) async {
    var retried = 0;
    var reported = 0;
    await pump(
      tester,
      VerificationStatus.error,
      onTryAgain: () => retried++,
      onReport: () => reported++,
    );

    await tester.tap(find.text('Try again'));
    await tester.tap(find.text('Report a problem'));

    expect(retried, 1);
    expect(reported, 1);
  });

  testWidgets('NEEDS_REVIEW leads with Try again', (tester) async {
    var retried = 0;
    await pump(
      tester,
      VerificationStatus.needsReview,
      onTryAgain: () => retried++,
    );

    await tester.tap(find.text('Try again'));
    expect(retried, 1);
    expect(find.text('Report a problem'), findsNothing);
    expect(find.text('Done'), findsNothing);
  });
}
