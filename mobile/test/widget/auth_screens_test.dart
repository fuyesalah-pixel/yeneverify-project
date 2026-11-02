// Widget tests for the auth screens (Step 21). Render + local flow state;
// network calls are stubbed through the authProvider override where needed.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:yene_verify/core/network/api_error.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';
import 'package:yene_verify/features/auth/presentation/screens/login_screen.dart';
import 'package:yene_verify/features/auth/presentation/screens/otp_screen.dart';
import 'package:yene_verify/features/auth/presentation/screens/pin_entry_screen.dart';
import 'package:yene_verify/features/auth/presentation/screens/pin_setup_screen.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

/// Stubbed auth state machine: every unlock attempt fails with a wrong PIN.
class _WrongPinAuthNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() async =>
      const AuthState(status: AuthStatus.locked);

  @override
  Future<ApiError?> unlockWithPin(String pin) async =>
      const ApiError(code: 'AUTH_PIN_INVALID');
}

Widget _wrap(Widget child, {List<Override> overrides = const []}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      theme: AppTheme.lightTheme(),
      home: child,
    ),
  );
}

void main() {
  testWidgets('LoginScreen renders title, subtitle, and phone field', (tester) async {
    await tester.pumpWidget(_wrap(const LoginScreen()));
    await tester.pump();

    expect(find.text('Yene Verify'), findsAtLeastNWidgets(1));
    expect(find.text('Enter your phone number to get started'), findsOneWidget);
    expect(find.text('Phone number'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
  });

  testWidgets('LoginScreen disables Continue with an invalid phone', (tester) async {
    await tester.pumpWidget(_wrap(const LoginScreen()));
    await tester.pump();

    ElevatedButton continueButton() => tester.widget<ElevatedButton>(
          find.widgetWithText(ElevatedButton, 'Continue'),
        );

    // Valid number keeps the button enabled.
    await tester.enterText(find.byType(TextField), '0911555001');
    await tester.pump();
    expect(continueButton().onPressed, isNotNull);

    // Invalid landline number disables it.
    await tester.enterText(find.byType(TextField), '0211555001');
    await tester.pump();
    expect(continueButton().onPressed, isNull);
  });

  testWidgets('OtpScreen counts down and then offers resend', (tester) async {
    await tester.pumpWidget(_wrap(const OtpScreen(phone: '+251911555001')));
    await tester.pump();

    expect(find.text('Enter verification code'), findsOneWidget);
    expect(find.textContaining('Resend in 45s'), findsOneWidget);

    await tester.pump(const Duration(seconds: 2));
    expect(find.textContaining('Resend in 43s'), findsOneWidget);

    // Countdown reaches zero → the resend button replaces the timer label.
    await tester.pump(const Duration(seconds: 43));
    expect(find.text('Resend code'), findsOneWidget);
    expect(find.textContaining('Resend in'), findsNothing);

    // Dispose the tree so the countdown timer is cancelled before teardown.
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('PinSetupScreen rejects a mismatched confirmation', (tester) async {
    await tester.pumpWidget(_wrap(const PinSetupScreen()));
    await tester.pump();

    expect(find.text('Create your PIN'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '1234');
    await tester.pump();
    expect(find.text('Confirm your PIN'), findsOneWidget);

    await tester.enterText(find.byType(TextField), '5678');
    await tester.pump();

    expect(find.text("PINs don't match. Try again."), findsOneWidget);
    // Back to the first step so the user can start over.
    expect(find.text('Create your PIN'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('PinEntryScreen shows the lockout message after 5 wrong PINs',
      (tester) async {
    await tester.pumpWidget(
      _wrap(
        const PinEntryScreen(),
        overrides: [authProvider.overrideWith(_WrongPinAuthNotifier.new)],
      ),
    );
    await tester.pump();

    expect(find.text('Welcome back'), findsOneWidget);

    const wrongPins = ['1111', '2222', '3333', '4444', '5555'];
    for (final pin in wrongPins) {
      await tester.enterText(find.byType(TextField), pin);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
    }

    expect(find.text('Too many attempts. Try again in 15 minutes.'),
        findsOneWidget);
    // The dot field is replaced once locked out.
    expect(find.text('Forgot PIN?'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });
}
