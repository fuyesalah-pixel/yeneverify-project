// Recent activity: the five newest verifications, tappable into a verdict.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/fintech/amount_text.dart';
import '../../../../core/widgets/fintech/bank_logo.dart';
import '../../../../core/widgets/fintech/verdict_badge.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../../../core/widgets/layout/section_header.dart';
import '../../../verify/data/models/verification_result.dart';
import '../../../verify/data/models/verification_summary.dart';
import '../../domain/relative_time.dart';

class RecentActivitySection extends StatelessWidget {
  const RecentActivitySection({
    super.key,
    required this.items,
    required this.onSeeAll,
    required this.onOpen,
  });

  final List<VerificationSummary> items;
  final VoidCallback onSeeAll;
  final void Function(VerificationSummary) onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SectionHeader(
          title: l10n.dashboardRecentTitle,
          actionLabel: l10n.dashboardSeeAll,
          onAction: onSeeAll,
        ),
        const SizedBox(height: AppSpacing.sm),
        AppCard(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Column(
            children: [
              for (var i = 0; i < items.length; i++) ...[
                if (i > 0) const _RowDivider(),
                _RecentRow(item: items[i], onTap: () => onOpen(items[i])),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.item, required this.onTap});

  final VerificationSummary item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;
    final amount = item.amountMinorValue;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.lg,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            BankLogo(bankCode: item.bankCode ?? '', size: 32),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    // Who paid reads as payment history; the bank code is
                    // only the fallback when the receipt had no sender.
                    item.senderName ?? item.bankCode ?? '—',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodyMedium.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.micro),
                  Text(
                    relativeTime(item.occurredAt, l10n),
                    style: AppTypography.bodySmall.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (amount != null)
                  AmountText(amountMinor: amount, size: AmountTextSize.caption)
                else
                  const Text('—', style: AppTypography.bodySmall),
                const SizedBox(height: AppSpacing.xs),
                VerdictBadge(verdict: _verdictOf(item.status)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _RowDivider extends StatelessWidget {
  const _RowDivider();

  @override
  Widget build(BuildContext context) {
    return Divider(
      height: 1,
      thickness: 1,
      indent: AppSpacing.xxl + AppSpacing.lg,
      endIndent: AppSpacing.lg,
      color: context.colors.divider,
    );
  }
}

VerificationVerdict _verdictOf(VerificationStatus status) {
  return switch (status) {
    VerificationStatus.verified => VerificationVerdict.verified,
    VerificationStatus.fake => VerificationVerdict.fake,
    VerificationStatus.duplicate => VerificationVerdict.duplicate,
    VerificationStatus.needsReview => VerificationVerdict.needsReview,
    VerificationStatus.error => VerificationVerdict.error,
    VerificationStatus.pending => VerificationVerdict.pending,
  };
}
