// A single row listing a Google-paired account on this device.
// Tapping the trailing "Remove" button signs out that device binding.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../auth/domain/google_auth_provider.dart';
import '../../data/models/device_account.dart';

class DeviceAccountTile extends ConsumerWidget {
  const DeviceAccountTile({
    super.key,
    required this.account,
  });

  final DeviceAccount account;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return AppCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: colors.primaryAction.withValues(alpha: 0.12),
            child: Text(
              account.googleEmail.isNotEmpty
                  ? account.googleEmail.substring(0, 1).toUpperCase()
                  : '?',
              style: AppTypography.labelMedium.copyWith(
                color: colors.primaryAction,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  account.googleEmail,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyLarge.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.micro),
                Text(
                  l10n.devicePhoneSuffix(account.phoneLast4),
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          _RemoveButton(account: account),
        ],
      ),
    );
  }
}

class _RemoveButton extends ConsumerWidget {
  const _RemoveButton({required this.account});

  final DeviceAccount account;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return TextButton(
      onPressed: () => _confirmRemove(context, ref),
      style: TextButton.styleFrom(
        foregroundColor: colors.error,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.radiusMd,
        ),
      ),
      child: Text(
        l10n.deviceRemove,
        style: AppTypography.labelMedium.copyWith(color: colors.error),
      ),
    );
  }

  Future<void> _confirmRemove(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: AppRadii.radiusLg,
        ),
        backgroundColor: colors.surface,
        title: Text(
          l10n.deviceRemoveConfirmTitle(account.googleEmail),
          style: AppTypography.headingSmall.copyWith(
            color: colors.textPrimary,
          ),
        ),
        content: Text(
          l10n.deviceRemoveConfirmBody,
          style: AppTypography.bodyMedium.copyWith(
            color: colors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(l10n.cancelLabel),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(
              foregroundColor: colors.error,
            ),
            child: Text(l10n.deviceRemove),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final notifier = ref.read(googleAuthProvider.notifier);
    await notifier.signoutDeviceAccount(phoneLast4: account.phoneLast4);
  }
}
