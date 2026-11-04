// One pending invite: ghost avatar, masked phone, age, resend/revoke.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../dashboard/domain/relative_time.dart';
import '../../data/models/sub_merchant_summary.dart';

class InviteRow extends StatelessWidget {
  const InviteRow({
    super.key,
    required this.invite,
    required this.onResend,
    required this.onRevoke,
    this.isBusy = false,
  });

  final SubMerchantSummary invite;
  final VoidCallback onResend;
  final VoidCallback onRevoke;
  final bool isBusy;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final invitedAt = invite.invitedAt;

    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: colors.border),
              color: colors.surfaceAlt,
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.person_add_alt_1_outlined,
              size: 20,
              color: colors.textSecondary,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  invite.name.isEmpty ? invite.phone : invite.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodyMedium.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.micro),
                Text(
                  invitedAt == null
                      ? invite.phone
                      : l10n.teamInvitedAgo(relativeTime(invitedAt, l10n)),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (isBusy)
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else ...[
            TextButton(
              onPressed: onResend,
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                foregroundColor: colors.primaryAction,
              ),
              child: Text(l10n.teamResend),
            ),
            TextButton(
              onPressed: onRevoke,
              style: TextButton.styleFrom(
                visualDensity: VisualDensity.compact,
                foregroundColor: colors.error,
              ),
              child: Text(l10n.teamRevoke),
            ),
          ],
        ],
      ),
    );
  }
}
