import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/domain/auth_notifier.dart';
import '../../features/auth/presentation/screens/biometric_enroll_screen.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/otp_screen.dart';
import '../../features/auth/presentation/screens/pin_entry_screen.dart';
import '../../features/auth/presentation/screens/pin_setup_screen.dart';
import '../../features/billing/data/models/billing_session.dart';
import '../../features/billing/presentation/screens/billing_history_screen.dart';
import '../../features/billing/presentation/screens/billing_result_screen.dart';
import '../../features/billing/presentation/screens/billing_screen.dart';
import '../../features/billing/presentation/screens/checkout_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';
import '../../features/design_system/presentation/screens/design_system_showcase_screen.dart';
import '../../features/onboarding/presentation/screens/merchant_setup_success_screen.dart';
import '../../features/onboarding/presentation/screens/onboarding_flow_screen.dart';
import '../../features/profile/presentation/screens/profile_screen.dart';
import '../../features/profile/presentation/screens/verification_accounts_screen.dart';
import '../../features/shell/presentation/screens/shell_placeholder_screen.dart';
import '../../features/sub_merchants/presentation/screens/invite_sub_merchant_screen.dart';
import '../../features/sub_merchants/presentation/screens/sub_merchant_detail_screen.dart';
import '../../features/sub_merchants/presentation/screens/sub_merchants_screen.dart';
import '../../features/transactions/presentation/screens/transactions_screen.dart';
import '../../features/shell/shell_screen.dart';
import '../../features/splash/presentation/screens/splash_screen.dart';
import '../../features/verify/presentation/screens/camera_capture_screen.dart';
import '../../features/verify/presentation/screens/verdict_screen.dart';
import '../../features/verify/presentation/screens/verify_screen.dart';
import 'auth_redirect.dart';

/// App navigation routes (Step 21, extended in Step 23A).
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
  static const String history = '/history';
  static const String transactionDetail = '/transactions';

  /// Read-only verdict view opened from the history list.
  static String transactionFor(String verificationId) =>
      '$transactionDetail/$verificationId';
  static const String insights = '/insights';
  static const String profile = '/profile';

  /// Step 25 — billing flow (root routes, no bottom nav).
  static const String billing = '/billing';
  static const String billingHistory = '/billing/history';
  static String billingCheckoutFor(String sessionId) =>
      '$billing/checkout/$sessionId';
  static String billingResultFor(String billingId) =>
      '$billing/result/$billingId';

  /// Step 24 — team management, nested under the Profile tab.
  static const String subMerchants = '/profile/sub-merchants';
  static const String subMerchantInvite = '/profile/sub-merchants/invite';
  static String subMerchantFor(String id) => '$subMerchants/$id';

  /// Part 0 — bank accounts used by the verification adapters.
  static const String verificationAccounts = '/profile/verification-accounts';

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

/// Camera and verdict must cover the bottom navigation, so they are pushed
/// on the root navigator even though they are path-children of `/verify`.
final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');

final appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
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
    // Every signed-in tab lives inside the shell. Branch order is fixed and
    // mirrored by features/shell/shell_controller.dart.
    StatefulShellRoute.indexedStack(
      builder: (_, __, navigationShell) =>
          ShellScreen(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.dashboard,
              builder: (_, __) => const DashboardScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.verify,
              builder: (_, __) => const VerifyScreen(),
              routes: [
                GoRoute(
                  path: 'camera',
                  parentNavigatorKey: _rootNavigatorKey,
                  builder: (_, __) => const CameraCaptureScreen(),
                ),
                GoRoute(
                  path: 'result/:id',
                  parentNavigatorKey: _rootNavigatorKey,
                  pageBuilder: (_, state) => NoTransitionPage(
                    child: VerdictScreen(
                      verificationId: state.pathParameters['id'] ?? '',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.history,
              builder: (_, __) => const TransactionsScreen(),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.insights,
              builder: (_, __) =>
                  const ShellPlaceholderScreen(section: ShellSection.insights),
            ),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: Routes.profile,
              builder: (_, __) => const ProfileScreen(),
              routes: [
                GoRoute(
                  path: 'verification-accounts',
                  builder: (_, __) => const VerificationAccountsScreen(),
                ),
                GoRoute(
                  path: 'sub-merchants',
                  builder: (_, __) => const SubMerchantsScreen(),
                  routes: [
                    // Literal before ':id' so /invite never parses as an id.
                    GoRoute(
                      path: 'invite',
                      builder: (_, __) => const InviteSubMerchantScreen(),
                    ),
                    GoRoute(
                      path: ':id',
                      builder: (_, state) => SubMerchantDetailScreen(
                        subMerchantId: state.pathParameters['id'] ?? '',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ],
    ),
    // Billing lives outside the shell: checkout and result are full-screen
    // flows, and the package list is always opened from Profile or a banner.
    GoRoute(
      path: Routes.billing,
      builder: (_, __) => const BillingScreen(),
      routes: [
        GoRoute(
          path: 'history',
          builder: (_, __) => const BillingHistoryScreen(),
        ),
        GoRoute(
          path: 'checkout/:sessionId',
          builder: (_, state) => CheckoutScreen(
            session: state.extra is BillingSession
                ? state.extra as BillingSession
                : null,
          ),
        ),
        GoRoute(
          path: 'result/:billingId',
          builder: (_, state) => BillingResultScreen(
            billingId: state.pathParameters['billingId'] ?? '',
            readOnly: state.extra == true,
          ),
        ),
      ],
    ),
    // Opened from the history list; full screen on the root navigator so the
    // bottom nav does not sit under a read-only detail view.
    GoRoute(
      path: '${Routes.transactionDetail}/:id',
      parentNavigatorKey: _rootNavigatorKey,
      pageBuilder: (_, state) => NoTransitionPage(
        child: VerdictScreen(
          verificationId: state.pathParameters['id'] ?? '',
          mode: VerdictMode.detail,
        ),
      ),
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
