// One team member row: initials avatar, name, branch label, status.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../data/models/sub_merchant_summary.dart';

class SubMerchantRow extends StatelessWidget {
  const SubMerchantRow({super.key, required this.item, required this.onTap});

  final SubMerchantSummary item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            _InitialsAvatar(initials: item.initials, isInvite: item.isInvite),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.name.isEmpty ? item.phone : item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodyMedium.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (item.branchLabel != null && item.branchLabel!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.micro),
                    Text(
                      item.branchLabel!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            _StatusBadge(status: item.status, l10n: l10n),
            const SizedBox(width: AppSpacing.xs),
            Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: colors.textDisabled,
            ),
          ],
        ),
      ),
    );
  }
}

class _InitialsAvatar extends StatelessWidget {
  const _InitialsAvatar({required this.initials, required this.isInvite});

  final String initials;
  final bool isInvite;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: isInvite ? colors.surfaceAlt : colors.primaryAction.withValues(alpha: 0.12),
        // A circle cannot also carry a borderRadius (Flutter asserts).
        shape: BoxShape.circle,
        border: isInvite ? Border.all(color: colors.border) : null,
      ),
      alignment: Alignment.center,
      child: Text(
        initials,
        style: AppTypography.labelMedium.copyWith(
          color: isInvite ? colors.textSecondary : colors.primaryAction,
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.l10n});

  final SubMerchantStatus status;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final (label, color) = switch (status) {
      SubMerchantStatus.active => (l10n.teamStatusActive, colors.success),
      SubMerchantStatus.invited => (l10n.teamStatusInvited, colors.warning),
      SubMerchantStatus.suspended => (l10n.teamStatusSuspended, colors.warning),
      SubMerchantStatus.removed => (l10n.teamStatusRemoved, colors.textDisabled),
      SubMerchantStatus.unknown => (l10n.teamUnknown, colors.textSecondary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.micro,
      ),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: AppRadii.radiusSm,
      ),
      child: Text(
        label,
        style: AppTypography.labelSmall.copyWith(color: color),
      ),
    );
  }
}
