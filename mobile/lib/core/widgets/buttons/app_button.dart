import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # AppButton
///
/// The primary interactive control in Yene Verify.
///
/// ## Variants
/// - [AppButtonVariant.primary] — filled, uses [AppColors.primaryAction].
///   Use for the single most important action on a screen.
/// - [AppButtonVariant.secondary] — outlined, transparent fill.
///   Use for secondary actions alongside a primary.
/// - [AppButtonVariant.ghost] — no border, no fill.
///   Use for tertiary actions, inline links.
/// - [AppButtonVariant.danger] — filled red, uses [AppColors.error].
///   Use for destructive, irreversible actions only.
///
/// ## Sizes
/// - [AppButtonSize.lg] (default) — full-width, 52px height.
/// - [AppButtonSize.md] — 44px height.
/// - [AppButtonSize.sm] — 36px height, compact label.
///
/// ## States
/// Loading shows a [CircularProgressIndicator] and disables tap.
/// Disabled dims the button and blocks interaction.
///
/// ## Do NOT
/// - Use more than ONE primary button per screen.
/// - Change colors directly — use [variant].
///
/// ## Example
/// ```dart
/// AppButton(
///   label: context.l10n.verify,
///   onPressed: () => ref.read(verifyProvider.notifier).verify(),
///   isLoading: state.isLoading,
/// )
/// ```
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = AppButtonVariant.primary,
    this.size = AppButtonSize.lg,
    this.isLoading = false,
    this.icon,
    this.expand = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final AppButtonVariant variant;
  final AppButtonSize size;
  final bool isLoading;

  /// Optional leading icon. Uses Lucide icon data.
  final IconData? icon;

  /// If true (default), button fills available width.
  final bool expand;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDisabled = onPressed == null || isLoading;

    final height = switch (size) {
      AppButtonSize.lg => 52.0,
      AppButtonSize.md => 44.0,
      AppButtonSize.sm => 36.0,
    };

    final textStyle = switch (size) {
      AppButtonSize.sm => AppTypography.labelMedium,
      _ => AppTypography.labelLarge,
    };

    final horizontalPad = switch (size) {
      AppButtonSize.sm => AppSpacing.md,
      AppButtonSize.md => AppSpacing.lg,
      AppButtonSize.lg => AppSpacing.xl,
    };

    Widget content = isLoading
        ? SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: _loaderColor(colors),
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18),
                const SizedBox(width: AppSpacing.sm),
              ],
              Text(label, style: textStyle),
            ],
          );

    final shape = RoundedRectangleBorder(borderRadius: AppRadii.radiusMd);

    Widget button = switch (variant) {
      AppButtonVariant.primary || AppButtonVariant.danger => ElevatedButton(
          onPressed: isDisabled ? null : onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: isDisabled
                ? colors.primaryActionDisabled
                : variant == AppButtonVariant.danger
                    ? colors.error
                    : colors.primaryAction,
            foregroundColor: variant == AppButtonVariant.primary
                ? _primaryForeground(context)
                : colors.onPrimary,
            disabledBackgroundColor: colors.primaryActionDisabled,
            disabledForegroundColor: colors.textDisabled,
            minimumSize: Size(expand ? double.infinity : 0, height),
            padding: EdgeInsets.symmetric(horizontal: horizontalPad),
            shape: shape,
            elevation: 0,
          ),
          child: content,
        ),
      AppButtonVariant.secondary => OutlinedButton(
          onPressed: isDisabled ? null : onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: colors.primaryAction,
            disabledForegroundColor: colors.textDisabled,
            side: BorderSide(
              color: isDisabled ? colors.border : colors.primaryAction,
            ),
            minimumSize: Size(expand ? double.infinity : 0, height),
            padding: EdgeInsets.symmetric(horizontal: horizontalPad),
            shape: shape,
          ),
          child: content,
        ),
      AppButtonVariant.ghost => TextButton(
          onPressed: isDisabled ? null : onPressed,
          style: TextButton.styleFrom(
            foregroundColor: colors.primaryAction,
            disabledForegroundColor: colors.textDisabled,
            minimumSize: Size(expand ? double.infinity : 0, height),
            padding: EdgeInsets.symmetric(horizontal: horizontalPad),
            shape: shape,
          ),
          child: content,
        ),
    };

    return button;
  }

  Color _primaryForeground(BuildContext context) {
    // Use the onPrimary token — white in light mode, near-black in dark mode.
    return context.colors.onPrimary;
  }

  Color _loaderColor(AppColors colors) {
    return switch (variant) {
      AppButtonVariant.primary => colors.onPrimary,
      AppButtonVariant.danger => colors.onPrimary,
      AppButtonVariant.secondary || AppButtonVariant.ghost => colors.primaryAction,
    };
  }
}

/// Visual style variants for [AppButton].
enum AppButtonVariant { primary, secondary, ghost, danger }

/// Size presets for [AppButton].
enum AppButtonSize { lg, md, sm }
