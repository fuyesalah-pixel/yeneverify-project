// "Verifying…" state shared by the submitting and polling phases.
//
// A shimmer skeleton (not a spinner) is used because the verdict will land
// in this exact area on the next screen, so the shape hints at what is
// coming. After 10 s the caption switches to "Still verifying…" to keep the
// user from assuming the app froze.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/layout/app_loading_skeleton.dart';

class VerifyingSkeleton extends StatelessWidget {
  const VerifyingSkeleton({super.key, this.elapsed = Duration.zero});

  /// Accumulated poll time. Only meaningful once polling has started.
  final Duration elapsed;

  /// Caption flip threshold — matches the spec's 10 s expectation change.
  static const Duration captionFlipAfter = Duration(seconds: 10);

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final caption = elapsed >= captionFlipAfter
        ? l10n.verifyStillWorking
        : l10n.verifyTakesSeconds;

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AppShimmer(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                height: 140,
                decoration: BoxDecoration(
                  color: colors.surfaceAlt,
                  borderRadius: BorderRadius.circular(AppSpacing.md),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              _SkeletonLine(width: 180, color: colors.surfaceAlt),
              const SizedBox(height: AppSpacing.sm),
              _SkeletonLine(width: 120, color: colors.surfaceAlt),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
        Text(
          l10n.verificationPending,
          style: AppTypography.headingSmall.copyWith(color: colors.textPrimary),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          caption,
          style: AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _SkeletonLine extends StatelessWidget {
  const _SkeletonLine({required this.width, required this.color});

  final double width;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: 14,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppSpacing.xs),
      ),
    );
  }
}
