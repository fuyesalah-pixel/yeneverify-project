import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # AppSnackbar
///
/// Displays a brief, non-blocking message at the bottom of the screen.
///
/// ## Variants
/// - [AppSnackbarVariant.success] — green, for confirmations.
/// - [AppSnackbarVariant.error]   — red, for failures.
/// - [AppSnackbarVariant.warning] — amber, for caution.
/// - [AppSnackbarVariant.info]    — blue, for neutral notices.
///
/// ## Usage
/// Call the static helper — never instantiate [SnackBar] directly.
///
/// ```dart
/// AppSnackbar.show(
///   context,
///   message: context.l10n.verificationSuccess,
///   variant: AppSnackbarVariant.success,
/// );
/// ```
///
/// ## Do NOT
/// - Use for errors that require user action — use [AppDialog] instead.
/// - Stack multiple snackbars — each call clears the previous.
abstract final class AppSnackbar {
  /// Shows a themed snackbar. Clears any existing snackbar first.
  static void show(
    BuildContext context, {
    required String message,
    AppSnackbarVariant variant = AppSnackbarVariant.info,
    String? actionLabel,
    VoidCallback? onAction,
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(context)
      ..clearSnackBars()
      ..showSnackBar(
        _build(
          context,
          message: message,
          variant: variant,
          actionLabel: actionLabel,
          onAction: onAction,
          duration: duration,
        ),
      );
  }

  static SnackBar _build(
    BuildContext context, {
    required String message,
    required AppSnackbarVariant variant,
    String? actionLabel,
    VoidCallback? onAction,
    required Duration duration,
  }) {
    // Use light palette so snackbar is always dark bg regardless of theme.
    final accentColor = _accentColor(variant);
    final icon = _icon(variant);

    return SnackBar(
      duration: duration,
      behavior: SnackBarBehavior.floating,
      backgroundColor: AppColors.light.snackbarBackground,
      shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusMd),
      margin: const EdgeInsets.all(AppSpacing.lg),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      content: Row(
        children: [
          Icon(icon, size: 20, color: accentColor),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              message,
              style: AppTypography.bodyMedium.copyWith(
                color: AppColors.dark.textPrimary,
              ),
            ),
          ),
        ],
      ),
      action: actionLabel != null
          ? SnackBarAction(
              label: actionLabel,
              textColor: accentColor,
              onPressed: onAction ?? () {},
            )
          : null,
    );
  }

  static Color _accentColor(AppSnackbarVariant v) => switch (v) {
        AppSnackbarVariant.success => AppColors.light.success,
        AppSnackbarVariant.error => AppColors.dark.error,
        AppSnackbarVariant.warning => AppColors.dark.warning,
        AppSnackbarVariant.info => AppColors.dark.info,
      };

  static IconData _icon(AppSnackbarVariant v) => switch (v) {
        AppSnackbarVariant.success => Icons.check_circle_outline_rounded,
        AppSnackbarVariant.error => Icons.error_outline_rounded,
        AppSnackbarVariant.warning => Icons.warning_amber_rounded,
        AppSnackbarVariant.info => Icons.info_outline_rounded,
      };
}

/// Severity variants for [AppSnackbar].
enum AppSnackbarVariant { success, error, warning, info }
