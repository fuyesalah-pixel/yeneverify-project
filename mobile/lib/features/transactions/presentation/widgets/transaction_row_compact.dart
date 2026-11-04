// One verification in the history list: bank, reference, amount, verdict.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/fintech/amount_text.dart';
import '../../../../core/widgets/fintech/bank_logo.dart';
import '../../../../core/widgets/fintech/verdict_badge.dart';
import '../../../dashboard/domain/relative_time.dart';
import '../../../verify/data/models/verification_result.dart';
import '../../../verify/data/models/verification_summary.dart';

class TransactionRowCompact extends StatelessWidget {
  const TransactionRowCompact({
    super.key,
    required this.item,
    required this.onTap,
  });

  final VerificationSummary item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final amount = item.amountMinorValue;
    // Who paid is the row's primary label; the bank reference and the bank
    // code are fallbacks for receipts where the sender was not extracted.
    final hasSender = item.senderName != null;
    final primaryLabel =
        item.senderName ?? item.bankReference ?? item.bankCode ?? '—';

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Column(
          children: [
            Row(
              children: [
                BankLogo(bankCode: item.bankCode ?? '', size: 32),
                const SizedBox(width: AppSpacing.md),
                Text(
                  item.bankCode ?? '—',
                  style: AppTypography.labelLarge.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const Spacer(),
                Text(
                  relativeTime(item.occurredAt, l10n),
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Expanded(
                  child: Text(
                    primaryLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodySmall.copyWith(
                      color: hasSender ? colors.textPrimary : colors.textSecondary,
                      // References are monospaced; a person's name is not.
                      fontFamily: hasSender ? null : AppTypography.mono.fontFamily,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                if (amount != null)
                  AmountText(
                    amountMinor: amount,
                    size: AmountTextSize.body,
                  )
                else
                  const Text('—', style: AppTypography.bodySmall),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Align(
              alignment: Alignment.centerRight,
              child: VerdictBadge(verdict: verdictOf(item.status)),
            ),
          ],
        ),
      ),
    );
  }
}

VerificationVerdict verdictOf(VerificationStatus status) => switch (status) {
      VerificationStatus.verified => VerificationVerdict.verified,
      VerificationStatus.fake => VerificationVerdict.fake,
      VerificationStatus.duplicate => VerificationVerdict.duplicate,
      VerificationStatus.needsReview => VerificationVerdict.needsReview,
      VerificationStatus.error => VerificationVerdict.error,
      VerificationStatus.pending => VerificationVerdict.pending,
    };
