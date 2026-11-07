// Compact status pill for billing rows and the result screen.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/models/billing_verification.dart';

class BillingStatusBadge extends StatelessWidget {
  const BillingStatusBadge({super.key, required this.status});

  final BillingStatus status;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final color = statusColor(colors, status);
    final label = switch (status) {
      BillingStatus.pending => l10n.billingStatusPending,
      BillingStatus.approved => l10n.billingStatusApproved,
      BillingStatus.mismatch => l10n.billingStatusMismatch,
      BillingStatus.needsReview => l10n.billingStatusReview,
      BillingStatus.duplicate => l10n.billingStatusDuplicate,
      BillingStatus.fake => l10n.billingStatusFake,
      BillingStatus.rejected => l10n.billingStatusRejected,
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.micro,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.sm),
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(color: color),
      ),
    );
  }
}

Color statusColor(AppColors colors, BillingStatus status) {
  return switch (status) {
    BillingStatus.approved => colors.success,
    BillingStatus.pending => colors.textSecondary,
    BillingStatus.mismatch || BillingStatus.needsReview => colors.warning,
    BillingStatus.duplicate || BillingStatus.fake || BillingStatus.rejected =>
      colors.error,
  };
}
