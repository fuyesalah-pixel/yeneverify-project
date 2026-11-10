// "Verifying…" state shared by the submitting and polling phases.
//
// A branded pulse loader and progress line keep the wait calm without adding
// fake content. After 10 s the caption switches to "Still verifying…" to keep
// the user from assuming the app froze.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/brand/brand_loading.dart';

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
        Center(
          child: BrandLoadingMark(
            semanticLabel: l10n.verificationPending,
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const Center(
          child: SizedBox(
            width: 208,
            child: BrandProgressLine(),
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
