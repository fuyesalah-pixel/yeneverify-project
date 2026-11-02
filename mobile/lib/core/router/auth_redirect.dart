// Pure redirect guard, split out so tests can exercise it without a router.
import '../../features/auth/domain/auth_notifier.dart';

/// Auth/onboarding-state based redirect for go_router. Returns the target
/// location, or null when no redirect is needed.
///
/// Auth decides *whether* the session is usable; onboarding is a separate
/// concern layered on top of `unlocked` — there is deliberately no
/// `AuthStatus.needsOnboarding`.
String? authRedirect(AuthState auth, String location) {
  switch (auth.status) {
    case AuthStatus.unknown:
      // Still resolving: only the splash may be visible.
      return location == '/' ? null : '/';
    case AuthStatus.unauthenticated:
      return const {'/', '/login', '/otp', '/design-system'}.contains(location)
          ? null
          : '/login';
    case AuthStatus.pinSetup:
      // PIN setup itself, plus the optional biometric-enrollment step, while
      // the session is still completing first-login.
      return const {'/', '/pin-setup', '/biometric-enroll', '/design-system'}
              .contains(location)
          ? null
          : '/pin-setup';
    case AuthStatus.locked:
      return const {'/', '/unlock', '/login', '/design-system'}
              .contains(location)
          ? null
          : '/unlock';
    case AuthStatus.unlocked:
      if (auth.needsOnboarding) {
        // Onboarding owns the session until the merchant profile (or invite
        // acceptance) exists. Dev tooling stays reachable.
        return const {'/onboarding', '/design-system'}.contains(location)
            ? null
            : '/onboarding';
      }
      if (const {'/dashboard', '/verify', '/design-system'}.contains(location)) {
        return null;
      }
      // Auth-flow screens, the transient splash, and the onboarding screen
      // (now complete) all belong behind an unlocked session.
      if (const {
        '/',
        '/login',
        '/otp',
        '/pin-setup',
        '/unlock',
        '/biometric-enroll',
        '/onboarding',
      }.contains(location)) {
        return '/dashboard';
      }
      // Other authenticated routes (Step 23+: receipts, analytics, …).
      return null;
  }
}
