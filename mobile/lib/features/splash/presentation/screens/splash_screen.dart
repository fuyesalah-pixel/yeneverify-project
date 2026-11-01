import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_typography.dart';

/// # SplashScreen
///
/// 1.5-second brand moment. Per DESIGN_PRINCIPLES: no spinner, no loading
/// indicator — the app shell is conceptually already ready; the timer is
/// only pacing.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  static const _splashDuration = Duration(milliseconds: 1500);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(_splashDuration, () {
      if (mounted) {
        context.go(Routes.login);
      }
    });
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
