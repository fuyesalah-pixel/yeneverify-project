// One plan card: price, feature bullets, and the action the merchant can
// take from their current plan (choose / upgrade / current).
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../data/models/package.dart';
import '../../domain/package_display.dart';

class PackageCard extends StatelessWidget {
  const PackageCard({
    super.key,
    required this.package,
    required this.action,
    required this.onAction,
    this.isBusy = false,
  });

  final Package package;
  final PackageAction action;
  final VoidCallback onAction;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final current = action == PackageAction.current;

    return AppCard(
      variant: current ? AppCardVariant.default_ : AppCardVariant.outlined,
      borderColor: current ? colors.primaryAction : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  package.name,
                  style: AppTypography.headingSmall.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
              Text(
                formatPackagePrice(package),
                style: AppTypography.bodyLarge.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          for (final feature in packageFeatures(package, l10n))
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Row(
                children: [
                  Icon(Icons.check_rounded,
                      size: 16,
                      color: current ? colors.primaryAction : colors.success),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      feature,
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          if (current)
            Align(
              alignment: Alignment.centerLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.micro,
                ),
                decoration: BoxDecoration(
                  color: colors.primaryAction.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(AppSpacing.sm),
                ),
                child: Text(
                  l10n.billingCurrentBadge,
                  style: AppTypography.labelSmall.copyWith(
                    color: colors.primaryAction,
                  ),
                ),
              ),
            )
          else
            AppButton(
              label: action == PackageAction.upgrade
                  ? l10n.billingUpgrade
                  : l10n.billingChoose,
              variant: action == PackageAction.upgrade
                  ? AppButtonVariant.secondary
                  : AppButtonVariant.primary,
              size: AppButtonSize.md,
              isLoading: isBusy,
              onPressed: isBusy ? null : onAction,
            ),
        ],
      ),
    );
  }
}
