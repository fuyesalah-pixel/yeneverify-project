// Step 2 of checkout: choose/take/remove the payment screenshot.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/layout/app_card.dart';

class ReceiptUploadSection extends StatelessWidget {
  const ReceiptUploadSection({
    super.key,
    required this.imagePath,
    required this.busy,
    required this.progress,
    required this.onCamera,
    required this.onGallery,
    required this.onChange,
    required this.onRemove,
  });

  final String? imagePath;
  final bool busy;
  final double progress;
  final VoidCallback onCamera;
  final VoidCallback onGallery;
  final VoidCallback onChange;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    if (imagePath != null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppCard(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: ClipRRect(
              borderRadius: AppRadii.radiusMd,
              child: Image.file(
                File(imagePath!),
                height: 220,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => Container(
                  height: 120,
                  alignment: Alignment.center,
                  color: colors.surfaceAlt,
                  child: Icon(Icons.image_outlined,
                      size: 32, color: colors.textSecondary),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: l10n.billingChange,
                  variant: AppButtonVariant.secondary,
                  size: AppButtonSize.md,
                  onPressed: busy ? null : onChange,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: AppButton(
                  label: l10n.billingRemove,
                  variant: AppButtonVariant.ghost,
                  size: AppButtonSize.md,
                  onPressed: busy ? null : onRemove,
                ),
              ),
            ],
          ),
          if (busy) ...[
            const SizedBox(height: AppSpacing.md),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.xs),
              child: LinearProgressIndicator(
                value: progress > 0 ? progress : null,
                minHeight: 6,
                backgroundColor: colors.surfaceAlt,
                color: colors.primaryAction,
              ),
            ),
          ],
        ],
      );
    }

    return Row(
      children: [
        Expanded(
          child: _UploadCard(
            icon: Icons.camera_alt_outlined,
            title: l10n.takePhoto,
            subtitle: l10n.takePhotoCardSubtitle,
            highlighted: true,
            onTap: busy ? null : onCamera,
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: _UploadCard(
            icon: Icons.image_outlined,
            title: l10n.uploadImage,
            subtitle: l10n.uploadImageCardSubtitle,
            onTap: busy ? null : onGallery,
          ),
        ),
      ],
    );
  }
}

class _UploadCard extends StatelessWidget {
  const _UploadCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.highlighted = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = highlighted ? colors.primaryAction : colors.textPrimary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadii.radiusLg,
        child: Ink(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xl,
          ),
          decoration: BoxDecoration(
            color: highlighted
                ? accent.withValues(alpha: 0.08)
                : colors.surface,
            borderRadius: AppRadii.radiusLg,
            border: Border.all(
              color: highlighted
                  ? accent.withValues(alpha: 0.35)
                  : colors.border,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 32, color: accent),
              const SizedBox(height: AppSpacing.sm),
              Text(
                title,
                style: AppTypography.labelLarge.copyWith(
                  color: colors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.micro),
              Text(
                subtitle,
                style:
                    AppTypography.bodySmall.copyWith(color: colors.textSecondary),
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
