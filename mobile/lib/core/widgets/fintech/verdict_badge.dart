import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # VerdictBadge
///
/// Displays a verification verdict as a colored pill with icon and label.
///
/// ## Verdicts
/// | Status        | Color   | Icon              |
/// |---------------|---------|-------------------|
/// | VERIFIED      | success | check_circle      |
/// | FAKE          | error   | cancel            |
/// | DUPLICATE     | warning | content_copy      |
/// | PENDING       | accent  | hourglass_empty   |
/// | NEEDS_REVIEW  | info    | rate_review       |
/// | ERROR         | error   | error_outline     |
///
/// ## Sizes
/// - [VerdictBadgeSize.large] — result screen hero badge.
/// - [VerdictBadgeSize.small] — list rows, transaction tiles.
///
/// ## Accessibility
/// The badge includes a [Semantics] label so screen readers announce
/// the verdict state.
///
/// ## Example
/// ```dart
/// VerdictBadge(verdict: VerificationVerdict.verified)
/// VerdictBadge(verdict: VerificationVerdict.duplicate, size: VerdictBadgeSize.small)
/// ```
class VerdictBadge extends StatelessWidget {
  const VerdictBadge({
    super.key,
    required this.verdict,
    this.size = VerdictBadgeSize.small,
  });

  final VerificationVerdict verdict;
  final VerdictBadgeSize size;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final config = _config(verdict, colors);
    final isLarge = size == VerdictBadgeSize.large;

    final iconSize = isLarge ? 20.0 : 14.0;
    final textStyle = isLarge
        ? AppTypography.labelLarge
        : AppTypography.labelSmall;
    final hPad = isLarge ? AppSpacing.lg : AppSpacing.sm;
    final vPad = isLarge ? AppSpacing.sm : AppSpacing.xs;

    return Semantics(
      label: config.label,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
        decoration: BoxDecoration(
          color: config.color.withValues(alpha: 0.12),
          borderRadius: AppRadii.radiusPill,
          border: Border.all(color: config.color.withValues(alpha: 0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(config.icon, size: iconSize, color: config.color),
            const SizedBox(width: AppSpacing.xs),
            Text(
              config.label,
              style: textStyle.copyWith(color: config.color),
            ),
          ],
        ),
      ),
    );
  }

  _VerdictConfig _config(VerificationVerdict v, AppColors colors) {
    return switch (v) {
      VerificationVerdict.verified => _VerdictConfig(
          label: 'VERIFIED',
          color: colors.success,
          icon: Icons.check_circle_outline_rounded,
        ),
      VerificationVerdict.fake => _VerdictConfig(
          label: 'FAKE',
          color: colors.error,
          icon: Icons.cancel_outlined,
        ),
      VerificationVerdict.duplicate => _VerdictConfig(
          label: 'DUPLICATE',
          color: colors.warning,
          icon: Icons.content_copy_outlined,
        ),
      VerificationVerdict.pending => _VerdictConfig(
          label: 'PENDING',
          color: colors.brandAccent,
          icon: Icons.hourglass_empty_rounded,
        ),
      VerificationVerdict.needsReview => _VerdictConfig(
          label: 'REVIEW',
          color: colors.info,
          icon: Icons.rate_review_outlined,
        ),
      VerificationVerdict.error => _VerdictConfig(
          label: 'ERROR',
          color: colors.error,
          icon: Icons.error_outline_rounded,
        ),
    };
  }
}

class _VerdictConfig {
  const _VerdictConfig({
    required this.label,
    required this.color,
    required this.icon,
  });
  final String label;
  final Color color;
  final IconData icon;
}

/// All possible verification outcomes — mirrors the backend enum.
/// Keep in sync with `VerificationStatus` in the backend.
enum VerificationVerdict {
  verified,
  fake,
  duplicate,
  pending,
  needsReview,
  error,
}

/// Size presets for [VerdictBadge].
enum VerdictBadgeSize { large, small }
