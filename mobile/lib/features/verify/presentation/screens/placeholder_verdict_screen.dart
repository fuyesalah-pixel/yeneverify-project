// PLACEHOLDER verdict screen (Step 22B Part 1).
//
// Part 2 replaces this with the real verdict UI: receipt preview, amount,
// bank, reference, duplicate-of, share, retry, and request-review. Part 1
// only has to prove that a terminal status reaches the UI intact, so this
// screen renders the status and the handful of fields the backend already
// returned, plus a way back.
import 'package:flutter/material.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_radii.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/buttons/app_button.dart';
import '../../../../core/widgets/fintech/verdict_badge.dart';
import '../../data/models/verification_result.dart';
import '../verify_copy.dart';

class PlaceholderVerdictScreen extends StatelessWidget {
  const PlaceholderVerdictScreen({super.key, required this.result});

  final VerificationResult result;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(l10n.verdictTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.xxl,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: VerdictBadge(
                  verdict: _verdict(result.status),
                  size: VerdictBadgeSize.large,
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),
              Text(
                verificationStatusLabel(l10n, result.status),
                style: AppTypography.headingLarge.copyWith(
                  color: colors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.verdictPlaceholderNote,
                style: AppTypography.bodySmall.copyWith(
                  color: colors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xxxl),
              Container(
                padding: AppSpacing.insetLg,
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: AppRadii.radiusLg,
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  children: [
                    if (result.bankCode != null)
                      _Row(label: 'Bank', value: result.bankCode!),
                    if (result.bankReference != null)
                      _Row(label: 'Reference', value: result.bankReference!),
                    if (result.amountMinor != null)
                      _Row(label: 'Amount (minor)', value: result.amountMinor!),
                    if (result.errorCode != null)
                      _Row(label: 'Error', value: result.errorCode!),
                    _Row(label: 'Status', value: result.status.wire),
                    _Row(label: 'ID', value: result.id),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xxxl),
              AppButton(
                label: l10n.backToVerify,
                onPressed: () => Navigator.of(context).maybePop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

VerificationVerdict _verdict(VerificationStatus status) {
  switch (status) {
    case VerificationStatus.verified:
      return VerificationVerdict.verified;
    case VerificationStatus.fake:
      return VerificationVerdict.fake;
    case VerificationStatus.duplicate:
      return VerificationVerdict.duplicate;
    case VerificationStatus.needsReview:
      return VerificationVerdict.needsReview;
    case VerificationStatus.error:
      return VerificationVerdict.error;
    case VerificationStatus.pending:
      return VerificationVerdict.pending;
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: AppTypography.bodySmall.copyWith(
                color: colors.textSecondary,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.bodySmall.copyWith(
                color: colors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
