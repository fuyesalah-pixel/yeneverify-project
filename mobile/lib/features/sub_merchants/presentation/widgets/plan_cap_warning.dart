// Banner shown when the plan's team-seat cap is reached.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../domain/plan_limits.dart';

class PlanCapWarning extends StatelessWidget {
  const PlanCapWarning({super.key, required this.cap, required this.onUpgrade});

  final PlanCap cap;
  final VoidCallback onUpgrade;

  @override
  Widget build(BuildContext context) {
    if (!cap.atLimit) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final message = switch (cap.packageCode.toUpperCase()) {
      'FREE' => l10n.teamCapFree,
      'PREMIUM' => l10n.teamCapPremium,
      'BUSINESS' => l10n.teamCapBusiness,
      _ => l10n.teamCapGeneric,
    };

    return Container(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        0,
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.warning.withValues(alpha: 0.12),
        borderRadius: AppRadii.radiusMd,
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline_rounded, size: 20, color: colors.warning),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AppTypography.bodySmall.copyWith(color: colors.textPrimary),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          TextButton(
            onPressed: onUpgrade,
            style: TextButton.styleFrom(
              visualDensity: VisualDensity.compact,
              foregroundColor: colors.primaryAction,
            ),
            child: Text(l10n.teamUpgrade),
          ),
        ],
      ),
    );
  }
}
