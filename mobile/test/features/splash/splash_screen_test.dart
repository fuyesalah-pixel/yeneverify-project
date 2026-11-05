import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/core/router/app_router.dart';
import 'package:yene_verify/core/theme/app_theme.dart';
import 'package:yene_verify/features/auth/domain/auth_notifier.dart';
import 'package:yene_verify/features/splash/presentation/screens/splash_screen.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

/// AuthNotifier whose build never resolves: simulates a startup check that
/// hangs, so tests can seed/emit state manually and exercise the splash's
/// own listener without the real secure-storage-backed build interfering.
class _HangingAuthNotifier extends AuthNotifier {
  @override
  Future<AuthState> build() => Completer<AuthState>().future;
}

void main() {
  group('SplashScreen', () {
    testWidgets('renders the app name on the splash', (tester) async {
      await _pumpWithAuth(tester, const AuthState(status: AuthStatus.unknown));

      expect(find.text('Yene Verify'), findsOneWidget);
    });

    testWidgets('navigates to /login when auth is unauthenticated',
        (tester) async {
      await _pumpWithAuth(
          tester, const AuthState(status: AuthStatus.unauthenticated));

      // Verify navigation by checking the navigator route
      final navigator = tester.widget<Navigator>(find.byType(Navigator));
      expect(navigator.pages.first.name, '/login');
    });

    testWidgets('navigates to /unlock when auth is locked', (tester) async {
      await _pumpWithAuth(tester, const AuthState(status: AuthStatus.locked));

      // Verify navigation by checking the navigator route
      final navigator = tester.widget<Navigator>(find.byType(Navigator));
      expect(navigator.pages.first.name, '/unlock');
    });
  });

  group('SplashScreen (reactive, isolated router)', () {
    testWidgets(
        'navigates to /login the moment auth transitions from unknown to unauthenticated',
        (tester) async {
      final container = await _pumpSplash(tester);

      // Still showing the splash: the build future never resolved.
      expect(find.text('Yene Verify'), findsOneWidget);

      // Startup resolves with an unauthenticated session.
      container.read(authProvider.notifier).state = const AsyncValue.data(
        AuthState(status: AuthStatus.unauthenticated),
      );
      await tester.pumpAndSettle();

      expect(find.text('LOGIN_SCREEN'), findsOneWidget);
    });

    testWidgets(
        'navigates to /unlock the moment auth transitions from unknown to locked',
        (tester) async {
      final container = await _pumpSplash(tester);

      expect(find.text('Yene Verify'), findsOneWidget);

      container.read(authProvider.notifier).state = const AsyncValue.data(
        AuthState(status: AuthStatus.locked),
      );
      await tester.pumpAndSettle();

      expect(find.text('UNLOCK_SCREEN'), findsOneWidget);
    });

    testWidgets('forces /login when auth stays unknown for 8 seconds',
        (tester) async {
      // No state ever emitted: the startup check hangs forever.
      await _pumpSplash(tester);

      await tester.pumpAndSettle();
      expect(find.text('Yene Verify'), findsOneWidget);

      // Past the 8s safety net the splash must not stay stuck.
      await tester.pump(const Duration(seconds: 9));
      await tester.pumpAndSettle();

      expect(find.text('LOGIN_SCREEN'), findsOneWidget);
    });
  });
}

/// Pumps a [MaterialApp] wrapped with [ProviderScope] and the app router,
/// seeded with a fixed auth state.
Future<void> _pumpWithAuth(
    WidgetTester tester, AuthState authState, {Key? key}) async {
  // Pump the first frame with the (unknown) loading state so the splash's
  // mount-time fireImmediately listener sees `unknown` and does not
  // navigate mid-build. Only then seed the fixed state, which drives the
  // listener from a safe (post-build) callback.
  final container = ProviderContainer(overrides: [
    authProvider.overrideWith(_HangingAuthNotifier.new),
  ]);
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: AppTheme.lightTheme(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: appRouter,
        key: key,
      ),
    ),
  );
  await tester.pump();

  container.read(authProvider.notifier).state = AsyncValue.data(authState);
  // Notify the global auth redirect relay so GoRouter re-evaluates routes.
  authRedirectRelay.refresh();

  // One extra frame so the splash listener + router redirect settle.
  await tester.pump();
}

/// Pumps the splash with a hanging [authProvider] and an isolated GoRouter
/// (splash + placeholder login/unlock routes) so tests don't depend on the
/// single global router's navigation state.
Future<ProviderContainer> _pumpSplash(WidgetTester tester) async {
  final container = ProviderContainer(overrides: [
    authProvider.overrideWith(_HangingAuthNotifier.new),
  ]);
  addTearDown(container.dispose);

  final router = GoRouter(
    initialLocation: Routes.splash,
    routes: [
      GoRoute(
        path: Routes.splash,
        builder: (_, __) => const SplashScreen(),
      ),
      GoRoute(
        path: Routes.login,
        builder: (_, __) => const Scaffold(body: Text('LOGIN_SCREEN')),
      ),
      GoRoute(
        path: Routes.unlock,
        builder: (_, __) => const Scaffold(body: Text('UNLOCK_SCREEN')),
      ),
    ],
  );

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        theme: AppTheme.lightTheme(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();

  return container;
}
