import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';

/// # AppIconButton
///
/// A square or circular tappable icon control.
///
/// ## Variants
/// - [AppIconButtonVariant.standard] — ghost, just the icon + ripple.
/// - [AppIconButtonVariant.filled] — filled [AppColors.primaryAction] bg.
/// - [AppIconButtonVariant.outlined] — bordered, transparent fill.
/// - [AppIconButtonVariant.tinted] — [AppColors.surfaceAlt] fill, subtle.
///
/// ## Sizes
/// Minimum 48×48 to meet tap-target requirement.
///
/// ## Example
/// ```dart
/// AppIconButton(
///   icon: LucideIcons.copy,
///   onPressed: () => Clipboard.setData(ClipboardData(text: ref)),
///   tooltip: context.l10n.copyReference,
/// )
/// ```
class AppIconButton extends StatelessWidget {
  const AppIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.variant = AppIconButtonVariant.standard,
    this.size = 24.0,
    this.tooltip,
    this.color,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final AppIconButtonVariant variant;

  /// Icon size (the tap target is always at least 48px).
  final double size;
  final String? tooltip;

  /// Override icon color. If null, uses variant default.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    final iconColor = color ??
        switch (variant) {
          AppIconButtonVariant.filled => _primaryForeground(context),
          _ => colors.textPrimary,
        };

    final bg = switch (variant) {
      AppIconButtonVariant.filled => colors.primaryAction,
      AppIconButtonVariant.tinted => colors.surfaceAlt,
      _ => AppColors.transparent,
    };

    final border = switch (variant) {
      AppIconButtonVariant.outlined => Border.all(color: colors.border),
      _ => null,
    };

    final radius = switch (variant) {
      AppIconButtonVariant.standard => AppRadii.radiusPill,
      _ => AppRadii.radiusMd,
    };

    final inner = Container(
      constraints: const BoxConstraints(
        minWidth: AppSpacing.minTapTarget,
        minHeight: AppSpacing.minTapTarget,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: radius,
        border: border,
      ),
      child: Center(
        child: Icon(icon, size: size, color: onPressed == null ? colors.textDisabled : iconColor),
      ),
    );

    final button = InkWell(
      onTap: onPressed,
      borderRadius: radius,
      child: inner,
    );

    if (tooltip != null) {
      return Tooltip(message: tooltip!, child: button);
    }
    return button;
  }

  Color _primaryForeground(BuildContext context) {
    return context.colors.onPrimary;
  }
}

/// Visual style variants for [AppIconButton].
enum AppIconButtonVariant { standard, filled, outlined, tinted }
