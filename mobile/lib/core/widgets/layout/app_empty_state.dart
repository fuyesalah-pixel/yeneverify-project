import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../buttons/app_button.dart';

/// # AppEmptyState
///
/// Full-screen or inline empty state with illustration, title, body, and
/// a single optional CTA.
///
/// ## Design rules
/// - One primary action maximum.
/// - Always include a title. Body is optional but recommended.
/// - Use the Lottie animation path if available; fall back to [icon].
///
/// ## When to use
/// - Transaction list: no transactions yet.
/// - Sub-merchant list: no employees added.
/// - Analytics: not enough data.
/// - Search results: no matches.
///
/// ## Example
/// ```dart
/// AppEmptyState(
///   icon: LucideIcons.receiptText,
///   title: context.l10n.noTransactionsTitle,
///   body: context.l10n.noTransactionsBody,
///   actionLabel: context.l10n.verifyFirst,
///   onAction: () => context.push(Routes.verify),
/// )
/// ```
class AppEmptyState extends StatelessWidget {
  const AppEmptyState({
    super.key,
    this.icon,
    this.lottieAsset,
    required this.title,
    this.body,
    this.actionLabel,
    this.onAction,
    this.compact = false,
  });

  /// Lucide [IconData] fallback when no Lottie asset is available.
  final IconData? icon;

  /// Path to a Lottie JSON asset (e.g. `assets/lottie/empty.json`).
  final String? lottieAsset;

  final String title;
  final String? body;
  final String? actionLabel;
  final VoidCallback? onAction;

  /// When true, reduces vertical padding for inline use (e.g. inside a card).
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final vPad = compact ? AppSpacing.xxl : AppSpacing.giant;

    return Center(
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.xxxl,
          vertical: vPad,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Illustration
            if (lottieAsset != null)
              SizedBox(
                width: 160,
                height: 160,
                // Lottie.asset loaded by feature screen to avoid importing
                // lottie here — keeps the widget dep-free. Pass widget via
                // [icon] slot if you need an override.
                child: icon != null
                    ? Icon(icon, size: 80, color: colors.textDisabled)
                    : const SizedBox.shrink(),
              )
            else if (icon != null)
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: colors.surfaceAlt,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 40, color: colors.textSecondary),
              ),

            SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xxl),

            // Title
            Text(
              title,
              style: AppTypography.headingSmall.copyWith(
                color: colors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),

            // Body
            if (body != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                body!,
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
            ],

            // CTA
            if (actionLabel != null && onAction != null) ...[
              SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xxl),
              AppButton(
                label: actionLabel!,
                onPressed: onAction,
                size: AppButtonSize.md,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
