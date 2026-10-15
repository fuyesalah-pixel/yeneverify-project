import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_spacing.dart';

/// # AppCard
///
/// The standard surface container for grouped content.
///
/// ## Variants
/// - [AppCardVariant.default_] — filled [AppColors.surface], shadow in light
///   mode, border in dark mode.
/// - [AppCardVariant.outlined] — transparent fill, always has a border.
/// - [AppCardVariant.tinted] — [AppColors.surfaceAlt] fill, no shadow.
///
/// ## Usage
/// ```dart
/// AppCard(
///   child: Column(children: [...]),
/// )
///
/// AppCard.outlined(
///   padding: AppSpacing.insetMd,
///   child: ...,
/// )
/// ```
class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.variant = AppCardVariant.default_,
    this.padding,
    this.onTap,
    this.borderColor,
  });

  /// Named constructor for outlined variant.
  const AppCard.outlined({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.borderColor,
  }) : variant = AppCardVariant.outlined;

  /// Named constructor for tinted variant.
  const AppCard.tinted({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.borderColor,
  }) : variant = AppCardVariant.tinted;

  final Widget child;
  final AppCardVariant variant;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  /// Override border color. Defaults to [AppColors.border].
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final bgColor = switch (variant) {
      AppCardVariant.default_ => colors.surface,
      AppCardVariant.outlined => AppColors.transparent,
      AppCardVariant.tinted => colors.surfaceAlt,
    };

    final shadows = switch (variant) {
      AppCardVariant.default_ => isDark ? AppShadows.none : AppShadows.elevation1,
      _ => AppShadows.none,
    };

    final border = switch (variant) {
      AppCardVariant.outlined => Border.all(
          color: borderColor ?? colors.border,
        ),
      AppCardVariant.default_ => isDark
          ? Border.all(color: borderColor ?? colors.border)
          : null,
      AppCardVariant.tinted => null,
    };

    final decoration = BoxDecoration(
      color: bgColor,
      borderRadius: AppRadii.radiusLg,
      boxShadow: shadows,
      border: border,
    );

    final content = Container(
      decoration: decoration,
      padding: padding ?? AppSpacing.card,
      child: child,
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: AppRadii.radiusLg,
        child: content,
      );
    }

    return content;
  }
}

/// Visual style variants for [AppCard].
enum AppCardVariant { default_, outlined, tinted }
