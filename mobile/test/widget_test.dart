import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:yene_verify/app.dart';

void main() {
  testWidgets('App boots to the splash wordmark', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: YeneVerifyApp(),
      ),
    );
    await tester.pump();

    // The splash screen shows the app name before the 1.5s timer fires.
    expect(find.text('Yene Verify'), findsOneWidget);
  });
}
