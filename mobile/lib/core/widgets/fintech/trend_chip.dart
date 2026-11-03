import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # TrendChip
///
/// Percentage change against the previous period, colour-coded by direction.
/// `percent == null` means the previous period had no data, which is not a
/// 0% change — the chip shows an em dash instead of inventing a number.
class TrendChip extends StatelessWidget {
  const TrendChip({super.key, required this.direction, this.percent});

  final TrendDirection direction;
  final double? percent;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = switch (direction) {
      TrendDirection.up => colors.success,
      TrendDirection.down => colors.error,
      TrendDirection.flat => colors.textSecondary,
    };
    final icon = switch (direction) {
      TrendDirection.up => Icons.trending_up_rounded,
      TrendDirection.down => Icons.trending_down_rounded,
      TrendDirection.flat => Icons.trending_flat_rounded,
    };
    final label = percent == null
        ? '—'
        : '${percent! >= 0 ? '+' : '−'}${percent!.abs().toStringAsFixed(0)}%';

    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.micro,
        ),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: AppRadii.radiusPill,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: AppSpacing.micro),
            Text(label, style: AppTypography.labelSmall.copyWith(color: color)),
          ],
        ),
      ),
    );
  }
}

enum TrendDirection { up, down, flat }
