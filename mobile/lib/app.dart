import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';
import 'features/auth/domain/auth_notifier.dart';

/// Root application widget.
/// Wires together the theme, router, and localization, plus an auth gate that
/// keeps the router's redirect listening to auth state changes.
class YeneVerifyApp extends ConsumerWidget {
  const YeneVerifyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return MaterialApp.router(
      title: 'Yene Verify',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme(),
      darkTheme: AppTheme.darkTheme(),
      themeMode: themeMode,
      routerConfig: appRouter,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: const [
        Locale('en'),
        Locale('am'),
      ],
      builder: (context, child) =>
          AuthGate(child: child ?? const SizedBox.shrink()),
    );
  }
}

/// Watches authProvider and notifies the router's redirect listenable whenever
/// auth state changes. The redirect itself reads the state via
/// ProviderScope.containerOf in app_router.
class AuthGate extends ConsumerWidget {
  const AuthGate({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.listen<AsyncValue<AuthState>>(authProvider, (prev, next) {
      if (next.hasValue) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          authRedirectRelay.refresh();
        });
      }
    });
    return child;
  }
}
