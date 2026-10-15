import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';

/// # AppBottomSheet
///
/// A modal bottom sheet with consistent header, drag handle, and
/// scrollable content area.
///
/// ## When to use
/// - Action pickers (photo source, options menu).
/// - Detail views that don't warrant a full screen push.
/// - Confirmation flows with multiple steps.
///
/// ## When NOT to use
/// - Binary confirm/cancel — use [AppDialog].
/// - Full-screen flows (onboarding, complex forms) — push a screen.
///
/// ## Usage
/// ```dart
/// await AppBottomSheet.show(
///   context,
///   title: context.l10n.choosePhotoSource,
///   child: const PhotoSourcePicker(),
/// );
/// ```
///
/// ## Returning a value
/// ```dart
/// final result = await AppBottomSheet.show<String>(
///   context,
///   title: 'Select bank',
///   child: BankPickerList(onSelect: (bank) => Navigator.pop(context, bank)),
/// );
/// ```
abstract final class AppBottomSheet {
  /// Shows a modal bottom sheet and returns the result when dismissed.
  static Future<T?> show<T>(
    BuildContext context, {
    String? title,
    required Widget child,
    bool isScrollControlled = true,
    bool isDismissible = true,
    bool enableDrag = true,
    double? maxHeightFraction,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isScrollControlled: isScrollControlled,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      backgroundColor: AppColors.transparent,
      builder: (ctx) => _AppBottomSheetWidget(
        title: title,
        maxHeightFraction: maxHeightFraction ?? 0.9,
        child: child,
      ),
    );
  }
}

// ─── Internal widget ──────────────────────────────────────────────────────────

class _AppBottomSheetWidget extends StatelessWidget {
  const _AppBottomSheetWidget({
    this.title,
    required this.child,
    required this.maxHeightFraction,
  });

  final String? title;
  final Widget child;
  final double maxHeightFraction;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final maxHeight =
        MediaQuery.of(context).size.height * maxHeightFraction;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadii.sheetTop,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.md),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: AppRadii.radiusPill,
                ),
              ),
            ),

            // Title
            if (title != null) ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        title!,
                        style: AppTypography.headingSmall.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                    // Close button
                    InkWell(
                      onTap: () => Navigator.of(context).pop(),
                      borderRadius: AppRadii.radiusPill,
                      child: Padding(
                        padding: AppSpacing.insetXs,
                        child: Icon(
                          Icons.close_rounded,
                          size: 20,
                          color: colors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: colors.divider),
            ] else
              const SizedBox(height: AppSpacing.sm),

            // Content — scrollable
            Flexible(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.only(
                  bottom: AppSpacing.xl,
                ),
                child: child,
              ),
            ),

            // Safe area bottom
            SizedBox(
              height: MediaQuery.of(context).padding.bottom,
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Convenience: sheet action row item ───────────────────────────────────────

/// A single tappable row inside a bottom sheet action list.
///
/// ```dart
/// AppBottomSheet.show(
///   context,
///   child: Column(children: [
///     SheetAction(
///       icon: Icons.camera_alt_outlined,
///       label: context.l10n.takePhoto,
///       onTap: () { ... },
///     ),
///     SheetAction(
///       icon: Icons.photo_library_outlined,
///       label: context.l10n.uploadImage,
///       onTap: () { ... },
///     ),
///   ]),
/// )
/// ```
class SheetAction extends StatelessWidget {
  const SheetAction({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
    this.isDestructive = false,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool isDestructive;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final color = isDestructive ? colors.error : colors.textPrimary;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        child: Row(
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyLarge.copyWith(color: color),
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}
