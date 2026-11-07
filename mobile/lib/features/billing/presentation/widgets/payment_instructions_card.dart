// CBE + Telebirr destination cards. Copy is delegated to the screen so this
// widget stays free of platform services (widget tests can tap it).
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/models/billing_session.dart';

class PaymentInstructionsCard extends StatelessWidget {
  const PaymentInstructionsCard({
    super.key,
    required this.instructions,
    required this.onCopy,
  });

  final PaymentInstructions instructions;
  final ValueChanged<String> onCopy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: _MethodCard(
                title: l10n.billingMethodCbe,
                primaryLabel: l10n.billingAccountNumber,
                primaryValue: instructions.cbeAccountNumber,
                secondaryLabel: l10n.billingAccountName,
                secondaryValue: instructions.cbeAccountName,
                icon: Icons.account_balance_outlined,
                onCopy: onCopy,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _MethodCard(
                title: l10n.billingMethodTelebirr,
                primaryLabel: l10n.billingPhoneNumber,
                primaryValue: instructions.telebirrPhoneNumber,
                secondaryLabel: l10n.billingAccountName,
                secondaryValue: instructions.telebirrAccountName,
                icon: Icons.phone_android_outlined,
                onCopy: onCopy,
              ),
            ),
          ],
        ),
        if (instructions.note.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.info_outline_rounded,
                  size: 16, color: colors.textSecondary),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  instructions.note,
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

class _MethodCard extends StatelessWidget {
  const _MethodCard({
    required this.title,
    required this.primaryLabel,
    required this.primaryValue,
    required this.secondaryLabel,
    required this.secondaryValue,
    required this.icon,
    required this.onCopy,
  });

  final String title;
  final String primaryLabel;
  final String primaryValue;
  final String secondaryLabel;
  final String secondaryValue;
  final IconData icon;
  final ValueChanged<String> onCopy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Container(
      padding: AppSpacing.insetMd,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadii.radiusLg,
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: colors.primaryAction),
              const SizedBox(width: AppSpacing.xs),
              Text(
                title,
                style: AppTypography.labelLarge.copyWith(
                  color: colors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            primaryLabel,
            style: AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.micro),
          Row(
            children: [
              Expanded(
                child: Text(
                  primaryValue,
                  style: AppTypography.bodyLarge.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton(
                tooltip: l10n.billingCopy,
                visualDensity: VisualDensity.compact,
                icon: Icon(Icons.copy_rounded,
                    size: 16, color: colors.primaryAction),
                onPressed: primaryValue.isEmpty
                    ? null
                    : () => onCopy(primaryValue),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            secondaryLabel,
            style: AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.micro),
          Text(
            secondaryValue,
            style: AppTypography.bodySmall.copyWith(color: colors.textPrimary),
          ),
        ],
      ),
    );
  }
}
