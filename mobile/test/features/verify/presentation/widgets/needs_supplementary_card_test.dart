// Part 0: NEEDS_REVIEW with a missing bank identifier points at settings.
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/features/verify/data/models/verification_result.dart';
import 'package:yene_verify/features/verify/presentation/widgets/needs_supplementary_card.dart';

import '../../verdict_harness.dart';

void main() {
  testWidgets('renders nothing without a supplementary prompt',
      (tester) async {
    await tester.pumpWidget(verdictTestApp(
      const NeedsSupplementaryCard(prompt: null, onConfigure: null),
    ));

    expect(find.text('Add your bank account details'), findsNothing);
    expect(find.text('Configure now'), findsNothing);
  });

  testWidgets('shows the prompt and opens the accounts screen', (tester) async {
    var configured = 0;
    const prompt = SupplementaryPrompt(
      field: 'accountSuffix',
      hint: 'Last 4 digits of the receiving account',
    );

    await tester.pumpWidget(verdictTestApp(
      NeedsSupplementaryCard(
        prompt: prompt,
        onConfigure: () => configured++,
      ),
    ));

    expect(find.text('Add your bank account details'), findsOneWidget);
    expect(
      find.text('Last 4 digits of the receiving account'),
      findsOneWidget,
    );

    await tester.tap(find.text('Configure now'));
    expect(configured, 1);
  });

  testWidgets('hides the action when no configure callback is supplied',
      (tester) async {
    const prompt = SupplementaryPrompt(
      field: 'accountSuffix',
      hint: 'Last 4 digits of the receiving account',
    );

    await tester.pumpWidget(verdictTestApp(
      const NeedsSupplementaryCard(prompt: prompt, onConfigure: null),
    ));

    expect(find.text('Add your bank account details'), findsOneWidget);
    expect(find.text('Configure now'), findsNothing);
  });
}
