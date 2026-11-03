// NEEDS_REVIEW only, and only when the resolver asked for something extra.
//
// The supplementary data flow (POST /verifications/:id/supplementary) does
// not exist yet, so this card explains what is missing and offers the one
// action that works today: re-shoot the receipt. Backlog item 36 covers the
// real collection flow.
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
    required this.onRetry,
  });

  final SupplementaryPrompt? prompt;
  final VoidCallback onRetry;

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
              Icon(Icons.photo_camera_outlined, size: 20, color: colors.info),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  l10n.verdictReviewSupplementarySubtitle,
                  style: AppTypography.bodyMedium.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          if (hint.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              hint,
              style: AppTypography.bodySmall.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          AppButton(
            label: l10n.verdictTryAgainButton,
            variant: AppButtonVariant.secondary,
            onPressed: onRetry,
          ),
        ],
      ),
    );
  }
}
