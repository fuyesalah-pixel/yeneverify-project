// NEEDS_REVIEW only, and only when the resolver asked for something extra.
//
// The supplementary data flow (POST /verifications/:id/supplementary) does
// not exist yet, so this card explains what is missing and leaves the one
// action that works today to VerdictActions: re-shoot the receipt. Backlog
// item 36 covers the real collection flow.
//
// The card deliberately does not repeat the hero subtitle — the hero already
// says a clearer photo is needed; this is "how", not "what".
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../data/models/verification_result.dart';

class NeedsSupplementaryCard extends StatelessWidget {
  const NeedsSupplementaryCard({super.key, required this.prompt});

  final SupplementaryPrompt? prompt;

  @override
  Widget build(BuildContext context) {
    if (prompt == null) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final hint = prompt!.hint.trim();

    return AppCard.tinted(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.photo_camera_outlined, size: 20, color: colors.info),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.verdictReviewFixTitle,
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
    );
  }
}
