// Upload progress: determinate ring + percentage while the PUT streams.
//
// Shown only when the transport reports a total; a 0 progress value renders
// an indeterminate spinner instead of a stuck "0%".
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';

class UploadProgress extends StatelessWidget {
  const UploadProgress({super.key, required this.progress});

  final double progress;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final l10n = AppLocalizations.of(context);
    final clamped = progress.clamp(0.0, 1.0);
    final percent = (clamped * 100).round();

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 96,
          height: 96,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 96,
                height: 96,
                child: CircularProgressIndicator(
                  value: clamped == 0 ? null : clamped,
                  strokeWidth: 4,
                  backgroundColor: colors.surfaceAlt,
                  valueColor: AlwaysStoppedAnimation(colors.primaryAction),
                ),
              ),
              Text(
                clamped == 0 ? '—' : '$percent%',
                style: AppTypography.headingSmall.copyWith(
                  color: colors.textPrimary,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xxl),
        Text(
          l10n.uploadingPercent(percent),
          style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
