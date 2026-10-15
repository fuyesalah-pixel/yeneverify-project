import 'package:flutter/material.dart';
import '../../theme/app_colors_extension.dart';
import '../../theme/app_radii.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_typography.dart';
import '../feedback/app_bottom_sheet.dart';

/// # PhotoSourcePicker
///
/// A bottom-sheet picker offering exactly TWO image input options:
///   1. **Take Photo** — live camera capture.
///   2. **Upload Image** — gallery picker.
///
/// ## THE TWO-INPUT RULE (from §3 of Master Context)
/// This is the ONLY way to capture a receipt image.
/// ❌ Never add QR scan.
/// ❌ Never add paste-text.
/// ❌ Never add URL input.
/// ❌ Never add a third option without Fuad's explicit approval.
///
/// ## Usage
/// ```dart
/// // Show via AppBottomSheet helper (preferred):
/// PhotoSourcePicker.show(
///   context,
///   onCamera: () => ref.read(verifyProvider.notifier).capturePhoto(),
///   onGallery: () => ref.read(verifyProvider.notifier).pickFromGallery(),
/// );
/// ```
///
/// Or embed inline (rare — prefer the sheet):
/// ```dart
/// PhotoSourcePicker(
///   onCamera: ...,
///   onGallery: ...,
/// )
/// ```
class PhotoSourcePicker extends StatelessWidget {
  const PhotoSourcePicker({
    super.key,
    required this.onCamera,
    required this.onGallery,
    this.cameraLabel,
    this.galleryLabel,
  });

  final VoidCallback onCamera;
  final VoidCallback onGallery;

  /// Localized label for camera option. Caller provides from ARB.
  final String? cameraLabel;

  /// Localized label for gallery option. Caller provides from ARB.
  final String? galleryLabel;

  /// Shows the picker as a bottom sheet.
  /// Automatically pops the sheet before calling the callback.
  static void show(
    BuildContext context, {
    required VoidCallback onCamera,
    required VoidCallback onGallery,
    String? title,
    String? cameraLabel,
    String? galleryLabel,
  }) {
    AppBottomSheet.show(
      context,
      title: title ?? 'Add receipt photo',
      child: PhotoSourcePicker(
        onCamera: () {
          Navigator.of(context).pop();
          onCamera();
        },
        onGallery: () {
          Navigator.of(context).pop();
          onGallery();
        },
        cameraLabel: cameraLabel,
        galleryLabel: galleryLabel,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SourceOption(
            icon: Icons.camera_alt_outlined,
            label: cameraLabel ?? 'Take Photo',
            description: 'Capture the payment confirmation screen',
            onTap: onCamera,
            accentColor: colors.primaryAction,
          ),
          Divider(height: 1, color: colors.divider),
          _SourceOption(
            icon: Icons.photo_library_outlined,
            label: galleryLabel ?? 'Upload Image',
            description: 'Choose an existing photo from your gallery',
            onTap: onGallery,
            accentColor: colors.primaryAction,
          ),
        ],
      ),
    );
  }
}

// ─── Internal option row ──────────────────────────────────────────────────────

class _SourceOption extends StatelessWidget {
  const _SourceOption({
    required this.icon,
    required this.label,
    required this.description,
    required this.onTap,
    required this.accentColor,
  });

  final IconData icon;
  final String label;
  final String description;
  final VoidCallback onTap;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.lg,
        ),
        child: Row(
          children: [
            // Icon container
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: accentColor.withValues(alpha: 0.10),
                borderRadius: AppRadii.radiusMd,
              ),
              child: Icon(icon, color: accentColor, size: 24),
            ),
            const SizedBox(width: AppSpacing.md),
            // Labels
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: AppTypography.bodyLarge.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    description,
                    style: AppTypography.bodySmall.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios_rounded,
              size: 14,
              color: colors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
