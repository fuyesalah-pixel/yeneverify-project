import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/auth_notifier.dart';
import '../../features/auth/presentation/screens/biometric_enroll_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/auth/presentation/screens/pin_entry_screen.dart';
import '../../features/auth/presentation/screens/pin_setup_screen.dart';
import '../../features/design_system/presentation/screens/design_system_showcase_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_placeholder_screen.dart';
import '../../features/onboarding/presentation/screens/merchant_setup_success_screen.dart';
import '../../features/onboarding/presentation/screens/onboarding_flow_screen.dart';
import '../../features/verify/presentation/screens/camera_capture_screen.dart';
import '../../features/verify/presentation/screens/verdict_screen.dart';
import '../../features/verify/presentation/screens/verify_screen.dart';
import '../../features/splash/presentation/screens/splash_screen.dart';
import 'auth_redirect.dart';

/// App navigation routes (Step 21).
abstract final class Routes {
  static const String splash = '/';
  static const String login = '/login';
  static const String otp = '/otp';
  static const String pinSetup = '/pin-setup';
  static const String unlock = '/unlock';
  static const String biometricEnroll = '/biometric-enroll';
  static const String dashboard = '/dashboard';
  static const String onboarding = '/onboarding';
  static const String onboardingSuccess = '/onboarding/success';
  static const String verify = '/verify';
  static const String cameraCapture = '/verify/camera';
  static const String verdict = '/verify/result';

  /// Route to one verdict. The screen refetches by id, so nothing but the
  /// id travels through navigation.
  static String verdictFor(String verificationId) => '$verdict/$verificationId';
  static const String designSystem = '/design-system';
}

/// Bridges Riverpod auth state into GoRouter's refreshListenable. The gate
/// widget (see app.dart) notifies this whenever auth state changes.
final authRedirectRelay = AuthRedirectRelay();

/// Subclass so calling notifyListeners is not flagged as a protected access.
class AuthRedirectRelay extends ChangeNotifier {
  void refresh() => notifyListeners();
}

final appRouter = GoRouter(
  initialLocation: Routes.splash,
  refreshListenable: authRedirectRelay,
  routes: [
    GoRoute(
      path: Routes.splash,
      builder: (_, __) => const SplashScreen(),
    ),
    GoRoute(
      path: Routes.login,
      builder: (_, __) => const LoginScreen(),
    ),
    GoRoute(
      path: Routes.otp,
      builder: (_, state) => OtpScreen(phone: (state.extra as String?) ?? ''),
    ),
    GoRoute(
      path: Routes.pinSetup,
      builder: (_, __) => const PinSetupScreen(),
    ),
    GoRoute(
      path: Routes.unlock,
      builder: (_, __) => const PinEntryScreen(),
    ),
    GoRoute(
      path: Routes.biometricEnroll,
      builder: (_, __) => const BiometricEnrollScreen(),
    ),
    GoRoute(
      path: Routes.dashboard,
      builder: (_, __) => const DashboardPlaceholderScreen(),
    ),
    GoRoute(
      path: Routes.onboarding,
      builder: (_, __) => const OnboardingFlowScreen(),
    ),
    GoRoute(
      path: Routes.onboardingSuccess,
      builder: (_, state) => MerchantSetupSuccessScreen(
        businessName: (state.extra as String?) ?? '',
      ),
    ),
    GoRoute(
      path: Routes.verify,
      builder: (_, __) => const VerifyScreen(),
      routes: [
        // Pushed on top of /verify (full-screen camera, no tab chrome).
        GoRoute(
          path: 'camera',
          builder: (_, __) => const CameraCaptureScreen(),
        ),
        // Terminal verdict, full screen and instant: the verdict hero is the
        // first thing painted, with no route transition in the way.
        GoRoute(
          path: 'result/:id',
          pageBuilder: (_, state) => NoTransitionPage(
            child: VerdictScreen(
              verificationId: state.pathParameters['id'] ?? '',
            ),
          ),
        ),
      ],
    ),
    GoRoute(
      path: Routes.designSystem,
      builder: (_, __) => const DesignSystemShowcaseScreen(),
    ),
  ],
  redirect: (context, state) {
    final container = ProviderScope.containerOf(context, listen: false);
    final auth = container.read(authProvider).valueOrNull;
    if (auth == null) {
      // Auth state not resolved yet: only the splash remains.
      return state.matchedLocation == Routes.splash ? null : Routes.splash;
    }
    return authRedirect(auth, state.matchedLocation);
  },
);
