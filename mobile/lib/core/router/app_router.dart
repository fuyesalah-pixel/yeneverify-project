import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/screens/login_placeholder_screen.dart';
import '../../features/design_system/presentation/screens/design_system_showcase_screen.dart';
import '../../features/splash/presentation/screens/splash_screen.dart';

/// App navigation routes.
///
/// Step 20 wires three placeholder-level destinations:
/// - `/` — splash (auto-advances to `/login`)
/// - `/login` — login placeholder (Step 21 replaces the internals)
/// - `/design-system` — the Step 2 widget gallery demo
abstract final class Routes {
  static const String splash = '/';
  static const String login = '/login';
  static const String designSystem = '/design-system';
}

final appRouter = GoRouter(
  initialLocation: Routes.splash,
  refreshListenable: _NoopListenable(),
  routes: [
    GoRoute(
      path: Routes.splash,
      builder: (_, __) => const SplashScreen(),
    ),
    GoRoute(
      path: Routes.login,
      builder: (_, __) => const LoginPlaceholderScreen(),
    ),
    GoRoute(
      path: Routes.designSystem,
      builder: (_, __) => const DesignSystemShowcaseScreen(),
    ),
  ],
);

/// Placeholder listenable so later steps (e.g. auth-state redirects) can
/// swap it in without changing the router construction.
class _NoopListenable extends ChangeNotifier {}
