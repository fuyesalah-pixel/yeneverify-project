// DUPLICATE only: points at the verification that consumed this receipt.
//
// "View original" refetches that verification through the tenant-scoped
// GET /verifications/:id. A 404 means it belongs to another business, which
// is the honest answer — the backend will not leak a foreign receipt.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:yene_verify/l10n/app_localizations.dart';

import '../../../../core/network/api_result.dart';
import '../../../../core/theme/app_colors_extension.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/widgets/fintech/amount_text.dart';
import '../../../../core/widgets/feedback/app_bottom_sheet.dart';
import '../../../../core/widgets/layout/app_card.dart';
import '../../data/models/verification_result.dart';
import '../../data/verify_repository.dart';
import 'verdict_details_card.dart';

class DuplicateReferenceCard extends StatelessWidget {
  const DuplicateReferenceCard({
    super.key,
    required this.result,
    this.onViewOriginal,
  });

  final VerificationResult result;
  final VoidCallback? onViewOriginal;

  @override
  Widget build(BuildContext context) {
    final reference = result.duplicateOf;
    if (reference == null) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return AppCard.outlined(
      onTap: onViewOriginal,
      padding: AppSpacing.insetLg,
      child: Row(
        children: [
          Icon(Icons.content_copy_rounded, size: 20, color: colors.warning),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.verdictFirstVerifiedLabel,
                  style: AppTypography.labelMedium.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.micro),
                Text(
                  l10n.verdictFirstVerifiedHint,
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (onViewOriginal != null)
            Icon(Icons.chevron_right_rounded, color: colors.textSecondary),
        ],
      ),
    );
  }
}

/// Bottom sheet showing the original verification's amount and facts.
class DuplicateDetailsSheet extends ConsumerStatefulWidget {
  const DuplicateDetailsSheet({super.key, required this.reference});

  final DuplicateReference reference;

  static Future<void> show(BuildContext context, DuplicateReference reference) {
    return AppBottomSheet.show<void>(
      context,
      title: AppLocalizations.of(context).verdictViewOriginalButton,
      child: DuplicateDetailsSheet(reference: reference),
    );
  }

  @override
  ConsumerState<DuplicateDetailsSheet> createState() =>
      _DuplicateDetailsSheetState();
}

class _DuplicateDetailsSheetState extends ConsumerState<DuplicateDetailsSheet> {
  late Future<ApiResult<VerificationResult>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ApiResult<VerificationResult>> _load() {
    return ref
        .read(verificationsApiProvider)
        .getById(widget.reference.verificationId);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = context.colors;

    return FutureBuilder<ApiResult<VerificationResult>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.giant),
            child: Center(child: CircularProgressIndicator()),
          );
        }

        final data = snapshot.data;
        final original = data is Success<VerificationResult> ? data.data : null;
        if (original == null) {
          return Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.lg,
              vertical: AppSpacing.xxl,
            ),
            child: Text(
              l10n.verdictOriginalUnavailable,
              textAlign: TextAlign.center,
              style: AppTypography.bodyMedium.copyWith(
                color: colors.textSecondary,
              ),
            ),
          );
        }

        final amount = original.amountMinorValue;
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (amount != null)
                Center(
                  child: AmountText(
                    amountMinor: amount,
                    size: AmountTextSize.heading,
                  ),
                ),
              const SizedBox(height: AppSpacing.lg),
              VerdictDetailsCard(result: original),
            ],
          ),
        );
      },
    );
  }
}
