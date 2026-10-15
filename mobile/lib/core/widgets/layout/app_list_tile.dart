import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # AppListTile
///
/// A single row in a list — leading icon/avatar, title, subtitle, trailing.
///
/// Wraps [ListTile] with design-system defaults so all list items are
/// visually consistent without repeating style code.
///
/// ## When to use
/// - Settings rows.
/// - Transaction list items (use [TransactionTile] for those specifically).
/// - Menu items in bottom sheets.
/// - Sub-merchant list rows.
///
/// ## When NOT to use
/// - Complex card content — use [AppCard] instead.
/// - Analytics rows — use [InsightCard].
///
/// ## Example
/// ```dart
/// AppListTile(
///   leading: const Icon(LucideIcons.user),
///   title: subMerchant.name,
///   subtitle: subMerchant.phone,
///   trailing: const Icon(LucideIcons.chevronRight),
///   onTap: () => context.push('/sub-merchants/${subMerchant.id}'),
/// )
/// ```
class AppListTile extends StatelessWidget {
  const AppListTile({
    super.key,
    this.leading,
    required this.title,
    this.subtitle,
    this.trailing,
    this.onTap,
    this.showDivider = false,
    this.isDestructive = false,
    this.enabled = true,
    this.contentPadding,
  });

  final Widget? leading;
  final String title;
  final String? subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// Show a divider below this tile.
  final bool showDivider;

  /// When true, renders title in [AppColors.error] (e.g. "Delete account").
  final bool isDestructive;

  final bool enabled;
  final EdgeInsetsGeometry? contentPadding;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    final titleColor = isDestructive
        ? colors.error
        : enabled
            ? colors.textPrimary
            : colors.textDisabled;

    Widget tile = ListTile(
      enabled: enabled,
      onTap: onTap,
      contentPadding: contentPadding ??
          const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg,
            vertical: AppSpacing.xs,
          ),
      leading: leading,
      title: Text(
        title,
        style: AppTypography.bodyLarge.copyWith(color: titleColor),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: AppTypography.bodyMedium.copyWith(
                color: colors.textSecondary,
              ),
            )
          : null,
      trailing: trailing,
      minVerticalPadding: AppSpacing.sm,
    );

    if (showDivider) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          tile,
          Divider(
            height: 1,
            thickness: 1,
            color: colors.divider,
            indent: AppSpacing.lg,
            endIndent: AppSpacing.lg,
          ),
        ],
      );
    }

    return tile;
  }
}
