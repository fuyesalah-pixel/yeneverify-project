import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../layout/app_card.dart';
import 'trend_chip.dart';

/// # StatCard
///
/// One number with a label and an optional trend. The value is a widget so
/// the caller decides between [AmountText] and a plain count without this
/// card knowing about money.
class StatCard extends StatelessWidget {
  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.trend,
  });

  final String label;
  final Widget value;
  final TrendChip? trend;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AppCard(
      padding: AppSpacing.insetLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label and trend stack instead of sharing a row: at 360 dp the
          // two stat cards are ~160 dp wide and "Verifications" + a chip on
          // one line broke the word in half.
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.labelMedium.copyWith(
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: value,
          ),
          if (trend != null) ...[
            const SizedBox(height: AppSpacing.xs),
            trend!,
          ],
        ],
      ),
    );
  }
}
