// Status filters: All + one chip per verdict, multi-select.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../verify/data/models/verification_result.dart';

class FilterChipsRow extends StatelessWidget {
  const FilterChipsRow({
    super.key,
    required this.selected,
    required this.onToggle,
    required this.onClear,
  });

  final Set<VerificationStatus> selected;
  final ValueChanged<VerificationStatus> onToggle;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    final options = <(VerificationStatus?, String)>[
      (null, l10n.transactionsStatusAll),
      (VerificationStatus.verified, l10n.transactionsStatusVerified),
      (VerificationStatus.fake, l10n.transactionsStatusFake),
      (VerificationStatus.duplicate, l10n.transactionsStatusDuplicate),
      (VerificationStatus.needsReview, l10n.transactionsStatusReview),
      (VerificationStatus.error, l10n.transactionsStatusError),
    ];

    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
        itemCount: options.length,
        separatorBuilder: (_, __) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (context, index) {
          final (status, label) = options[index];
          final isSelected =
              status == null ? selected.isEmpty : selected.contains(status);
          return _Chip(
            label: label,
            selected: isSelected,
            onTap: () => status == null ? onClear() : onToggle(status),
          );
        },
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.radiusPill,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: selected
                ? colors.primaryAction.withValues(alpha: 0.12)
                : colors.surface,
            borderRadius: AppRadii.radiusPill,
            border: Border.all(
              color: selected ? colors.primaryAction : colors.border,
            ),
          ),
          child: Text(
            label,
            style: AppTypography.labelMedium.copyWith(
              color: selected ? colors.primaryAction : colors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
