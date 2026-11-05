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
/// The splash is now reactive: as soon as [authProvider] leaves AuthStatus.unknown
/// it navigates to /login, /pin-setup, /unlock or /dashboard. A one-shot 1.5s
/// timer still paces the first render, and an 8-second safety-net timer forces
/// /login if startup is stuck.
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key, this.testKey});

  final Key? testKey;

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  static const _brandDuration = Duration(milliseconds: 1500);
  static const _safetyNetDuration = Duration(seconds: 8);

  Timer? _brandTimer;
  Timer? _safetyNetTimer;

  @override
  void initState() {
    super.initState();

    _safetyNetTimer = Timer(_safetyNetDuration, () {
      if (!mounted) return;
      final status =
          ref.read(authProvider).valueOrNull?.status ?? AuthStatus.unknown;
      if (status == AuthStatus.unknown) {
        _navigateFor(AuthStatus.unauthenticated);
      }
    });

    // Reactive listener: navigate the moment auth leaves unknown.
    ref.listenManual(
      authProvider,
      (previous, next) {
        final status = next.valueOrNull?.status ?? AuthStatus.unknown;
        if (status == AuthStatus.unknown) return;
        _navigateFor(status);
      },
      fireImmediately: true,
    );

    _brandTimer = Timer(_brandDuration, () {
      // Keep the brand visible if auth is still resolving; the reactive
      // listener fires when it resolves.
    });
  }

  void _navigateFor(AuthStatus status) {
    if (!mounted) return;

    final target = switch (status) {
      AuthStatus.unauthenticated => Routes.login,
      AuthStatus.pinSetup => Routes.pinSetup,
      AuthStatus.locked => Routes.unlock,
      AuthStatus.unlocked => Routes.dashboard,
      AuthStatus.unknown => null,
    };

    if (target != null) {
      context.go(target);
    }
  }

  @override
  void dispose() {
    _brandTimer?.cancel();
    _safetyNetTimer?.cancel();
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
