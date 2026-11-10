import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:yene_verify/app.dart';
import 'package:yene_verify/core/widgets/brand/brand_logo.dart';

void main() {
  testWidgets('App boots to the splash wordmark', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(
      const ProviderScope(
        child: YeneVerifyApp(),
      ),
    );
    await tester.pump();

    // The splash screen shows the brand logo before the 1.5s timer fires.
    expect(find.byType(BrandLogo), findsOneWidget);

    // Advance past the splash's 8s safety net and the startup check's 5s
    // timeout clock (both fake-timer based) so no timer stays pending at
    // test end; the splash resolves to /login and unmounts.
    await tester.pump(const Duration(seconds: 10));
    await tester.pump(const Duration(seconds: 1));
  });
}
