import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # CreditMeter
///
/// Displays the merchant's remaining verification credits as a circular
/// progress ring with a numeric label.
///
/// ## States
/// - **Normal** — ring in [AppColors.brandAccent].
/// - **Low** (≤ 20 credits) — ring and count in [AppColors.warning].
///   Also shows a warning label below.
/// - **Empty** (0 credits) — ring and count in [AppColors.error].
///   Shows "Renew your package" CTA.
///
/// ## Rules
/// - For unlimited plans, pass [remaining] = -1. Shows ∞ instead of a count.
/// - Never pass a float — [remaining] and [total] are integers.
/// - [total] of 0 with unlimited plans should pass [isUnlimited] = true.
///
/// ## Example
/// ```dart
/// CreditMeter(remaining: 47, total: 400)
/// CreditMeter(remaining: 12, total: 400)    // shows warning
/// CreditMeter(remaining: 0, total: 400)     // shows error + CTA
/// CreditMeter(remaining: -1, isUnlimited: true) // unlimited
/// ```
class CreditMeter extends StatelessWidget {
  const CreditMeter({
    super.key,
    required this.remaining,
    this.total = 0,
    this.isUnlimited = false,
    this.size = CreditMeterSize.medium,
    this.onRenew,
  });

  /// Credits remaining. Pass -1 for unlimited.
  final int remaining;

  /// Total credits in the current plan (0 for unlimited plans).
  final int total;

  final bool isUnlimited;

  final CreditMeterSize size;

  /// Called when the user taps "Renew" on the empty state.
  final VoidCallback? onRenew;

  static const int _lowThreshold = 20;

  bool get _isEmpty => !isUnlimited && remaining <= 0;
  bool get _isLow => !isUnlimited && remaining > 0 && remaining <= _lowThreshold;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    final ringColor = _isEmpty
        ? colors.error
        : _isLow
            ? colors.warning
            : colors.brandAccent;

    final diameter = switch (size) {
      CreditMeterSize.large  => 120.0,
      CreditMeterSize.medium => 80.0,
      CreditMeterSize.small  => 56.0,
    };

    final strokeWidth = switch (size) {
      CreditMeterSize.large  => 8.0,
      CreditMeterSize.medium => 6.0,
      CreditMeterSize.small  => 4.0,
    };

    final countStyle = switch (size) {
      CreditMeterSize.large  => AppTypography.displayMedium,
      CreditMeterSize.medium => AppTypography.headingSmall,
      CreditMeterSize.small  => AppTypography.labelMedium,
    };

    final progress = isUnlimited || total <= 0
        ? 1.0
        : (remaining / total).clamp(0.0, 1.0);

    final countLabel = isUnlimited ? '∞' : '$remaining';

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: diameter,
          height: diameter,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // Background track
              CircularProgressIndicator(
                value: 1.0,
                strokeWidth: strokeWidth,
                valueColor: AlwaysStoppedAnimation(
                  ringColor.withValues(alpha: 0.15),
                ),
              ),
              // Progress ring
              TweenAnimationBuilder<double>(
                tween: Tween<double>(begin: 0.0, end: progress),
                duration: const Duration(milliseconds: 800),
                curve: Curves.easeOutCubic,
                builder: (_, value, __) => CircularProgressIndicator(
                  value: value,
                  strokeWidth: strokeWidth,
                  strokeCap: StrokeCap.round,
                  valueColor: AlwaysStoppedAnimation(ringColor),
                ),
              ),
              // Center count
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    countLabel,
                    style: countStyle.copyWith(color: ringColor),
                  ),
                  if (size != CreditMeterSize.small && !isUnlimited)
                    Text(
                      'left',
                      style: AppTypography.bodySmall.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),

        // Warning / empty label
        if (_isLow || _isEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _isEmpty ? 'No credits left' : '$remaining credits remaining',
            style: AppTypography.labelSmall.copyWith(color: ringColor),
            textAlign: TextAlign.center,
          ),
        ],

        // Renew CTA
        if (_isEmpty && onRenew != null) ...[
          const SizedBox(height: AppSpacing.xs),
          GestureDetector(
            onTap: onRenew,
            child: Text(
              'Renew package →',
              style: AppTypography.labelSmall.copyWith(
                color: colors.primaryAction,
                decoration: TextDecoration.underline,
                decorationColor: colors.primaryAction,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// Size presets for [CreditMeter].
enum CreditMeterSize { large, medium, small }
