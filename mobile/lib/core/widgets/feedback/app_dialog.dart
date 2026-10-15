import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../buttons/app_button.dart';

/// # AppDialog
///
/// Modal alert dialog for situations requiring user acknowledgement or
/// a binary decision.
///
/// ## When to use
/// - Confirming a destructive action (delete sub-merchant, revoke device).
/// - Blocking errors that require acknowledgement before continuing.
/// - Short informational notices that need a dismiss action.
///
/// ## When NOT to use
/// - Success/failure feedback — use [AppSnackbar].
/// - Complex forms or long content — use [AppBottomSheet].
/// - Non-blocking notices — use [AppSnackbar].
///
/// ## Usage
/// ```dart
/// final confirmed = await AppDialog.confirm(
///   context,
///   title: context.l10n.deleteSubMerchantTitle,
///   body: context.l10n.deleteSubMerchantBody,
///   confirmLabel: context.l10n.delete,
///   isDanger: true,
/// );
/// if (confirmed == true) { ... }
/// ```
abstract final class AppDialog {
  /// Shows an alert dialog with a single dismiss button.
  static Future<void> alert(
    BuildContext context, {
    required String title,
    required String body,
    String? dismissLabel,
    IconData? icon,
    Color? iconColor,
  }) {
    return showDialog<void>(
      context: context,
      builder: (_) => _AppDialogWidget(
        title: title,
        body: body,
        dismissLabel: dismissLabel ?? 'OK',
        icon: icon,
        iconColor: iconColor,
      ),
    );
  }

  /// Shows a confirmation dialog. Returns `true` if confirmed, `false`/null
  /// if dismissed.
  static Future<bool?> confirm(
    BuildContext context, {
    required String title,
    required String body,
    String? confirmLabel,
    String? cancelLabel,
    bool isDanger = false,
    IconData? icon,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (_) => _AppConfirmDialogWidget(
        title: title,
        body: body,
        confirmLabel: confirmLabel ?? 'Confirm',
        cancelLabel: cancelLabel ?? 'Cancel',
        isDanger: isDanger,
        icon: icon,
      ),
    );
  }
}

// ─── Internal widgets ─────────────────────────────────────────────────────────

class _AppDialogWidget extends StatelessWidget {
  const _AppDialogWidget({
    required this.title,
    required this.body,
    required this.dismissLabel,
    this.icon,
    this.iconColor,
  });

  final String title;
  final String body;
  final String dismissLabel;
  final IconData? icon;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusLg),
      backgroundColor: colors.surface,
      contentPadding: AppSpacing.insetXxl,
      titlePadding: const EdgeInsets.fromLTRB(
        AppSpacing.xxl,
        AppSpacing.xxl,
        AppSpacing.xxl,
        AppSpacing.sm,
      ),
      title: Column(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 40, color: iconColor ?? colors.primaryAction),
            const SizedBox(height: AppSpacing.md),
          ],
          Text(
            title,
            style: AppTypography.headingSmall.copyWith(
              color: colors.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
      content: Text(
        body,
        style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
        textAlign: TextAlign.center,
      ),
      actionsAlignment: MainAxisAlignment.center,
      actionsPadding: const EdgeInsets.fromLTRB(
        AppSpacing.xxl,
        AppSpacing.sm,
        AppSpacing.xxl,
        AppSpacing.xxl,
      ),
      actions: [
        AppButton(
          label: dismissLabel,
          onPressed: () => Navigator.of(context).pop(),
          size: AppButtonSize.md,
        ),
      ],
    );
  }
}

class _AppConfirmDialogWidget extends StatelessWidget {
  const _AppConfirmDialogWidget({
    required this.title,
    required this.body,
    required this.confirmLabel,
    required this.cancelLabel,
    required this.isDanger,
    this.icon,
  });

  final String title;
  final String body;
  final String confirmLabel;
  final String cancelLabel;
  final bool isDanger;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: AppRadii.radiusLg),
      backgroundColor: colors.surface,
      contentPadding: AppSpacing.insetXxl,
      titlePadding: const EdgeInsets.fromLTRB(
        AppSpacing.xxl,
        AppSpacing.xxl,
        AppSpacing.xxl,
        AppSpacing.sm,
      ),
      title: Column(
        children: [
          if (icon != null) ...[
            Icon(
              icon,
              size: 40,
              color: isDanger ? colors.error : colors.primaryAction,
            ),
            const SizedBox(height: AppSpacing.md),
          ],
          Text(
            title,
            style: AppTypography.headingSmall.copyWith(
              color: colors.textPrimary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
      content: Text(
        body,
        style: AppTypography.bodyMedium.copyWith(color: colors.textSecondary),
        textAlign: TextAlign.center,
      ),
      actionsAlignment: MainAxisAlignment.center,
      actionsPadding: const EdgeInsets.fromLTRB(
        AppSpacing.xxl,
        AppSpacing.sm,
        AppSpacing.xxl,
        AppSpacing.xxl,
      ),
      actions: [
        Row(
          children: [
            Expanded(
              child: AppButton(
                label: cancelLabel,
                onPressed: () => Navigator.of(context).pop(false),
                variant: AppButtonVariant.secondary,
                size: AppButtonSize.md,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: AppButton(
                label: confirmLabel,
                onPressed: () => Navigator.of(context).pop(true),
                variant: isDanger
                    ? AppButtonVariant.danger
                    : AppButtonVariant.primary,
                size: AppButtonSize.md,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
