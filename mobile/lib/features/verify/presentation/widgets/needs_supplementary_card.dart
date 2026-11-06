// NEEDS_REVIEW only, and only when the resolver asked for something extra.
//
// Part 0: the missing input is a merchant-configured bank account (e.g.
// Abyssinia's last 5 digits), so the card links straight to the settings
// screen. The hint text still comes from the backend prompt.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../data/models/verification_result.dart';

class NeedsSupplementaryCard extends StatelessWidget {
  const NeedsSupplementaryCard({
    super.key,
    required this.prompt,
    this.onConfigure,
  });

  final SupplementaryPrompt? prompt;
  final VoidCallback? onConfigure;

  @override
  Widget build(BuildContext context) {
    if (prompt == null) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final hint = prompt!.hint.trim();

    return AppCard.tinted(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.account_balance_outlined,
                  size: 20, color: colors.info),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      l10n.verdictConfigureAccountTitle,
                      style: AppTypography.bodyMedium.copyWith(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.micro),
                    Text(
                      hint.isNotEmpty ? hint : l10n.verdictReviewRetakeHint,
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (onConfigure != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: l10n.verdictConfigureAccount,
              variant: AppButtonVariant.secondary,
              size: AppButtonSize.md,
              expand: false,
              onPressed: onConfigure,
            ),
          ],
        ],
      ),
    );
  }
}
