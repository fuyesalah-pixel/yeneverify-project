// Top card on /billing: the plan the merchant is on today.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../dashboard/data/models/subscription_me.dart';

class CurrentSubscriptionCard extends StatelessWidget {
  const CurrentSubscriptionCard({
    super.key,
    required this.subscription,
    required this.onManage,
    required this.actionLabel,
    this.isBusy = false,
  });

  final SubscriptionMe subscription;
  final VoidCallback onManage;
  final String actionLabel;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final days = subscription.daysRemaining;

    return AppCard(
      borderColor: colors.primaryAction,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  subscription.packageName.isEmpty
                      ? subscription.packageCode
                      : subscription.packageName,
                  style: AppTypography.headingSmall.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
              Container(
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
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            days == null
                ? l10n.billingUnlimited
                : l10n.billingExpiresIn(days),
            style: AppTypography.bodyMedium.copyWith(
              color: days != null && days <= 7 ? colors.warning : colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            subscription.unlimited
                ? l10n.billingUnlimited
                : l10n.billingCreditsLeft(subscription.creditsValue),
            style:
                AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.md),
          AppButton(
            label: actionLabel,
            variant: AppButtonVariant.secondary,
            size: AppButtonSize.md,
            isLoading: isBusy,
            onPressed: isBusy ? null : onManage,
          ),
        ],
      ),
    );
  }
}
