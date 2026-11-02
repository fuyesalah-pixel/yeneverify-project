// Merchant setup success — a short celebration before the dashboard.
// Step 22A.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

class MerchantSetupSuccessScreen extends StatefulWidget {
  const MerchantSetupSuccessScreen({super.key, required this.businessName});

  final String businessName;

  @override
  State<MerchantSetupSuccessScreen> createState() =>
      _MerchantSetupSuccessScreenState();
}

class _MerchantSetupSuccessScreenState
    extends State<MerchantSetupSuccessScreen> {
  static const _displayDuration = Duration(seconds: 2);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(_displayDuration, () {
      if (mounted) context.go(Routes.dashboard);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xxl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.check_circle, size: 72, color: colors.success),
              const SizedBox(height: AppSpacing.xxl),
              Text(
                l10n.onboardingSuccessTitle,
                style: AppTypography.displayMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.onboardingSuccessSubtitle(widget.businessName),
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
