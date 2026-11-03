// The facts behind the verdict, in one card: bank, reference, parties,
// timestamps, duration and the way into the receipt preview.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/feedback/app_snackbar.dart';
import '../../../../core/widgets/fintech/bank_logo.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../data/models/verification_result.dart';
import '../verdict_copy.dart';

class VerdictDetailsCard extends StatelessWidget {
  const VerdictDetailsCard({
    super.key,
    required this.result,
    this.onViewReceipt,
  });

  final VerificationResult result;

  /// Null hides the receipt row (no receipt id, or a context that cannot
  /// open a sheet).
  final VoidCallback? onViewReceipt;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    final bank = bankDisplayName(l10n, result.bankCode);
    final reference = result.bankReference;
    final sender = result.senderName;
    final receiver = result.receiverName;
    final receiptId = result.receiptId;

    final rows = <Widget>[
      if (bank != null && bank.isNotEmpty)
        _BankRow(
          bankCode: result.bankCode!,
          name: bank,
        ),
      if (reference != null && reference.isNotEmpty)
        _ReferenceRow(reference: reference),
      if (sender != null && sender.isNotEmpty)
        _DetailRow(label: l10n.verdictSenderLabel, value: sender),
      if (receiver != null && receiver.isNotEmpty)
        _DetailRow(label: l10n.verdictReceiverLabel, value: receiver),
      if (result.paidAt != null)
        _DetailRow(
          label: l10n.verdictPaidAtLabel,
          value: formatVerdictTimestamp(result.paidAt),
        ),
      if (result.completedAt != null)
        _DetailRow(
          label: l10n.verdictVerifiedAtLabel,
          value: formatVerdictTimestamp(result.completedAt),
        ),
      if (result.durationMs != null)
        _DetailRow(
          label: l10n.verdictDurationLabel,
          value: verdictDurationText(l10n, result.durationMs),
        ),
      if (onViewReceipt != null && receiptId != null)
        _ReceiptRow(
            label: l10n.verdictViewReceiptButton, onTap: onViewReceipt!),
    ];

    if (rows.isEmpty) return const SizedBox.shrink();

    return AppCard(
      child: Column(
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) Divider(height: AppSpacing.xxl, color: colors.divider),
            rows[i],
          ],
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 96,
          child: Text(
            label,
            style:
                AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: AppTypography.bodyMedium.copyWith(color: colors.textPrimary),
          ),
        ),
      ],
    );
  }
}

class _BankRow extends StatelessWidget {
  const _BankRow({required this.bankCode, required this.name});

  final String bankCode;
  final String name;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    // Logo + name left-aligned instead of label/value: the full name of a
    // bank does not fit the value column and used to wrap into two ragged
    // right-aligned lines.
    return Row(
      children: [
        BankLogo(bankCode: bankCode, size: 22),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            name,
            style: AppTypography.bodyMedium.copyWith(color: colors.textPrimary),
          ),
        ),
      ],
    );
  }
}

class _ReferenceRow extends StatelessWidget {
  const _ReferenceRow({required this.reference});

  final String reference;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Row(
      children: [
        SizedBox(
          width: 96,
          child: Text(
            l10n.verdictReferenceLabel,
            style:
                AppTypography.bodySmall.copyWith(color: colors.textSecondary),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            reference,
            textAlign: TextAlign.end,
            style: AppTypography.bodyMedium.copyWith(
              color: colors.textPrimary,
              fontFamily: AppTypography.mono.fontFamily,
            ),
          ),
        ),
        IconButton(
          icon: const Icon(Icons.copy_rounded, size: 18),
          color: colors.textSecondary,
          tooltip: l10n.copyReference,
          visualDensity: VisualDensity.compact,
          onPressed: () {
            // Fire-and-forget: the confirmation must not wait on the
            // platform clipboard channel.
            unawaited(Clipboard.setData(ClipboardData(text: reference)));
            AppSnackbar.show(
              context,
              message: l10n.verdictCopySuccess,
              variant: AppSnackbarVariant.success,
            );
          },
        ),
      ],
    );
  }
}

class _ReceiptRow extends StatelessWidget {
  const _ReceiptRow({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppSpacing.sm),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(
          children: [
            Icon(Icons.receipt_long_outlined,
                size: 20, color: colors.primaryAction),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyMedium.copyWith(
                  color: colors.primaryAction,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: colors.textSecondary),
          ],
        ),
      ),
    );
  }
}
