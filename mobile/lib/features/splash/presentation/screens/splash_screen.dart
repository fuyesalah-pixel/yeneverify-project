import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../auth/domain/auth_notifier.dart';

/// # SplashScreen
///
/// 1.5-second brand moment + auth-state bootstrap. Per DESIGN_PRINCIPLES: no
/// spinner, no loading indicator — the app shell is conceptually already
/// ready; the timer is only pacing.
///
/// Step 21: while the auth state is resolving (AuthStatus.unknown), the router
/// guard keeps the user here. Once it resolves, the guard navigates to
/// /login, /pin-setup, /unlock or /dashboard automatically.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  static const _splashDuration = Duration(milliseconds: 1500);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(_splashDuration, () {
      if (!mounted) return;
      // The router guard decides the destination from the auth state; if it
      // is still resolving, stay here until it resolves.
      final auth = ref.read(authProvider).valueOrNull;
      final status = auth?.status ?? AuthStatus.unknown;
      if (status == AuthStatus.unknown) return;
      _navigateFor(status);
    });
  }

  void _navigateFor(AuthStatus status) {
    switch (status) {
      case AuthStatus.unauthenticated:
        context.go(Routes.login);
      case AuthStatus.pinSetup:
        context.go(Routes.pinSetup);
      case AuthStatus.locked:
        context.go(Routes.unlock);
      case AuthStatus.unlocked:
        context.go(Routes.dashboard);
      case AuthStatus.unknown:
        break;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.background,
      body: Center(
        child: Text(
          l10n.appName,
          style: AppTypography.displayLarge.copyWith(
            color: colors.primaryAction,
            fontSize: 40,
            letterSpacing: -1.2,
          ),
        ),
      ),
    );
  }
}
