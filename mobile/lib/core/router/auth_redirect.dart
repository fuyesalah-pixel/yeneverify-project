// Pure redirect guard, split out so tests can exercise it without a router.
import '../../features/auth/domain/auth_notifier.dart';

/// Auth-state based redirect for go_router. Returns the target location, or
/// null when no redirect is needed.
String? authRedirect(AuthState auth, String location) {
  switch (auth.status) {
    case AuthStatus.unknown:
      // Still resolving: only the splash may be visible.
      return location == '/' ? null : '/';
    case AuthStatus.unauthenticated:
      const publicRoutes = {'/login', '/otp', '/design-system'};
      return publicRoutes.contains(location) ? null : '/login';
    case AuthStatus.pinSetup:
      // PIN setup itself, plus the optional biometric-enrollment step, while
      // the session is still completing first-login onboarding.
      return location == '/pin-setup' || location == '/biometric-enroll'
          ? null
          : '/pin-setup';
    case AuthStatus.locked:
      return location == '/unlock' ? null : '/unlock';
    case AuthStatus.unlocked:
      const authScreens = {'/login', '/otp', '/unlock', '/pin-setup'};
      return authScreens.contains(location) ? '/dashboard' : null;
  }
}
